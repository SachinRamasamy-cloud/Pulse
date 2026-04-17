import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

const METHOD_META = {
  custom: { icon: '◎', label: 'Custom IP',    bg: 'bg-base-700 border-base-500 text-slate-400' },
  agent:  { icon: '⬡', label: 'Bash Agent',   bg: 'bg-pro/10 border-pro/25 text-pro-light'     },
  docker: { icon: '◈', label: 'Docker Agent', bg: 'bg-pro/10 border-pro/25 text-pro-light'     },
  api:    { icon: '⊕', label: 'Provider API', bg: 'bg-amber-500/10 border-amber-500/25 text-amber-400' },
};

const PROVIDER_LABELS = {
  hetzner: 'Hetzner', digitalocean: 'DigitalOcean', vultr: 'Vultr', linode: 'Linode',
};

function fmt(bytes) {
  if (bytes == null) return null;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)}MB`;
  return `${Math.round(bytes / 1e3)}KB`;
}

function MiniBar({ pct, color = '#00e5a0' }) {
  const danger = pct > 85;
  const warn   = pct > 70;
  return (
    <div className="h-1 w-full bg-base-700 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct ?? 0, 100)}%`,
          background: danger ? '#f87171' : warn ? '#fb923c' : color }} />
    </div>
  );
}

function age(date) {
  if (!date) return 'Never';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getFlagEmoji(code) {
  if (!code) return '';
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

export default function ServerCard({ server, onDelete, onRefresh, refreshing }) {
  const meta    = METHOD_META[server.connectionType] || METHOD_META.custom;
  const geo     = server.geoCache;
  const m       = server.metrics;
  const isAgent = server.connectionType === 'agent' || server.connectionType === 'docker';
  const isApi   = server.connectionType === 'api';

  // Metrics are "live" if updated within 2 minutes
  const hasLiveMetrics = m?.updatedAt && (Date.now() - new Date(m.updatedAt).getTime()) < 120_000;
  const ramPct  = hasLiveMetrics && m.ramTotal  ? Math.round((m.ramUsed  / m.ramTotal)  * 100) : null;
  const diskPct = hasLiveMetrics && m.diskTotal ? Math.round((m.diskUsed / m.diskTotal) * 100) : null;

  return (
    <div className="card-hover p-5 flex flex-col gap-3 animate-fade-in">

      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-ui font-semibold text-white text-sm truncate">{server.name}</h3>
            {server.provider && (
              <span className="text-[10px] font-mono text-amber-400">{PROVIDER_LABELS[server.provider]}</span>
            )}
          </div>
          <p className="font-mono text-xs text-neon mt-0.5 truncate">{server.ip || '—'}</p>
        </div>
        {/* BUG FIX #8: pass agentInstalled to StatusBadge */}
        <StatusBadge
          online={server.isOnline}
          pingMs={server.pingMs}
          connectionType={server.connectionType}
          agentInstalled={server.agentInstalled}
        />
      </div>

      {/* Method badge + location */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono ${meta.bg}`}>
          {meta.icon} {meta.label}
        </span>
        {geo?.countryCode && (
          <span className="text-[10px] text-slate-500">
            {getFlagEmoji(geo.countryCode)} {geo.city || geo.country}
          </span>
        )}
      </div>

      {/* Live metrics for agent/api/docker */}
      {(isAgent || isApi) && (
        <div className="space-y-2">
          {hasLiveMetrics ? (
            <>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center text-slate-500">
                <span>CPU</span><span>RAM</span><span>Disk</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-center">
                <span className={m.cpuPercent > 85 ? 'text-red-400' : m.cpuPercent > 70 ? 'text-amber-400' : 'text-neon'}>
                  {m.cpuPercent != null ? `${Math.round(m.cpuPercent)}%` : '—'}
                </span>
                <span className={ramPct > 85 ? 'text-red-400' : ramPct > 70 ? 'text-amber-400' : 'text-neon'}>
                  {ramPct != null ? `${ramPct}%` : '—'}
                </span>
                <span className={diskPct > 85 ? 'text-red-400' : diskPct > 70 ? 'text-amber-400' : 'text-neon'}>
                  {diskPct != null ? `${diskPct}%` : '—'}
                </span>
              </div>
              <MiniBar pct={m.cpuPercent} />
              <MiniBar pct={ramPct}  color="#22d3ee" />
              <MiniBar pct={diskPct} color="#7c3aed" />
              {m.ramTotal && (
                <p className="text-[10px] text-slate-600 font-mono">
                  {fmt(m.ramUsed)} / {fmt(m.ramTotal)} RAM · load {m.loadAvg1 ?? '—'}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 px-3 bg-base-900 border border-base-700 rounded-lg">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${server.agentInstalled ? 'bg-amber-500' : 'bg-pro-light animate-pulse-dot'}`} />
              <p className="text-[10px] text-slate-600 font-mono">
                {!server.agentInstalled
                  ? isApi ? 'Click Refresh to load API data' : 'Run install script → Details'
                  : 'Agent not reporting — check if running'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Geo line for custom */}
      {server.connectionType === 'custom' && geo?.isp && (
        <p className="text-[10px] text-slate-500 font-mono truncate">{geo.isp}</p>
      )}

      {/* Tags */}
      {server.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {server.tags.slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-base-700 border border-base-600 rounded text-[10px] font-mono text-slate-500">{t}</span>
          ))}
          {server.tags.length > 3 && <span className="text-[10px] text-slate-600">+{server.tags.length - 3}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-base-700 mt-auto">
        <span className="text-[10px] text-slate-600 font-mono">{age(server.lastChecked)}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onRefresh(server._id)} disabled={refreshing} title="Refresh"
            className="btn-ghost p-1.5 rounded text-slate-500 hover:text-neon disabled:opacity-40">
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <Link to={`/servers/${server._id}`} className="btn-outline px-2.5 py-1 text-xs">Details →</Link>
          <button onClick={() => onDelete(server._id)} title="Delete"
            className="btn-ghost p-1.5 rounded text-slate-500 hover:text-red-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
