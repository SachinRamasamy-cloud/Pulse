export default function MetricCard({ label, value, sub, icon, accent = false, className = '' }) {
  return (
    <div className={`card p-4 flex gap-3 items-start ${className}`}>
      {icon && (
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base
          ${accent ? 'bg-neon/10 border border-neon/20 text-neon' : 'bg-base-700 border border-base-600 text-slate-400'}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
        <p className={`font-mono font-semibold text-sm truncate ${accent ? 'text-neon' : 'text-slate-200'}`}>
          {value || '—'}
        </p>
        {sub && <p className="text-xs text-slate-600 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}
