import { Link } from 'react-router-dom';

const METHODS = [
  { icon: '◎', label: 'Custom IP',    plan: 'Free',     desc: 'Paste any public IP. Get geo, ISP, ASN, ping and status instantly — no access needed.' },
  { icon: '⬡', label: 'Bash Agent',   plan: 'Pro',      desc: 'One curl command. Installs a systemd service that streams real CPU, RAM and disk every 30s.' },
  { icon: '◈', label: 'Docker Agent', plan: 'Pro',      desc: 'Same real metrics in a single container. No root, no systemd — just docker-compose up.' },
  { icon: '⊕', label: 'Provider API', plan: 'Pro Plus', desc: 'Connect Hetzner, DigitalOcean or Vultr. Auto-discovers every server and pulls live metrics.' },
];

const PRO_FEATURES = [
  { icon: '⊞', title: 'Port Scanner',         desc: '25-port TCP scan with per-port latency.' },
  { icon: '⊛', title: 'SSL Inspector',         desc: 'Cert issuer, expiry countdown, SANs.' },
  { icon: '⊡', title: 'HTTP Headers',          desc: 'Server software, powered-by, redirects.' },
  { icon: '◈', title: '7-day Uptime Chart',    desc: 'Hourly availability buckets, uptime %.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-base-950 text-slate-200 overflow-x-hidden">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-base-600/50 bg-base-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-neon/10 border border-neon/30">
              <span className="absolute h-2 w-2 rounded-full bg-neon animate-pulse-dot" />
            </span>
            <span className="font-mono font-semibold text-white">Pulse<span className="text-neon">Board</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/pricing" className="btn-ghost text-sm hidden sm:flex">Pricing</Link>
            <Link to="/login"   className="btn-ghost text-sm">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 sm:py-32 px-4 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-neon/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-pro/6  rounded-full blur-3xl pointer-events-none" />
        <div className="bg-grid absolute inset-0 pointer-events-none opacity-50" />

        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon/10 border border-neon/25 text-neon text-xs font-mono mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse-dot" />
            4 ways to connect your servers
          </span>

          <h1 className="font-ui font-bold text-5xl sm:text-6xl lg:text-7xl text-white leading-tight mb-6">
            Full server visibility<br />
            <span className="text-neon text-glow">your way</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Custom IP for instant probing. Agent for real CPU &amp; RAM. Provider API for auto-discovery.
            Choose per server, mix freely.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary text-base px-7 py-3 shadow-neon-md">Get started free →</Link>
            <Link to="/pricing"  className="btn-outline text-base px-7 py-3">See all plans</Link>
          </div>

          {/* Mock dashboard */}
          <div className="mt-14 max-w-3xl mx-auto card border-base-500 overflow-hidden text-left">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-base-600 bg-base-800">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              <span className="text-xs text-slate-600 font-mono ml-2">PulseBoard — Dashboard</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'prod-api-01',  ip: '65.21.134.201', type: '⊕ Provider API', online: true,  cpu: 34, ram: 62, disk: 41 },
                { name: 'worker-02',    ip: '95.216.88.10',  type: '⬡ Bash Agent',   online: true,  cpu: 71, ram: 48, disk: 28 },
                { name: 'staging-db',   ip: '135.181.14.3',  type: '◈ Docker Agent', online: true,  cpu: 12, ram: 31, disk: 55 },
                { name: 'old-server',   ip: '94.130.20.5',   type: '◎ Custom IP',    online: false, cpu: null, ram: null, disk: null },
              ].map((s) => (
                <div key={s.name} className="bg-base-800 border border-base-600 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-xs font-semibold">{s.name}</p>
                      <p className="text-neon text-[10px] font-mono">{s.ip}</p>
                    </div>
                    <span className={`badge text-[10px] ${s.online ? 'badge-online' : 'badge-offline'}`}>
                      <span className={`h-1 w-1 rounded-full ${s.online ? 'bg-cyan-400 animate-pulse-dot' : 'bg-red-400'}`} />
                      {s.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-[9px] font-mono text-slate-600">{s.type}</p>
                  {s.cpu != null && (
                    <div className="space-y-1">
                      {[['CPU', s.cpu, '#00e5a0'], ['RAM', s.ram, '#22d3ee'], ['Disk', s.disk, '#7c3aed']].map(([l, v, c]) => (
                        <div key={l} className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-slate-600 w-6">{l}</span>
                          <div className="flex-1 h-1 bg-base-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${v}%`, background: c }} />
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">{v}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 methods */}
      <section className="py-20 px-4 border-t border-base-700">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono text-neon uppercase tracking-widest text-center mb-3">Connection Methods</p>
          <h2 className="font-ui font-bold text-3xl text-white text-center mb-3">Pick the right method for each server</h2>
          <p className="text-slate-400 text-center text-sm mb-10 max-w-lg mx-auto">
            Mix and match freely. Each server in your fleet can use a different method.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {METHODS.map(({ icon, label, plan, desc }) => (
              <div key={label} className="card p-5 space-y-3 hover:border-base-400 transition-colors">
                <div className="flex items-start justify-between">
                  <span className="text-2xl text-neon">{icon}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border
                    ${plan === 'Free'     ? 'text-slate-500 border-base-500 bg-base-700'
                    : plan === 'Pro'      ? 'text-pro-light border-pro/30 bg-pro/10'
                    : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
                    {plan}
                  </span>
                </div>
                <h3 className="font-ui font-semibold text-white text-sm">{label}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pro features */}
      <section className="py-20 px-4 border-t border-base-700">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-mono text-neon uppercase tracking-widest text-center mb-3">Pro Features</p>
          <h2 className="font-ui font-bold text-3xl text-white text-center mb-10">Deep server intelligence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRO_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="card p-5 space-y-2.5 border-pro/20 bg-pro/5">
                <span className="text-xl text-pro-light">{icon}</span>
                <h3 className="font-ui font-semibold text-white text-sm">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-base-700">
        <div className="max-w-2xl mx-auto card p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-neon/6 rounded-full blur-3xl pointer-events-none" />
          <h2 className="font-ui font-bold text-3xl text-white mb-4">Start monitoring for free</h2>
          <p className="text-slate-400 text-sm mb-8">3 servers, no credit card, no time limit.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link to="/register" className="btn-primary text-sm px-6 py-2.5 shadow-neon-sm">Create free account →</Link>
            <Link to="/pricing"  className="btn-outline text-sm px-6 py-2.5">Compare all plans</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-base-700 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-mono">
          <span>PulseBoard © {new Date().getFullYear()}</span>
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-slate-400 transition-colors">Pricing</Link>
            <Link to="/login"   className="hover:text-slate-400 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
