import express from 'express';
import { protect, requirePro, requireProPlus } from '../middleware/auth.js';
import Server from '../models/Server.js';
import ServerSnapshot from '../models/ServerSnapshot.js';
import { cache } from '../config/redis.js';
import {
  checkReachability, fetchIpInfo, scanPorts, checkHTTP, checkSSL,
} from '../services/serverMonitor.js';
import {
  validateHetznerKey, listHetznerServers, getHetznerServer, getHetznerMetrics,
} from '../services/hetznerService.js';
import {
  generateInstallScript, generateDockerCompose,
} from '../services/agentService.js';

const router = express.Router();
router.use(protect);

const PLAN_LIMITS  = { free: 3, pro: 20, proplus: Infinity };
const AGENT_TYPES  = ['agent', 'docker'];
const API_TYPES    = ['api'];
const AGENT_OFFLINE_THRESHOLD_MS = 90_000; // 90s — 3 missed reports

// ── Input sanitiser ───────────────────────────────────────────────────────────
const sanitise   = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sanitiseTags = (arr) =>
  Array.isArray(arr) ? arr.map((t) => sanitise(t, 40)).filter(Boolean).slice(0, 10) : [];

// ── GET /api/servers ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // NOTE: agentToken + providerApiKey have select:false — safe to return list
    const servers = await Server.find({ userId: req.user._id })
      .select('+ip')
      .sort({ createdAt: -1 })
      .lean();

    // BUG FIX #8: For agent servers that haven't pinged yet, force isOnline to null
    // so the frontend shows "Waiting" instead of "Offline"
    const patched = servers.map((s) => {
      if (AGENT_TYPES.includes(s.connectionType) && !s.agentInstalled) {
        return { ...s, isOnline: null };
      }
      if (AGENT_TYPES.includes(s.connectionType) && s.lastAgentPing) {
        const stale = Date.now() - new Date(s.lastAgentPing).getTime() > AGENT_OFFLINE_THRESHOLD_MS;
        return { ...s, isOnline: stale ? false : true };
      }
      return s;
    });

    res.json({ servers: patched.map((s) => Server.toPublicServer(s)) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch servers.' });
  }
});

