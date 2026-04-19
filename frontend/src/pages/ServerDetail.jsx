import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { serverAPI } from '../utils/api';
import StatusBadge    from '../components/StatusBadge';
import MetricsGauges  from '../components/MetricsGauges';
import AgentSetupPanel from '../components/AgentSetupPanel';
import PortTable      from '../components/PortTable';
import UptimeBar      from '../components/UptimeBar';
import ProGate        from '../components/ProGate';
import LoadingSpinner from '../components/LoadingSpinner';

const METHOD_META = {
  custom: { icon: '◎', label: 'Custom IP',    color: 'text-slate-400' },
  agent:  { icon: '⬡', label: 'Bash Agent',   color: 'text-pro-light' },
  docker: { icon: '◈', label: 'Docker Agent', color: 'text-pro-light' },
  api:    { icon: '⊕', label: 'Provider API', color: 'text-amber-400' },
};

const PROVIDER_LABELS = { hetzner: 'Hetzner', digitalocean: 'DigitalOcean', vultr: 'Vultr', linode: 'Linode' };

function Section({ title, badge, icon, children, className = '' }) {
  return (
    <div className={`card p-5 space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        <h2 className="font-ui font-semibold text-white text-sm">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false, copyable = false }) {
  const [copied, setCopied] = useState(false);
  if (!value && value !== 0) return null;
  const copy = () => { navigator.clipboard.writeText(String(value)); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-base-700 last:border-0">
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm text-right break-all ${mono ? 'font-mono text-neon' : 'text-slate-200'}`}>{value}</span>
        {copyable && (
          <button onClick={copy} className="text-[10px] text-slate-600 hover:text-neon transition-colors flex-shrink-0">
            {copied ? '✓' : '⧉'}
          </button>
        )}
      </div>
    </div>
  );
}

function getFlagEmoji(code) {
  if (!code) return '';
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('');
}

