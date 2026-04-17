import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { serverAPI } from '../utils/api';
import ServerCard     from '../components/ServerCard';
import AddServerModal from '../components/AddServerModal';
import LoadingSpinner from '../components/LoadingSpinner';

const PLAN_LIMITS = { free: 3, pro: 20, proplus: Infinity };
const METHOD_FILTER_OPTIONS = [
  { value: 'all',    label: 'All methods' },
  { value: 'custom', label: '◎ Custom IP' },
  { value: 'agent',  label: '⬡ Bash Agent' },
  { value: 'docker', label: '◈ Docker' },
  { value: 'api',    label: '⊕ Provider API' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [servers,    setServers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [filter,     setFilter]     = useState('all');
  const [error,      setError]      = useState('');

  const fetchServers = useCallback(async () => {
    try {
      const { data } = await serverAPI.list();
      setServers(data.servers);
    } catch { setError('Failed to load servers.'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  // Auto-refresh agent/api servers every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setServers((prev) =>
        prev.map((s) => {
          if ((s.connectionType === 'agent' || s.connectionType === 'docker') && s.metrics?.updatedAt) {
            return { ...s, _refreshedAt: Date.now() };
          }
          return s;
        })
      );
      fetchServers();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchServers]);

  const handleRefresh = async (id) => {
    setRefreshing((r) => ({ ...r, [id]: true }));
    try {
      const { data } = await serverAPI.refresh(id);
      setServers((prev) => prev.map((s) => s._id === id ? data.server : s));
    } catch (err) { alert(err.response?.data?.error || 'Refresh failed.'); }
    finally       { setRefreshing((r) => ({ ...r, [id]: false })); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this server?')) return;
    try {
      await serverAPI.remove(id);
      setServers((prev) => prev.filter((s) => s._id !== id));
    } catch { alert('Failed to delete.'); }
  };

  const plan      = user?.plan || 'free';
  const limit     = PLAN_LIMITS[plan] ?? 3;
  const atLimit   = servers.length >= limit && plan !== 'proplus';

  const filtered  = filter === 'all' ? servers : servers.filter((s) => s.connectionType === filter);
  const online    = servers.filter((s) => s.isOnline === true).length;
  const offline   = servers.filter((s) => s.isOnline === false).length;
  const hasAgent  = servers.some((s) => s.connectionType === 'agent' || s.connectionType === 'docker');
  const hasApi    = servers.some((s) => s.connectionType === 'api');

  return (
    <div className="min-h-screen bg-base-950 bg-grid">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-ui font-bold text-2xl text-white">Server Fleet</h1>
            <p className="text-slate-400 text-sm mt-1">
              Welcome back, <span className="text-neon">{user?.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {plan === 'free' && (
              <Link to="/pricing" className="btn-outline text-xs gap-1.5 hidden sm:flex">
                <span className="text-amber-400">↑</span> Unlock agents &amp; APIs
              </Link>
            )}
            <button className="btn-primary" onClick={() => setShowModal(true)}
              disabled={atLimit} title={atLimit ? `${plan} plan limit reached` : ''}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Add Server
            </button>
          </div>
        </div>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {servers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total',   value: servers.length,                       color: 'text-slate-200' },
              { label: 'Online',  value: online,                                color: 'text-cyan-400'  },
              { label: 'Offline', value: offline,                               color: 'text-red-400'   },
              { label: 'Unknown', value: servers.length - online - offline,     color: 'text-slate-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-3 text-center">
                <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Method pills (shown when multiple types exist) ─────────────── */}
        {servers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-5">
            {METHOD_FILTER_OPTIONS.map(({ value, label }) => (
              <button key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-all
                  ${filter === value
                    ? 'bg-neon/10 border-neon text-neon'
                    : 'border-base-600 text-slate-500 hover:border-base-400 hover:text-slate-300'}`}>
                {label}
              </button>
            ))}
            <span className="text-slate-600 text-xs font-mono ml-auto hidden sm:block">
              {filtered.length} server{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ── Plan limit banner ───────────────────────────────────────────── */}
        {plan !== 'proplus' && servers.length > 0 && (
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 mb-5 border
            ${atLimit
              ? 'bg-red-500/10 border-red-500/25'
              : 'bg-base-800 border-base-600'}`}>
            <p className="text-sm text-slate-300">
              <span className={`font-semibold ${atLimit ? 'text-red-400' : 'text-slate-200'}`}>
                {plan === 'free' ? 'Free' : 'Pro'} plan
              </span>
              {' — '}{servers.length} / {limit === Infinity ? '∞' : limit} servers used.
              {atLimit && <span className="text-red-400"> Limit reached.</span>}
            </p>
            <Link to="/pricing"
              className={`text-xs flex-shrink-0 px-3 py-1.5 rounded-lg font-ui font-medium transition-colors
                ${atLimit
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'btn-ghost text-slate-400'}`}>
              {plan === 'free' ? 'Upgrade to Pro' : 'Go Pro Plus'}
            </Link>
          </div>
        )}

        {/* ── Agent onboarding hints ──────────────────────────────────────── */}
        {hasAgent && servers.some((s) => (s.connectionType === 'agent' || s.connectionType === 'docker') && !s.lastAgentPing) && (
          <div className="bg-pro/8 border border-pro/20 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-pro-light text-lg">⬡</span>
            <div className="flex-1">
              <p className="text-sm text-slate-300 font-semibold">Agent not reporting yet</p>
              <p className="text-xs text-slate-500 mt-0.5">Click <strong className="text-slate-300">Details</strong> on an agent server to get the install command.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5 text-red-400 text-sm">{error}</div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
        ) : servers.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-base-800 border border-base-600 flex items-center justify-center scan-container">
              <div className="scan-line" />
              <svg className="w-7 h-7 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-ui font-semibold text-lg">No servers yet</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                Add your first server. Choose from Custom IP (free), Bash Agent, Docker Agent, or Provider API.
              </p>
            </div>

            {/* Method tiles in empty state */}
            <div className="grid grid-cols-2 gap-3 max-w-md w-full text-left">
              {[
                { icon: '◎', label: 'Custom IP',    desc: 'Any public IP, instant geo + ping', plan: 'Free' },
                { icon: '⬡', label: 'Bash Agent',   desc: 'Real CPU, RAM, disk via one command', plan: 'Pro+' },
                { icon: '◈', label: 'Docker Agent', desc: 'Same metrics, containerised', plan: 'Pro+' },
                { icon: '⊕', label: 'Provider API', desc: 'Auto-discover Hetzner, DO, Vultr…', plan: 'Pro Plus' },
              ].map(({ icon, label, desc, plan: p }) => (
                <div key={label}
                  className="card p-3 border-base-600 hover:border-base-400 cursor-pointer transition-colors"
                  onClick={() => setShowModal(true)}>
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-neon text-base">{icon}</span>
                    <span className="text-[10px] font-mono text-slate-600">{p}</span>
                  </div>
                  <p className="text-white text-xs font-semibold">{label}</p>
                  <p className="text-slate-600 text-[10px] mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            <button className="btn-primary mt-2" onClick={() => setShowModal(true)}>
              <span>+</span> Add your first server
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((server) => (
              <ServerCard
                key={server._id}
                server={server}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                refreshing={!!refreshing[server._id]}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddServerModal
          onClose={() => setShowModal(false)}
          onAdded={(s, importedCount = 1) => {
            // Provider API can import multiple servers in one request.
            // Reload full list to avoid showing only the first imported server.
            if (importedCount > 1) {
              fetchServers();
              return;
            }
            if (s) setServers((p) => [s, ...p]);
          }}
        />
      )}
    </div>
  );
}