// ── POST /api/servers ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, connectionType = 'custom',
      ip, provider, providerApiKey,
      tags = [], notes = '',
    } = req.body;

    const plan = req.user.plan;

    const cleanName = sanitise(name, 80);
    if (!cleanName) return res.status(400).json({ error: 'Server name is required.' });

    // Plan capability checks
    if (AGENT_TYPES.includes(connectionType) && plan === 'free')
      return res.status(403).json({ error: 'Agent methods require Pro or Pro Plus.', code: 'PRO_REQUIRED' });

    if (API_TYPES.includes(connectionType) && plan !== 'proplus')
      return res.status(403).json({ error: 'Provider API requires Pro Plus.', code: 'PROPLUS_REQUIRED' });

    // Count limit
    const count = await Server.countDocuments({ userId: req.user._id });
    const limit = PLAN_LIMITS[plan] ?? 3;
    if (count >= limit && plan !== 'proplus')
      return res.status(403).json({
        error: `${plan} plan limit of ${limit} servers reached.`,
        code: 'LIMIT_REACHED',
      });

    const serverData = {
      userId: req.user._id,
      name:   cleanName,
      connectionType,
      tags:   sanitiseTags(tags),
      notes:  sanitise(notes, 500),
    };

    // ── Custom IP ──────────────────────────────────────────────────────────
    if (connectionType === 'custom') {
      const cleanIp = sanitise(ip, 45);
      if (!cleanIp) return res.status(400).json({ error: 'IP address is required.' });
      serverData.ip = cleanIp;
    }

    // ── Agent / Docker ─────────────────────────────────────────────────────
    if (AGENT_TYPES.includes(connectionType)) {
      const rawToken       = Server.generateAgentToken();
      serverData.agentToken     = rawToken;
      serverData.agentTokenHash = Server.hashToken(rawToken);
      if (ip) serverData.ip = sanitise(ip, 45);
    }

    // ── Provider API ───────────────────────────────────────────────────────
    if (API_TYPES.includes(connectionType)) {
      const cleanProvider = sanitise(provider, 20);
      const cleanKey      = sanitise(providerApiKey, 200);

      if (!cleanProvider || !cleanKey)
        return res.status(400).json({ error: 'Provider and API key are required.' });

      if (cleanProvider !== 'hetzner') {
        return res.status(400).json({ error: 'Only Hetzner provider API is supported right now.' });
      }

      // Validate key before saving
      if (cleanProvider === 'hetzner') {
        const v = await validateHetznerKey(cleanKey);
        if (!v.valid)
          return res.status(400).json({ error: `Hetzner API key invalid: ${v.error}` });
      }

      // Import provider servers synchronously so the frontend gets real server IDs
      // (avoids returning temporary records with null providerServerId).
      const hServers = await listHetznerServers(cleanKey);
      if (!hServers.length) {
        return res.status(400).json({ error: 'No servers found in this Hetzner account.' });
      }

      const imported = [];
      let skippedDueToConflict = 0;
      for (const hs of hServers) {
        try {
          const secureIp = Server.secureIpFields(hs.ip);
          const serverDoc = await Server.findOneAndUpdate(
            {
              userId: req.user._id,
              provider: cleanProvider,
              providerServerId: hs.providerServerId,
            },
            {
              $set: {
                name:           hs.name,
                connectionType: 'api',
                provider:       cleanProvider,
                providerApiKey: Server.secureSecret(cleanKey), // select:false — safe
                providerServerId: hs.providerServerId,
                ip:             secureIp.ip,
                ipHash:         secureIp.ipHash,
                isOnline:       hs.isOnline,
                specs:          hs.specs,
                lastChecked:    new Date(),
                geoCache: {
                  country: hs.country,
                  city:    hs.datacenter,
                },
                tags:  sanitiseTags(tags),
                notes: sanitise(notes, 500),
              },
              $setOnInsert: {
                userId: req.user._id,
              },
            },
            { upsert: true, new: true, runValidators: true }
          ).select('+ip');

          imported.push(serverDoc);
        } catch (e) {
          if (e?.code === 11000) {
            skippedDueToConflict += 1;
            continue;
          }
          throw e;
        }
      }

      if (!imported.length) {
        if (skippedDueToConflict > 0) {
          return res.status(409).json({
            error: 'Provider servers were found, but all conflicted with existing server IPs. Remove duplicates and retry.',
          });
        }
        return res.status(500).json({ error: 'No provider servers could be imported.' });
      }

      // Return first imported server for backward compatibility with current frontend.
      // Also include count so UI can optionally show "X servers imported".
      return res.status(201).json({
        server: Server.toPublicServer(imported[0]),
        importedCount: imported.length,
        skippedCount: skippedDueToConflict,
        importedServerIds: imported.map((s) => s._id),
      });
    }

    const server = await Server.create(serverData);

    // ── BUG FIX #6: Auto-probe without touching rate-limit key ────────────
    const serverIp = server.getIp();
    if (connectionType === 'custom' && serverIp) {
      setImmediate(async () => {
        try {
          const reach = await checkReachability(serverIp);
          const geo   = await fetchIpInfo(serverIp);
          const update = {
            isOnline:    reach.online,
            pingMs:      reach.pingMs,
            openPort:    reach.openPort,
            lastChecked: new Date(),
          };
          if (geo) update.geoCache = geoToCache(geo);
          await Server.findByIdAndUpdate(server._id, update);

          // Save initial snapshot
          await ServerSnapshot.create({
            serverId:  server._id,
            isOnline:  reach.online,
            pingMs:    reach.pingMs,
            checkedAt: new Date(),
          });
          // Cache geo but do NOT set rate limit key — auto-probe is free
          if (geo) await cache.set(`geo:${serverIp}`, geo, 600);
        } catch (e) {
          console.error('auto-probe error:', e.message);
        }
      });
    }

    res.status(201).json({ server: Server.toPublicServer(server) });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'A server with this IP already exists.' });
    console.error('create server error:', err);
    res.status(500).json({ error: 'Failed to add server.' });
  }
});

