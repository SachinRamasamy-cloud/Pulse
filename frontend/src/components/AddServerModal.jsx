import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { serverAPI } from '../utils/api';

const METHODS = [
  {
    id: 'custom',
    icon: '◎',
    label: 'Custom IP',
    badge: 'Free',
    badgeClass: 'badge-free',
    desc: 'External probe — ping, geo, ISP, port scan, SSL.',
    plan: 'free',
  },
  {
    id: 'agent',
    icon: '⬡',
    label: 'Bash Agent',
    badge: 'Pro+',
    badgeClass: 'badge-pro',
    desc: 'Install a one-line script. Get real CPU, RAM, disk, load average.',
    plan: 'pro',
  },
  {
    id: 'docker',
    icon: '◈',
    label: 'Docker Agent',
    badge: 'Pro+',
    badgeClass: 'badge-pro',
    desc: 'Run a single container. Same real metrics, no root needed.',
    plan: 'pro',
  },
  {
    id: 'api',
    icon: '⊕',
    label: 'Provider API',
    badge: 'Pro Plus',
    badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    desc: 'Connect Hetzner, DigitalOcean, Vultr — auto-discover all servers.',
    plan: 'proplus',
  },
];

const PROVIDERS = [
  { id: 'hetzner',      label: 'Hetzner',       docs: 'https://docs.hetzner.com/cloud/api/getting-started/generating-api-token/' },
];

