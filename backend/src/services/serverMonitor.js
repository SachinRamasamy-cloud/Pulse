import net from 'net';
import tls from 'tls';
import dns from 'dns/promises';
import fetch from 'node-fetch';

// ── Port definitions ──────────────────────────────────────────────────────────
const PORT_SERVICES = {
  21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS',
  80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS',
  465: 'SMTPS', 587: 'SMTP/TLS', 993: 'IMAPS', 995: 'POP3S',
  1433: 'MSSQL', 1521: 'Oracle', 3000: 'Dev HTTP', 3306: 'MySQL',
  3389: 'RDP', 5432: 'PostgreSQL', 5900: 'VNC', 6379: 'Redis',
  8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 8888: 'Jupyter',
  9200: 'Elasticsearch', 27017: 'MongoDB',
};

// BUG FIX #2: ports most likely to be reachable from PaaS (Northflank allows these)
const QUICK_CHECK_PORTS = [443, 80, 22, 8443, 8080, 3000, 8000, 9000, 8888, 5000];

// Full scan — 1.5s timeout per port so scan finishes in reasonable time even if most blocked
const FULL_SCAN_PORTS   = Object.keys(PORT_SERVICES).map(Number);
const SCAN_TIMEOUT_MS   = 1500; // reduced from 2500 — fail fast on blocked ports
const PING_TIMEOUT_MS   = 3000;

// ── TCP connect helper ────────────────────────────────────────────────────────
function tcpConnect(ip, port, timeout = PING_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const start  = Date.now();
    const socket = net.createConnection({ host: ip, port, timeout });
    const done   = (ok) => {
      socket.destroy();
      resolve({ open: ok, latencyMs: ok ? Date.now() - start : null });
    };
    socket.on('connect', () => done(true));
    socket.on('error',   () => done(false));
    socket.on('timeout', () => done(false));
  });
}

/**
 * BUG FIX #2: Quick reachability — tries more ports, faster timeout.
 * Returns { online, pingMs, openPort }
 */
export async function checkReachability(ip) {
  // Try ports in parallel batches of 3 to be fast but not flood
  for (let i = 0; i < QUICK_CHECK_PORTS.length; i += 3) {
    const batch = QUICK_CHECK_PORTS.slice(i, i + 3);
    const results = await Promise.all(batch.map((p) => tcpConnect(ip, p, PING_TIMEOUT_MS)));
    const hit = results.find((r, idx) => r.open && batch[idx]);
    if (hit) {
      const portIdx = results.indexOf(hit);
      return { online: true, pingMs: hit.latencyMs, openPort: batch[portIdx] };
    }
  }
  return { online: false, pingMs: null, openPort: null };
}

// ── IP Geolocation ────────────────────────────────────────────────────────────
const IP_API_FIELDS =
  'status,message,continent,country,countryCode,region,regionName,city,zip,' +
  'lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query';

export async function fetchIpInfo(ip) {
  try {
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=${IP_API_FIELDS}`, { timeout: 6000 });
    const data = await res.json();
    if (data.status !== 'success') return null;
    return data;
  } catch {
    return null;
  }
}

// ── Full port scan ─────────────────────────────────────────────────────────────
export async function scanPorts(ip) {
  // BUG FIX #2: reduced timeout, run in parallel batches of 5
  const results = [];
  const batchSize = 5;

  for (let i = 0; i < FULL_SCAN_PORTS.length; i += batchSize) {
    const batch = FULL_SCAN_PORTS.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (port) => {
        const r = await tcpConnect(ip, port, SCAN_TIMEOUT_MS);
        return { port, open: r.open, latencyMs: r.latencyMs, service: PORT_SERVICES[port] || 'Unknown' };
      })
    );
    results.push(...batchResults);
  }

  return results.sort((a, b) => a.port - b.port);
}

// ── HTTP probe ────────────────────────────────────────────────────────────────
export async function checkHTTP(ip) {
  // Try HTTPS first, fallback to HTTP
  for (const [proto, port] of [['https', 443], ['http', 80]]) {
    try {
      const start = Date.now();
      const res   = await fetch(`${proto}://${ip}`, {
        method: 'HEAD',
        timeout: 6000,
        redirect: 'manual',
        headers: { 'User-Agent': 'PulseBoard/2.0 (+https://pulseboard.dev)' },
        // Don't verify SSL for raw IP probes
        agent: proto === 'https' ? new (await import('https')).Agent({ rejectUnauthorized: false }) : undefined,
      });
      return {
        proto,
        statusCode:     res.status,
        responseTimeMs: Date.now() - start,
        server:         res.headers.get('server') || null,
        poweredBy:      res.headers.get('x-powered-by') || null,
        contentType:    res.headers.get('content-type') || null,
        redirectTo:     res.headers.get('location') || null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ── SSL certificate check ─────────────────────────────────────────────────────
// BUG FIX #7: Accept both hostname AND raw IP. When given a raw IP, attempt SNI-less
// connection. Many servers respond correctly even without SNI on direct IPs.
export async function checkSSL(hostOrIp) {
  return new Promise((resolve) => {
    const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostOrIp);

    const options = {
      host: hostOrIp,
      port: 443,
      rejectUnauthorized: false, // we want to INSPECT even self-signed certs
      ...(isIp ? {} : { servername: hostOrIp }), // only set SNI for hostnames
    };

    const socket = tls.connect(options, () => {
      try {
        const cert = socket.getPeerCertificate(true);
        socket.destroy();

        if (!cert || !cert.valid_to) return resolve({ valid: false, reason: 'No certificate returned' });

        const validTo  = new Date(cert.valid_to);
        const daysLeft = Math.floor((validTo - Date.now()) / 86_400_000);

        resolve({
          valid:     true,
          expired:   daysLeft < 0,
          selfSigned: cert.issuer?.CN === cert.subject?.CN,
          daysLeft,
          validFrom: cert.valid_from,
          validTo:   cert.valid_to,
          issuer:    cert.issuer?.O || cert.issuer?.CN || 'Unknown',
          subject:   cert.subject?.CN || hostOrIp,
          altNames:  cert.subjectaltname
            ? cert.subjectaltname.replace(/DNS:/g, '').split(', ').slice(0, 10)
            : [],
        });
      } catch (e) {
        socket.destroy();
        resolve({ valid: false, reason: e.message });
      }
    });

    socket.on('error', (e) => resolve({ valid: false, reason: e.message }));
    setTimeout(() => { socket.destroy(); resolve({ valid: false, reason: 'Timeout' }); }, 8000);
  });
}

// ── Reverse DNS ───────────────────────────────────────────────────────────────
export async function reverseDns(ip) {
  try {
    const names = await dns.reverse(ip);
    return names[0] || null;
  } catch {
    return null;
  }
}