// ── GET /api/servers/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, userId: req.user._id })
      .select('+ip')
      .lean();
    if (!server) return res.status(404).json({ error: 'Server not found.' });

    // BUG FIX #8: patch isOnline for agent servers
    if (AGENT_TYPES.includes(server.connectionType)) {
      if (!server.agentInstalled) server.isOnline = null;
      else if (server.lastAgentPing) {
        server.isOnline = (Date.now() - new Date(server.lastAgentPing).getTime()) < AGENT_OFFLINE_THRESHOLD_MS;
      }
    }

    res.json({ server: Server.toPublicServer(server) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch server.' });
  }
});

// ── PUT /api/servers/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const server = await Server.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        name:  sanitise(req.body.name, 80),
        tags:  sanitiseTags(req.body.tags),
        notes: sanitise(req.body.notes, 500),
      },
      { new: true, runValidators: true }
    ).select('+ip');
    if (!server) return res.status(404).json({ error: 'Server not found.' });
    res.json({ server: Server.toPublicServer(server) });
  } catch {
    res.status(500).json({ error: 'Failed to update server.' });
  }
});

// ── DELETE /api/servers/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const server = await Server.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Server not found.' });
    await ServerSnapshot.deleteMany({ serverId: req.params.id });
    await cache.del(`stats:${req.params.id}`);
    await cache.del(`pro:${req.params.id}`);
    res.json({ message: 'Server deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete server.' });
  }
});

// ── POST /api/servers/:id/refresh ─────────────────────────────────────────────
router.post('/:id/refresh', async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, userId: req.user._id })
      .select('+providerApiKey +ip'); // explicitly include for refresh use

    if (!server) return res.status(404).json({ error: 'Server not found.' });

    // BUG FIX #6: rate-limit only applies to manual refresh (not auto-probe)
    const rlKey   = `rl:refresh:${req.params.id}`;
    const rlCount = await cache.incr(rlKey, 30);
    if (rlCount > 1) return res.status(429).json({ error: 'Wait 30 seconds between refreshes.' });

    // ── Custom IP ──────────────────────────────────────────────────────────
    if (server.connectionType === 'custom') {
      const serverIp = server.getIp();
      if (!serverIp) return res.status(400).json({ error: 'No IP address for this server.' });

      const reach = await checkReachability(serverIp);
      const geoKey = `geo:${serverIp}`;
      let geo = await cache.get(geoKey);
      if (!geo) { geo = await fetchIpInfo(serverIp); if (geo) await cache.set(geoKey, geo, 600); }

      server.isOnline    = reach.online;
      server.pingMs      = reach.pingMs;
      server.openPort    = reach.openPort;
      server.lastChecked = new Date();
      if (geo) server.geoCache = geoToCache(geo);
      await server.save();
      await ServerSnapshot.create({ serverId: server._id, isOnline: reach.online, pingMs: reach.pingMs });
    }

    // ── Provider API (Hetzner) ─────────────────────────────────────────────
    if (server.connectionType === 'api' && server.provider === 'hetzner') {
      // BUG FIX #3: guard against missing providerServerId
      if (!server.providerServerId) {
        return res.status(400).json({ error: 'Server has no provider ID. It may still be importing.' });
      }
      const providerKey = server.getProviderApiKey();
      if (!providerKey) {
        return res.status(400).json({ error: 'Provider API key is missing or unreadable.' });
      }
      const hs      = await getHetznerServer(providerKey, server.providerServerId);
      const metrics = await getHetznerMetrics(providerKey, server.providerServerId);

      server.isOnline    = hs.isOnline;
      server.lastChecked = new Date();
      server.specs       = { ...server.specs, ...hs.specs };
      if (metrics) {
        server.metrics = {
          ...server.metrics,
          cpuPercent: metrics.cpuPercent,
          netIn:      metrics.netIn,
          netOut:     metrics.netOut,
          updatedAt:  new Date(),
        };
      }
      await server.save();
      await ServerSnapshot.create({
        serverId:   server._id,
        isOnline:   hs.isOnline,
        cpuPercent: metrics?.cpuPercent ?? null,
      });
    }

    // ── Agent / Docker ─────────────────────────────────────────────────────
    // BUG FIX #8: don't mark as offline — show correct state based on lastAgentPing
    if (AGENT_TYPES.includes(server.connectionType)) {
      if (!server.agentInstalled) {
        // Agent never connected — return as-is (null = waiting)
        server.isOnline    = null;
        server.lastChecked = new Date();
      } else if (server.lastAgentPing) {
        const stale        = Date.now() - new Date(server.lastAgentPing).getTime() > AGENT_OFFLINE_THRESHOLD_MS;
        server.isOnline    = !stale;
        server.lastChecked = new Date();
      }
      await server.save();
    }

    // Re-fetch to return clean doc without select:false fields
    const fresh = await Server.findById(server._id).select('+ip').lean();
    res.json({ server: Server.toPublicServer(fresh) });
  } catch (err) {
    console.error('refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh.' });
  }
});