export default function AddServerModal({ onClose, onAdded }) {
  const { user } = useAuth();
  const [method, setMethod]   = useState('custom');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [validating, setValidating] = useState(false);
  const [apiValid,   setApiValid]   = useState(null); // null | true | false

  const [form, setForm] = useState({
    name: '', ip: '', tags: '', notes: '',
    provider: 'hetzner', providerApiKey: '',
  });

  const set  = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const plan = user?.plan || 'free';
  const canAccess = (requiredPlan) => {
    if (requiredPlan === 'free')    return true;
    if (requiredPlan === 'pro')     return plan === 'pro' || plan === 'proplus';
    if (requiredPlan === 'proplus') return plan === 'proplus';
    return false;
  };

  const validateApiKey = async () => {
    if (!form.providerApiKey) return;
    setValidating(true);
    setApiValid(null);
    try {
      const { data } = await serverAPI.validateHetzner(form.providerApiKey);
      setApiValid(data.valid);
      if (data.valid && !form.name) {
        setForm((p) => ({ ...p, name: `${PROVIDERS.find(p => p.id === form.provider)?.label} Account` }));
      }
    } catch {
      setApiValid(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Server name is required.'); return; }
    if (method === 'custom' && !form.ip.trim()) { setError('IP address is required.'); return; }
    if (method === 'api' && !form.providerApiKey.trim()) { setError('API key is required.'); return; }

    setLoading(true);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        name:           form.name.trim(),
        connectionType: method,
        tags,
        notes: form.notes,
        ...(method === 'custom' && { ip: form.ip.trim() }),
        ...(method === 'agent'  && { ip: form.ip.trim() }),
        ...(method === 'api'    && { provider: form.provider, providerApiKey: form.providerApiKey }),
      };
      const { data } = await serverAPI.create(payload);
      onAdded(data.server, data.importedCount || 1, data.skippedCount || 0);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add server.');
    } finally {
      setLoading(false);
    }
  };

  const selectedMethod = METHODS.find((m) => m.id === method);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card p-0 animate-slide-up overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-base-600 flex-shrink-0">
          <div>
            <h2 className="font-ui font-semibold text-white text-lg">Add Server</h2>
            <p className="text-slate-500 text-xs mt-0.5">Choose how to connect</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-2 gap-2 p-4 border-b border-base-600 flex-shrink-0">
          {METHODS.map((m) => {
            const accessible = canAccess(m.plan);
            return (
              <button
                key={m.id}
                onClick={() => accessible && setMethod(m.id)}
                className={`relative text-left p-3 rounded-lg border transition-all duration-150
                  ${method === m.id
                    ? 'border-neon bg-neon/8'
                    : accessible
                      ? 'border-base-600 hover:border-base-400 bg-base-800 cursor-pointer'
                      : 'border-base-700 bg-base-900 opacity-50 cursor-not-allowed'}`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span className={`text-lg ${method === m.id ? 'text-neon' : 'text-slate-500'}`}>{m.icon}</span>
                  <span className={`badge text-[10px] px-1.5 py-0 ${m.badgeClass}`}>{m.badge}</span>
                </div>
                <p className={`font-ui font-semibold text-xs ${method === m.id ? 'text-white' : 'text-slate-400'}`}>{m.label}</p>
                <p className="text-slate-600 text-[10px] mt-0.5 leading-tight">{m.desc}</p>
                {!accessible && (
                  <div className="absolute inset-0 rounded-lg flex items-center justify-center">
                    <Link to="/pricing" onClick={onClose}
                      className="text-[10px] font-mono text-pro-light hover:underline z-10">
                      Upgrade →
                    </Link>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Name — always */}
          <div>
            <label className="label">Server Name</label>
            <input className="input" placeholder="e.g. Production API — Frankfurt"
              value={form.name} onChange={set('name')} />
          </div>

          {/* Custom IP fields */}
          {(method === 'custom' || method === 'agent') && (
            <div>
              <label className="label">IP Address{method === 'agent' && <span className="text-slate-600 normal-case tracking-normal ml-1">(optional — for display)</span>}</label>
              <input className="input font-mono" placeholder="65.21.134.201"
                value={form.ip} onChange={set('ip')} />
            </div>
          )}

          {/* Provider API fields */}
          {method === 'api' && (
            <>
              <div>
                <label className="label">Cloud Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button key={p.id}
                      onClick={() => { setForm((f) => ({ ...f, provider: p.id })); setApiValid(null); }}
                      className={`p-2.5 rounded-lg border text-sm font-ui text-left transition-all
                        ${form.provider === p.id ? 'border-neon text-white bg-neon/8' : 'border-base-600 text-slate-400 hover:border-base-400'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">API Key / Token</label>
                  <a href={PROVIDERS.find(p => p.id === form.provider)?.docs}
                    target="_blank" rel="noreferrer"
                    className="text-[10px] text-neon hover:underline font-mono">
                    How to get key ↗
                  </a>
                </div>
                <div className="flex gap-2">
                  <input className="input font-mono flex-1" type="password"
                    placeholder="Paste your API key…"
                    value={form.providerApiKey} onChange={(e) => { set('providerApiKey')(e); setApiValid(null); }} />
                  <button
                    onClick={validateApiKey}
                    disabled={validating || !form.providerApiKey}
                    className="btn-outline text-xs px-3 flex-shrink-0 whitespace-nowrap">
                    {validating ? '…' : 'Validate'}
                  </button>
                </div>
                {apiValid === true  && <p className="text-neon text-xs mt-1.5 font-mono">✓ API key valid — servers will auto-import</p>}
                {apiValid === false && <p className="text-red-400 text-xs mt-1.5 font-mono">✗ Invalid key. Check and try again.</p>}
              </div>
            </>
          )}

          {/* Agent info banner */}
          {(method === 'agent' || method === 'docker') && (
            <div className="bg-pro/10 border border-pro/25 rounded-lg p-3">
              <p className="text-pro-light text-xs font-semibold mb-1">
                {method === 'agent' ? '⬡ One-line install' : '◈ Docker one-liner'}
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                After adding, you'll get an{' '}
                {method === 'agent' ? 'install script' : 'docker-compose snippet'} with your unique token.
                Run it on your server — metrics start appearing within 30 seconds.
              </p>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="label">Tags <span className="text-slate-600 normal-case tracking-normal">(comma-separated)</span></label>
            <input className="input" placeholder="production, eu-west, api"
              value={form.tags} onChange={set('tags')} />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-slate-600 normal-case tracking-normal">(optional)</span></label>
            <textarea className="input resize-none h-14" placeholder="Any notes…"
              value={form.notes} onChange={set('notes')} />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-base-600 flex-shrink-0">
          <button className="btn-outline flex-1 justify-center" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary flex-1 justify-center" onClick={handleSubmit} disabled={loading}>
            {loading
              ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-base-900/40 border-t-base-950 animate-spin" /> Adding…</>
              : `Add ${selectedMethod?.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
