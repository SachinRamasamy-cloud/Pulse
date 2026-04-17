import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentAPI } from '../utils/api';

const PLANS = [
  {
    id:    'free',
    label: 'Free',
    price: '$0',
    period: '/forever',
    tagline: 'Get started with basic monitoring.',
    badgeCls: 'badge-free',
    btnCls: 'btn-outline',
    btnLabel: 'Current plan',
    features: [
      { ok: true,  text: '3 servers' },
      { ok: true,  text: 'Custom IP — external probe' },
      { ok: true,  text: 'Geo, ISP, ASN, ping, status' },
      { ok: true,  text: 'Provider & tag labels' },
      { ok: false, text: 'Bash / Docker agent' },
      { ok: false, text: 'Port scanner & SSL check' },
      { ok: false, text: 'Uptime history' },
      { ok: false, text: 'Provider API (Hetzner, DO…)' },
      { ok: false, text: 'Real CPU / RAM / disk metrics' },
    ],
  },
  {
    id:    'pro',
    label: 'Pro',
    price: '$9',
    period: '/month',
    tagline: 'Agents, port scanning, uptime history.',
    badgeCls: 'badge-pro',
    btnCls: 'btn-pro',
    btnLabel: 'Upgrade to Pro',
    highlight: true,
    features: [
      { ok: true,  text: '20 servers' },
      { ok: true,  text: 'Custom IP + Bash Agent + Docker Agent' },
      { ok: true,  text: 'Real CPU, RAM, disk, load average' },
      { ok: true,  text: 'Full port scanner — 25 ports' },
      { ok: true,  text: 'SSL certificate inspector' },
      { ok: true,  text: 'HTTP response headers' },
      { ok: true,  text: '7-day uptime history chart' },
      { ok: false, text: 'Provider API (Hetzner, DO…)' },
      { ok: false, text: '30-day uptime history' },
    ],
  },
  {
    id:    'proplus',
    label: 'Pro Plus',
    price: '$19',
    period: '/month',
    tagline: 'Provider API, unlimited servers, 30-day history.',
    badgeCls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 badge',
    btnCls: 'bg-amber-500 text-black hover:bg-amber-400 btn',
    btnLabel: 'Upgrade to Pro Plus',
    features: [
      { ok: true,  text: 'Unlimited servers' },
      { ok: true,  text: 'All methods — IP, Agent, Docker, API' },
      { ok: true,  text: 'Provider API — Hetzner, DigitalOcean, Vultr, Linode' },
      { ok: true,  text: 'Auto-discover all servers from provider' },
      { ok: true,  text: 'Real CPU, RAM, disk, network from API' },
      { ok: true,  text: 'Full port scanner + SSL + HTTP headers' },
      { ok: true,  text: '30-day uptime history chart' },
      { ok: true,  text: 'Priority support' },
    ],
  },
];

const FAQS = [
  { q: 'What is a "server" in PulseBoard?', a: 'Any machine you want to monitor — a VPS, dedicated server, or cloud instance. You add it once and choose how to connect.' },
  { q: 'How does the Bash Agent work?', a: 'After adding an agent server, you get a single curl command to run on your server. It installs a lightweight systemd service that pushes CPU, RAM, disk, and load data every 30 seconds.' },
  { q: 'How does Provider API work?', a: 'You paste your Hetzner (or DigitalOcean, Vultr…) API key once. PulseBoard auto-imports all your servers and polls the provider\'s metrics API for live CPU and network data — no agent installation needed.' },
  { q: 'What is Custom IP?', a: 'We probe any public IP externally — checking reachability, ping, geolocation, ISP, and ASN. No access to the server required. Port scanning, SSL check, and HTTP headers are also available with Pro.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel from the billing portal and you keep access until the end of your billing period. No questions asked.' },
  { q: 'Is there a free trial?', a: 'The Free plan is free forever with up to 3 servers. Pro and Pro Plus have no trial but you can cancel anytime.' },
];

