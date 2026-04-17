import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentAPI } from '../utils/api';

const PLAN_META = {
  pro:     { label: 'Pro',      color: 'text-pro-light',  perks: ['20 servers', 'Bash & Docker agents', 'Real CPU/RAM/disk metrics', 'Port scanner + SSL', '7-day uptime history'] },
  proplus: { label: 'Pro Plus', color: 'text-amber-400',  perks: ['Unlimited servers', 'Provider API (Hetzner, DO, Vultr…)', 'Auto server discovery', 'Real metrics from API', '30-day uptime history'] },
};

export default function Success() {
  const { refreshUser }  = useAuth();
  const [searchParams]   = useSearchParams();
  const [plan,  setPlan] = useState(null);
  const [ready, setReady] = useState(false);
  const [activationPending, setActivationPending] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      paymentAPI.confirmSession(sessionId).catch(() => {});
    }

    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const user = await refreshUser();
        if (user.plan !== 'free') {
          clearInterval(poll);
          setPlan(user.plan);
          setReady(true);
          setActivationPending(false);
          return;
        }

        if (attempts >= 12) {
          clearInterval(poll);
          setPlan('free');
          setReady(true);
          setActivationPending(true);
        }
      } catch {
        clearInterval(poll);
        setActivationPending(true);
        setReady(true);
      }
    }, 1500);
    return () => clearInterval(poll);
  }, [refreshUser, searchParams]);

  const meta = PLAN_META[plan] || PLAN_META.pro;

  return (
    <div className="min-h-screen bg-base-950 bg-grid flex items-center justify-center p-6">
      <div className="max-w-md w-full card p-10 text-center animate-slide-up">

        {/* Animated ring */}
        <div className="relative mx-auto h-20 w-20 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-neon/20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-neon/10 border border-neon/40 flex items-center justify-center">
            <svg className="w-9 h-9 text-neon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </div>

        {!ready ? (
          <div className="space-y-3">
            <p className="text-white font-ui font-bold text-xl">Payment confirmed!</p>
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-base-600 border-t-neon animate-spin" />
              Activating your plan…
            </div>
          </div>
        ) : activationPending ? (
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Activation Pending</span>
            <h1 className="font-ui font-bold text-2xl text-white">We are finalizing your plan</h1>
            <p className="text-slate-400 text-sm leading-relaxed pt-2">
              Your payment succeeded, but plan sync is still in progress. Please refresh in a few seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <span className={`text-xs font-mono uppercase tracking-widest ${meta.color}`}>{meta.label} Activated</span>
            <h1 className="font-ui font-bold text-2xl text-white">Welcome to PulseBoard {meta.label}!</h1>
            <p className="text-slate-400 text-sm leading-relaxed pt-2">
              Your plan is now active. Start using all your new features immediately.
            </p>
          </div>
        )}

        {ready && !activationPending && (
          <>
            {/* Perks */}
            <ul className="mt-6 text-left space-y-2">
              {meta.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <svg className={`w-4 h-4 flex-shrink-0 ${meta.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  {perk}
                </li>
              ))}
            </ul>

            <div className="space-y-2.5 mt-8">
              <Link to="/dashboard" className="btn-primary w-full justify-center">
                Go to Dashboard →
              </Link>
              <Link to="/pricing" className="btn-ghost w-full justify-center text-slate-500 text-sm">
                View plan details
              </Link>
            </div>
          </>
        )}

        {ready && activationPending && (
          <div className="space-y-2.5 mt-8">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary w-full justify-center"
            >
              Refresh status
            </button>
            <Link to="/pricing" className="btn-ghost w-full justify-center text-slate-500 text-sm">
              Back to Pricing
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
