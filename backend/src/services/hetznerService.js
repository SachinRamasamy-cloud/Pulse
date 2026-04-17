import fetch from 'node-fetch';

const BASE = 'https://api.hetzner.cloud/v1';

const hetznerFetch = async (apiKey, path) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 8000,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Hetzner API error ${res.status}`);
  }
  return res.json();
};

/**
 * Validate API key and return account info
 */
export async function validateHetznerKey(apiKey) {
  try {
    // List servers — if it works, key is valid
    const data = await hetznerFetch(apiKey, '/servers?per_page=1');
    return { valid: true, serverCount: data.meta?.pagination?.total_entries ?? 0 };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * List all servers in the account
 */
export async function listHetznerServers(apiKey) {
  const data = await hetznerFetch(apiKey, '/servers?per_page=50');
  return data.servers.map(normalizeServer);
}

/**
 * Get a single server by provider ID
 */
export async function getHetznerServer(apiKey, serverId) {
  const data = await hetznerFetch(apiKey, `/servers/${serverId}`);
  return normalizeServer(data.server);
}

/**
 * Get live CPU / network metrics for last 5 minutes
 */
export async function getHetznerMetrics(apiKey, serverId) {
  const end   = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);

  try {
    const data = await hetznerFetch(
      apiKey,
      `/servers/${serverId}/metrics?type=cpu,disk,network` +
        `&start=${start.toISOString()}&end=${end.toISOString()}&step=60`
    );

    const ts = data.metrics?.time_series;
    const last = (key) => {
      const series = ts?.[key]?.values;
      if (!series?.length) return null;
      return parseFloat(series[series.length - 1][1]);
    };

    return {
      cpuPercent: last('cpu'),
      netIn:      last('network.0.bandwidth.in'),
      netOut:     last('network.0.bandwidth.out'),
      diskRead:   last('disk.0.iops.read'),
      diskWrite:  last('disk.0.iops.write'),
    };
  } catch {
    return null;
  }
}

// ── Normalise Hetzner server shape ──────────────────────────────────────────
function normalizeServer(s) {
  return {
    providerServerId: String(s.id),
    name:             s.name,
    ip:               s.public_net?.ipv4?.ip || null,
    isOnline:         s.status === 'running',
    status:           s.status, // running | off | initializing | starting | stopping | rebuilding
    specs: {
      cpuCores:   s.server_type?.cores,
      ramTotal:   s.server_type?.memory * 1024 * 1024 * 1024, // GB → bytes
      diskTotal:  s.server_type?.disk  * 1024 * 1024 * 1024,  // GB → bytes
      serverType: s.server_type?.name,
      os:         s.image?.description || null,
      arch:       s.server_type?.architecture || 'x86',
    },
    datacenter: s.datacenter?.location?.city || null,
    country:    s.datacenter?.location?.country || null,
    createdAt:  s.created,
    labels:     s.labels || {},
  };
}
