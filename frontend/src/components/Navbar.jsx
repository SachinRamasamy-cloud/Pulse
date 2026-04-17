import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentAPI } from '../utils/api';

const PLAN_META = {
  free:    { label: 'Free',     cls: 'badge-free',                                                      dot: 'bg-slate-500' },
  pro:     { label: 'Pro',      cls: 'badge-pro',                                                        dot: 'bg-pro-light' },
  proplus: { label: 'Pro Plus', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 badge', dot: 'bg-amber-400' },
};

export default function Navbar() {
  const { user, logout }   = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const [menuOpen, setMenu]         = useState(false);
  const [portalLoading, setPortalL] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };
  const planMeta = PLAN_META[user?.plan || 'free'];

  const openPortal = async () => {
    setPortalL(true);
    try { const { data } = await paymentAPI.portal(); window.location.href = data.url; }
    catch { alert('Could not open billing portal.'); }
    finally { setPortalL(false); }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-base-600 bg-base-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-neon/10 border border-neon/30 group-hover:border-neon/60 transition-colors">
            <span className="absolute h-2 w-2 rounded-full bg-neon animate-pulse-dot" />
          </span>
          <span className="font-mono font-semibold text-base text-white tracking-tight">
            Pulse<span className="text-neon">Board</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {[{ to: '/dashboard', label: 'Dashboard' }, { to: '/pricing', label: 'Pricing' }].map(({ to, label }) => (
            <Link key={to} to={to}
              className={`px-3 py-1.5 rounded-md text-sm font-ui font-medium transition-colors
                ${location.pathname === to ? 'text-neon bg-neon/10' : 'text-slate-400 hover:text-slate-200 hover:bg-base-700'}`}>
              {label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Plan badge */}
          <button onClick={user?.plan !== 'free' ? openPortal : undefined}
            className={`${planMeta.cls} text-xs cursor-${user?.plan !== 'free' ? 'pointer hover:opacity-80' : 'default'} transition-opacity`}>
            <span className={`h-1.5 w-1.5 rounded-full ${planMeta.dot}`} />
            {portalLoading ? 'Opening…' : planMeta.label}
          </button>
          {user?.plan === 'free' && (
            <Link to="/pricing" className="hidden sm:flex btn-outline text-xs py-1 px-2.5 gap-1">
              <span className="text-amber-400">↑</span> Upgrade
            </Link>
          )}

          {/* User dropdown */}
          <div className="relative">
            <button onClick={() => setMenu(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-base-700 transition-colors">
              <span className="h-7 w-7 rounded-full bg-base-600 border border-base-500 flex items-center justify-center text-xs font-mono text-neon font-semibold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </span>
              <span className="hidden sm:block text-sm text-slate-300 max-w-[90px] truncate">{user?.name}</span>
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-52 card py-1 z-50 animate-slide-up" onClick={() => setMenu(false)}>
                <div className="px-3 py-2 border-b border-base-600 mb-1">
                  <p className="text-xs text-slate-500 font-mono">signed in as</p>
                  <p className="text-sm text-slate-200 truncate">{user?.email}</p>
                  <span className={`${planMeta.cls} text-[10px] mt-1 inline-flex`}>
                    <span className={`h-1 w-1 rounded-full ${planMeta.dot}`} />
                    {planMeta.label}
                  </span>
                </div>
                {user?.plan !== 'free' && (
                  <button onClick={openPortal}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-base-700 transition-colors flex items-center gap-2">
                    <span className="text-pro-light">⬡</span> Billing &amp; Plan
                  </button>
                )}
                {user?.plan === 'free' && (
                  <Link to="/pricing"
                    className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-base-700 transition-colors flex items-center gap-2">
                    <span>↑</span> Upgrade plan
                  </Link>
                )}
                <button onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-base-700 transition-colors flex items-center gap-2">
                  <span>↩</span> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />}
    </nav>
  );
}
