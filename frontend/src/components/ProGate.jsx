import { Link } from 'react-router-dom';

export default function ProGate({ children, label = 'Pro feature' }) {
  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content behind */}
      <div className="pointer-events-none select-none filter blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-base-900/80 backdrop-blur-[2px] z-10 p-6 text-center">
        <div className="h-10 w-10 rounded-xl bg-pro/20 border border-pro/40 flex items-center justify-center">
          <svg className="w-5 h-5 text-pro-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="font-mono font-semibold text-white text-sm">{label}</p>
          <p className="text-slate-400 text-xs mt-1">Upgrade to Pro to unlock this feature</p>
        </div>
        <Link
          to="/pricing"
          className="btn-pro text-sm px-5 py-2"
        >
          ⬡ Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}