export default function Pricing() {
  const { user }              = useAuth();
  const navigate              = useNavigate();
  const [loading, setLoading] = useState('');
  const [error,   setError]   = useState('');

  const handleCheckout = async (planId) => {
    if (!user) { navigate('/register'); return; }
    if (user.plan === planId) return;
    setLoading(planId);
    setError('');
    try {
      const { data } = await paymentAPI.checkout(planId);
      window.location.href = data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Checkout failed. Please try again.');
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-base-950 bg-grid">
      {/* Public nav */}
      {!user && (
        <header className="border-b border-base-600 bg-base-900/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-mono font-semibold text-white">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-neon/10 border border-neon/30">
                <span className="absolute h-2 w-2 rounded-full bg-neon animate-pulse-dot" />
              </span>
              Pulse<span className="text-neon">Board</span>
            </Link>
            <div className="flex gap-2">
              <Link to="/login"    className="btn-ghost text-sm">Sign in</Link>
              <Link to="/register" className="btn-primary text-sm">Start free</Link>
            </div>
          </div>
        </header>
      )}

      <div className="max-w-6xl mx-auto px-4 py-16">

        {/* Hero */}
        <div className="text-center mb-14">
          <p className="text-xs font-mono text-neon uppercase tracking-widest mb-3">Pricing</p>
          <h1 className="font-ui font-bold text-4xl sm:text-5xl text-white mb-4">
            Start free. Scale when ready.
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Four ways to connect your servers. Choose the method that fits each server — mix and match freely.
          </p>
        </div>

        {/* Method comparison banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12 max-w-4xl mx-auto">
          {[
            { icon: '◎', label: 'Custom IP',    desc: 'External probe',     plan: 'Free' },
            { icon: '⬡', label: 'Bash Agent',   desc: 'Real metrics',       plan: 'Pro+' },
            { icon: '◈', label: 'Docker Agent', desc: 'Containerised',       plan: 'Pro+' },
            { icon: '⊕', label: 'Provider API', desc: 'Auto-discovery',     plan: 'Pro Plus' },
          ].map(({ icon, label, desc, plan }) => (
            <div key={label} className="card p-3.5 text-center">
              <span className="text-2xl block mb-1.5 text-neon">{icon}</span>
              <p className="text-white text-xs font-semibold">{label}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{desc}</p>
              <span className="text-[10px] font-mono text-slate-600 mt-1 inline-block">{plan}</span>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {PLANS.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            const isDowngrade = user && (
              (user.plan === 'proplus' && plan.id !== 'proplus') ||
              (user.plan === 'pro'     && plan.id === 'free')
            );

            return (
              <div key={plan.id}
                className={`card p-7 flex flex-col gap-5 relative overflow-hidden
                  ${plan.highlight ? 'border-pro/40 bg-gradient-to-b from-pro/5 to-transparent' : ''}
                  ${plan.id === 'proplus' ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent' : ''}`}>

                {/* Glow */}
                {plan.highlight && <div className="absolute top-0 right-0 w-28 h-28 bg-pro/10 rounded-full blur-2xl pointer-events-none" />}
                {plan.id === 'proplus' && <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />}

                {/* Most popular chip */}
                {plan.highlight && (
                  <div className="absolute top-4 right-4 text-[10px] font-mono text-pro-light bg-pro/15 border border-pro/30 px-2 py-0.5 rounded-full">
                    Most popular
                  </div>
                )}

                <div>
                  <span className={`${plan.badgeCls} text-xs mb-3 inline-flex`}>{plan.label}</span>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="font-mono font-bold text-4xl text-white">{plan.price}</span>
                    <span className="text-slate-500 text-sm mb-1.5">{plan.period}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{plan.tagline}</p>
                </div>

                {/* Feature list */}
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className={`flex items-start gap-2.5 text-sm ${f.ok ? 'text-slate-300' : 'text-slate-600'}`}>
                      {f.ok
                        ? <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.id === 'proplus' ? 'text-amber-400' : plan.highlight ? 'text-pro-light' : 'text-neon'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-base-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
                      {f.text}
                    </li>
                  ))}
                </ul>

                {error && plan.id !== 'free' && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">{error}</p>}

                {/* CTA */}
                {isCurrent ? (
                  <span className="btn-ghost w-full justify-center cursor-default opacity-60 text-sm border border-base-600">
                    ✓ Current plan
                  </span>
                ) : isDowngrade ? (
                  <span className="btn-ghost w-full justify-center cursor-default opacity-40 text-sm">
                    Downgrade via portal
                  </span>
                ) : plan.id === 'free' && !user ? (
                  <Link to="/register" className="btn-outline w-full justify-center text-sm">
                    Start free →
                  </Link>
                ) : plan.id !== 'free' ? (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!!loading}
                    className={`${plan.btnCls} w-full justify-center text-sm`}>
                    {loading === plan.id
                      ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" /> Redirecting…</>
                      : plan.btnLabel}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="font-ui font-bold text-2xl text-white text-center mb-8">Full comparison</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-600 bg-base-800">
                  <th className="text-left px-4 py-3 text-slate-400 font-ui font-medium w-1/2">Feature</th>
                  {['Free', 'Pro', 'Pro Plus'].map((h) => (
                    <th key={h} className="text-center px-4 py-3 text-slate-400 font-ui font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Servers',              '3',        '20',   '∞'    ],
                  ['Custom IP probe',      '✓',        '✓',    '✓'    ],
                  ['Geo / ISP / ASN',      '✓',        '✓',    '✓'    ],
                  ['Bash Agent',           '—',        '✓',    '✓'    ],
                  ['Docker Agent',         '—',        '✓',    '✓'    ],
                  ['Provider API',         '—',        '—',    '✓'    ],
                  ['Auto server discovery','—',        '—',    '✓'    ],
                  ['Real CPU / RAM / Disk','—',        '✓',    '✓'    ],
                  ['Port scanner',         '—',        '✓',    '✓'    ],
                  ['SSL inspector',        '—',        '✓',    '✓'    ],
                  ['HTTP headers',         '—',        '✓',    '✓'    ],
                  ['Uptime history',       '—',        '7 days','30 days'],
                  ['Priority support',     '—',        '—',    '✓'    ],
                ].map(([feat, free, pro, plus]) => (
                  <tr key={feat} className="border-b border-base-700 last:border-0 hover:bg-base-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{feat}</td>
                    {[free, pro, plus].map((val, i) => (
                      <td key={i} className="px-4 py-3 text-center font-mono text-xs">
                        {val === '✓' ? <span className="text-neon">✓</span>
                          : val === '—' ? <span className="text-slate-700">—</span>
                          : <span className="text-slate-300">{val}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-ui font-bold text-2xl text-white text-center mb-8">FAQ</h2>
          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="card p-4 group cursor-pointer">
                <summary className="flex items-center justify-between font-ui font-medium text-white text-sm list-none">
                  {q}
                  <svg className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-3"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                  </svg>
                </summary>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