// ── GET /api/servers/:id/agent-setup ─────────────────────────────────────────
router.get('/:id/agent-setup', requirePro, async (req, res) => {
  try {
    // Explicitly include agentToken for this dedicated route only
    const server = await Server.findOne({ _id: req.params.id, userId: req.user._id })
      .select('+agentToken');

    if (!server) return res.status(404).json({ error: 'Server not found.' });
    if (!AGENT_TYPES.includes(server.connectionType))
      return res.status(400).json({ error: 'Not an agent server.' });

    const apiUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
    const script = server.connectionType === 'docker'
      ? generateDockerCompose(server.agentToken, apiUrl)
      : generateInstallScript(server.agentToken, apiUrl);

    res.json({ agentToken: server.agentToken, script, type: server.connectionType });
  } catch {
    res.status(500).json({ error: 'Failed to generate setup.' });
  }
});

// ── GET /api/servers/:id/pro-stats ────────────────────────────────────────────
router.get('/:id/pro-stats', requirePro, async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, userId: req.user._id }).select('+ip');
    if (!server) return res.status(404).json({ error: 'Server not found.' });

    if (!['custom', 'agent', 'docker', 'api'].includes(server.connectionType))
      return res.json({ ports: [], http: null, ssl: null });

    const ip = server.getIp();
    if (!ip) return res.status(400).json({ error: 'No IP address for this server.' });

    const cacheKey = `pro:${req.params.id}`;
    const cached   = await cache.get(cacheKey);
    if (cached) return res.json({ ...cached, fromCache: true });

    // BUG FIX #7: use reverse hostname if known, fallback gracefully to IP
    const sslTarget = server.geoCache?.reverse || ip;
    const [ports, http, ssl] = await Promise.all([
      scanPorts(ip),
      checkHTTP(ip),
      checkSSL(sslTarget),
    ]);

    const data = { ports, http, ssl, sslTarget };
    await cache.set(cacheKey, data, 300);
    res.json(data);
  } catch (err) {
    console.error('pro-stats error:', err);
    res.status(500).json({ error: 'Failed to fetch pro stats.' });
  }
});

// ── GET /api/servers/:id/uptime ───────────────────────────────────────────────
router.get('/:id/uptime', requirePro, async (req, res) => {
  try {
    const server = await Server.findOne({ _id: req.params.id, userId: req.user._id });
    if (!server) return res.status(404).json({ error: 'Server not found.' });

    const days  = req.user.plan === 'proplus' ? 30 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const snapshots = await ServerSnapshot.find({
      serverId:  server._id,
      checkedAt: { $gte: since },
    }).sort({ checkedAt: 1 }).lean();

    const total     = snapshots.length;
    const online    = snapshots.filter((s) => s.isOnline).length;
    const uptimePct = total > 0 ? ((online / total) * 100).toFixed(2) : null;

    res.json({ snapshots, total, online, uptimePct, days });
  } catch {
    res.status(500).json({ error: 'Failed to fetch uptime.' });
  }
});

// ── POST /api/servers/provider/hetzner/validate ───────────────────────────────
router.post('/provider/hetzner/validate', requireProPlus, async (req, res) => {
  try {
    const apiKey = sanitise(req.body.apiKey, 200);
    if (!apiKey) return res.status(400).json({ error: 'API key required.' });
    const result = await validateHetznerKey(apiKey);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Validation failed.' });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function geoToCache(geo) {
  return {
    country: geo.country, countryCode: geo.countryCode,
    regionName: geo.regionName, city: geo.city,
    isp: geo.isp, org: geo.org, as: geo.as, asname: geo.asname,
    lat: geo.lat, lon: geo.lon, timezone: geo.timezone,
    reverse: geo.reverse, hosting: geo.hosting,
    proxy: geo.proxy, mobile: geo.mobile,
  };
}

export default router;