function fmtBytes(b) {
  if (b == null) return null;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${Math.round(b / 1e3)} KB`;
}

export default function ServerDetail() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [server,     setServer]     = useState(null);
  const [proStats,   setProStats]   = useState(null);
  const [uptime,     setUptime]     = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proLoading, setProLoading] = useState(false);
  const [activeTab,  setActiveTab]  = useState('overview');
  const [error,      setError]      = useState('');
  const pollRef = useRef(null);

  const plan       = user?.plan || 'free';
  const isPro      = plan === 'pro' || plan === 'proplus';
  const isProPlus  = plan === 'proplus';

  const fetchServer = useCallback(async () => {
    try {
      const { data } = await serverAPI.get(id);
      setServer(data.server);
    } catch { setError('Server not found.'); }
    finally   { setLoading(false); }
  }, [id]);

  const fetchProData = useCallback(async () => {
    if (!isPro) return;
    setProLoading(true);
    try {
      const [s, u] = await Promise.all([serverAPI.proStats(id), serverAPI.uptime(id)]);
      setProStats(s.data);
      setUptime(u.data);
    } catch {}
    finally { setProLoading(false); }
  }, [id, isPro]);

  useEffect(() => { fetchServer(); }, [fetchServer]);

  useEffect(() => {
    if (!server) return;
    fetchProData();
    // Poll agent/api servers every 15s for live metrics
    if (server.connectionType === 'agent' || server.connectionType === 'docker' || server.connectionType === 'api') {
      pollRef.current = setInterval(fetchServer, 15000);
    }
    return () => clearInterval(pollRef.current);
  }, [server?.connectionType, fetchProData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await serverAPI.refresh(id);
      setServer(data.server);
      if (isPro) await fetchProData();
    } catch (err) { alert(err.response?.data?.error || 'Refresh failed.'); }
    finally { setRefreshing(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this server?')) return;
    await serverAPI.remove(id);
    navigate('/dashboard');
  };

  if (loading) return <div className="min-h-screen bg-base-950 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error)   return <div className="min-h-screen bg-base-950 flex items-center justify-center"><p className="text-red-400">{error}</p></div>;

  const geo    = server.geoCache;
  const meta   = METHOD_META[server.connectionType] || METHOD_META.custom;
  const specs  = server.specs;
  const isAgent = server.connectionType === 'agent' || server.connectionType === 'docker';
  const isApi   = server.connectionType === 'api';
  const isCustom = server.connectionType === 'custom';
  const hasMetrics = server.metrics?.updatedAt;

  // Tabs: overview always; setup for agent/docker; probe for all server types
  const tabs = [
    { id: 'overview',  label: 'Overview' },
    ...(isAgent ? [{ id: 'setup', label: 'Agent Setup' }] : []),
    { id: 'probe', label: 'Port Scan & SSL' },
    { id: 'uptime', label: 'Uptime' },
  ];

  return (
    <div className="min-h-screen bg-base-950 bg-grid">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-6 font-mono">
          <Link to="/dashboard" className="text-slate-500 hover:text-neon transition-colors">← Fleet</Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 truncate">{server.name}</span>
        </div>

        {/* ── Hero card ───────────────────────────────────────────────────── */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-ui font-bold text-xl text-white truncate">{server.name}</h1>
                <StatusBadge online={server.isOnline} pingMs={server.pingMs} />
              </div>

              {/* Connection type badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono
                  ${isApi ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    : isAgent ? 'bg-pro/10 border-pro/25 text-pro-light'
                    : 'bg-base-700 border-base-500 text-slate-400'}`}>
                  <span className="text-sm">{meta.icon}</span>
                  {meta.label}
                  {server.provider && ` — ${PROVIDER_LABELS[server.provider]}`}
                </span>
                {server.ip && <span className="font-mono text-neon text-sm">{server.ip}</span>}
                {geo?.reverse && <span className="font-mono text-slate-500 text-xs">{geo.reverse}</span>}
              </div>

              {/* Live metrics summary */}
              {hasMetrics && (
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  {[
                    { label: 'CPU', value: server.metrics.cpuPercent != null ? `${Math.round(server.metrics.cpuPercent)}%` : null },
                    { label: 'RAM', value: server.metrics.ramTotal ? `${Math.round((server.metrics.ramUsed/server.metrics.ramTotal)*100)}%` : null },
                    { label: 'Disk', value: server.metrics.diskTotal ? `${Math.round((server.metrics.diskUsed/server.metrics.diskTotal)*100)}%` : null },
                    { label: 'Uptime', value: server.metrics.uptimeSeconds ? formatUptime(server.metrics.uptimeSeconds) : null },
                  ].filter(x => x.value).map(({ label, value }) => (
                    <span key={label} className="text-xs font-mono text-slate-400">
                      {label}: <span className="text-neon">{value}</span>
                    </span>
                  ))}
                  <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse-dot ml-1" title="Live" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleRefresh} disabled={refreshing} className="btn-outline gap-2">
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                {refreshing ? 'Checking…' : 'Refresh'}
              </button>
              <button onClick={handleDelete} className="btn-danger">Delete</button>
            </div>
          </div>

          {/* Tags */}
          {server.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-base-600">
              {server.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 bg-base-700 border border-base-500 rounded text-xs font-mono text-slate-400">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-base-600 mb-6 overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-ui font-medium whitespace-nowrap border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-neon text-neon'
                  : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Live Metrics (agent / api / docker) */}
            {!isCustom && (
              <Section title="Live Metrics" icon={meta.icon} className="lg:col-span-2">
                {hasMetrics ? (
                  <MetricsGauges metrics={server.metrics} />
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-slate-500 text-sm">
                      {isAgent ? 'No metrics yet — run the agent install script on your server.' : 'No metrics yet — click Refresh.'}
                    </p>
                    {isAgent && (
                      <button onClick={() => setActiveTab('setup')} className="btn-outline text-xs">
                        View install instructions →
                      </button>
                    )}
                  </div>
                )}
              </Section>
            )}

            {/* Server Specs */}
            {(specs?.cpuCores || specs?.ramTotal || specs?.os) && (
              <Section title="Server Specs" icon="▣">
                <InfoRow label="Type"      value={specs.serverType} mono />
                <InfoRow label="OS"        value={specs.os} />
                <InfoRow label="Kernel"    value={specs.kernel} mono />
                <InfoRow label="CPU"       value={specs.cpuModel || (specs.cpuCores ? `${specs.cpuCores} vCPU` : null)} />
                <InfoRow label="RAM"       value={fmtBytes(specs.ramTotal)} />
                <InfoRow label="Disk"      value={fmtBytes(specs.diskTotal)} />
                <InfoRow label="Arch"      value={specs.arch} />
              </Section>
            )}

            {/* Location & Network */}
            <Section title="Location & Network" icon="⊙">
              {geo?.country ? (
                <>
                  <InfoRow label="Country"   value={`${getFlagEmoji(geo.countryCode)} ${geo.country}`} />
                  <InfoRow label="City"       value={[geo.city, geo.regionName].filter(Boolean).join(', ')} />
                  <InfoRow label="ISP"        value={geo.isp} mono />
                  <InfoRow label="Org"        value={geo.org} />
                  <InfoRow label="ASN"        value={geo.as} mono />
                  <InfoRow label="Timezone"   value={geo.timezone} />
                  <InfoRow label="Coords"     value={geo.lat != null ? `${geo.lat}, ${geo.lon}` : null} mono />
                  <div className="flex gap-2 pt-1">
                    {geo.hosting && <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">Datacenter</span>}
                    {geo.proxy   && <span className="badge bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">Proxy/VPN</span>}
                    {geo.mobile  && <span className="badge bg-green-500/10 text-green-400 border border-green-500/20 text-xs">Mobile</span>}
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-sm">Click Refresh to load location data.</p>
              )}
            </Section>

            {/* Connection */}
            <Section title="Connection" icon="◉">
              <InfoRow label="IP Address"   value={server.ip}       mono copyable />
              <InfoRow label="Hostname"     value={geo?.reverse}    mono copyable />
              <InfoRow label="Ping"         value={server.pingMs != null ? `${server.pingMs}ms` : null} mono />
              <InfoRow label="Open Port"    value={server.openPort} mono />
              <InfoRow label="Last Checked" value={server.lastChecked ? new Date(server.lastChecked).toLocaleString() : null} />
              <InfoRow label="Added"        value={new Date(server.createdAt).toLocaleDateString()} />
              {server.notes && (
                <div className="pt-2">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Notes</p>
                  <p className="text-sm text-slate-400 bg-base-900 rounded px-3 py-2 border border-base-600">{server.notes}</p>
                </div>
              )}
            </Section>

            {/* Agent health (for agent servers) */}
            {isAgent && (
              <Section title="Agent Health" icon="⬡">
                <InfoRow label="Last Ping"
                  value={server.lastAgentPing ? new Date(server.lastAgentPing).toLocaleString() : 'Never'} />
                <InfoRow label="Status"
                  value={server.lastAgentPing && (Date.now() - new Date(server.lastAgentPing).getTime()) < 60000
                    ? 'Reporting ✓' : 'Not reporting'} />
                <InfoRow label="Agent Type"  value={server.connectionType === 'docker' ? 'Docker container' : 'Bash systemd service'} />
                <InfoRow label="Report interval" value="30 seconds" />
                <div className="pt-2">
                  <button onClick={() => setActiveTab('setup')} className="btn-outline text-xs w-full justify-center">
                    View / regenerate install script →
                  </button>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: AGENT SETUP
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'setup' && isAgent && (
          <div className="max-w-2xl">
            <Section title="Agent Installation" icon={meta.icon}>
              <AgentSetupPanel serverId={id} connectionType={server.connectionType} />
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: PORT SCAN & SSL
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'probe' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Port Scanner */}
            <div className="lg:col-span-2">
              <Section title="Port Scanner" badge={<span className="badge-pro text-xs">Pro</span>} icon="⊞">
                {isPro ? (
                  proLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  : proStats?.ports ? <PortTable ports={proStats.ports} />
                  : <p className="text-slate-500 text-sm">Click Refresh to run a port scan.</p>
                ) : (
                  <ProGate label="Full Port Scanner — 25 ports">
                    <PortTable ports={[
                      { port: 22, open: true, service: 'SSH', latencyMs: 12 },
                      { port: 80, open: true, service: 'HTTP', latencyMs: 8 },
                      { port: 443, open: true, service: 'HTTPS', latencyMs: 9 },
                    ]} />
                  </ProGate>
                )}
              </Section>
            </div>

            {/* SSL */}
            <Section title="SSL Certificate" badge={<span className="badge-pro text-xs">Pro</span>} icon="⊛">
              {isPro ? (
                proLoading ? <div className="flex justify-center py-6"><LoadingSpinner /></div>
                : proStats?.ssl?.valid ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`badge text-xs ${proStats.ssl.daysLeft > 14 ? 'badge-online' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {proStats.ssl.expired ? 'Expired' : `${proStats.ssl.daysLeft}d left`}
                      </span>
                    </div>
                    <InfoRow label="Issuer"    value={proStats.ssl.issuer} />
                    <InfoRow label="Subject"   value={proStats.ssl.subject} mono />
                    <InfoRow label="Valid From" value={proStats.ssl.validFrom} />
                    <InfoRow label="Expires"   value={proStats.ssl.validTo} />
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">{proStats?.ssl ? 'No SSL on port 443.' : 'Click Refresh to check SSL.'}</p>
                )
              ) : (
                <ProGate label="SSL Certificate Inspector">
                  <div><InfoRow label="Issuer" value="Let's Encrypt" /><InfoRow label="Expires" value="89 days" /></div>
                </ProGate>
              )}
            </Section>

            {/* HTTP Headers */}
            <Section title="HTTP Response" badge={<span className="badge-pro text-xs">Pro</span>} icon="⊡">
              {isPro ? (
                proLoading ? <div className="flex justify-center py-6"><LoadingSpinner /></div>
                : proStats?.http ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`badge text-xs font-mono ${proStats.http.statusCode < 400 ? 'badge-online' : 'badge-offline'}`}>
                        HTTP {proStats.http.statusCode}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{proStats.http.responseTimeMs}ms</span>
                    </div>
                    <InfoRow label="Server"       value={proStats.http.server} mono />
                    <InfoRow label="Powered By"   value={proStats.http.poweredBy} />
                    <InfoRow label="Content-Type" value={proStats.http.contentType} />
                    {proStats.http.redirectTo && <InfoRow label="Redirects To" value={proStats.http.redirectTo} mono />}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No HTTP response on port 80.</p>
                )
              ) : (
                <ProGate label="HTTP Response Headers">
                  <div><InfoRow label="Server" value="nginx/1.24" /><InfoRow label="Status" value="200 OK" /></div>
                </ProGate>
              )}
            </Section>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: UPTIME
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'uptime' && (
          <div className="space-y-5">
            <Section title={`Uptime History (${isProPlus ? '30' : '7'} days)`}
              badge={<span className="badge-pro text-xs">Pro</span>}>
              {isPro ? (
                proLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div>
                : uptime ? (
                  <UptimeBar snapshots={uptime.snapshots} uptimePct={uptime.uptimePct} days={uptime.days} />
                ) : (
                  <p className="text-slate-500 text-sm">No uptime data yet. Refresh the server to start collecting.</p>
                )
              ) : (
                <ProGate label="7-day uptime history chart">
                  <UptimeBar snapshots={[]} uptimePct={null} />
                </ProGate>
              )}
            </Section>

            {isPro && !isProPlus && (
              <div className="card p-4 border-amber-500/20 bg-amber-500/5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white font-semibold">Pro Plus — 30-day history</p>
                  <p className="text-xs text-slate-400 mt-0.5">Upgrade for 30-day uptime charts + real-time metrics from Provider APIs.</p>
                </div>
                <Link to="/pricing" className="btn-outline text-xs flex-shrink-0 border-amber-500/30 text-amber-400 hover:border-amber-400">
                  Upgrade
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Upgrade CTA (free users) ──────────────────────────────────── */}
        {!isPro && (
          <div className="mt-6 card p-5 border-pro/25 bg-gradient-to-r from-pro/5 to-transparent flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1">
              <p className="font-ui font-semibold text-white text-sm">Unlock full server intelligence</p>
              <p className="text-slate-400 text-xs mt-1">Port scanner, SSL check, HTTP headers, 7-day uptime, Bash &amp; Docker agents.</p>
            </div>
            <Link to="/pricing" className="btn-pro text-sm flex-shrink-0">⬡ Upgrade to Pro</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
