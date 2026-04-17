export default function UptimeBar({ snapshots = [], uptimePct, days = 7 }) {
  const now    = Date.now();
  const hours  = 24 * days;
  const bucket = 3600000;

  const buckets = Array.from({ length: hours }, (_, i) => {
    const bStart = now - (hours - i) * bucket;
    const bEnd   = bStart + bucket;
    const hits   = snapshots.filter((s) => { const t = new Date(s.checkedAt).getTime(); return t >= bStart && t < bEnd; });
    if (!hits.length) return 'unknown';
    const on = hits.filter((s) => s.isOnline).length;
    if (on === hits.length) return 'online';
    if (on === 0)           return 'offline';
    return 'degraded';
  });

  const colorMap = { online: 'bg-cyan-500', offline: 'bg-red-500', degraded: 'bg-amber-500', unknown: 'bg-base-600' };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="font-mono font-bold text-2xl text-neon">
            {uptimePct != null ? `${uptimePct}%` : '—'}
          </span>
          <span className="text-slate-500 ml-1.5 text-xs">uptime ({days}d)</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono ml-auto flex-wrap">
          {['online', 'degraded', 'offline', 'unknown'].map((s) => (
            <span key={s} className="flex items-center gap-1 text-slate-500">
              <span className={`h-2 w-2 rounded-sm ${colorMap[s]}`} />
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-px h-8">
        {buckets.map((status, i) => (
          <div key={i} title={`Hour ${i + 1}: ${status}`}
            className={`flex-1 rounded-sm ${colorMap[status]} opacity-80 hover:opacity-100 transition-opacity`} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-600 font-mono">
        <span>{days}d ago</span><span>Now</span>
      </div>
    </div>
  );
}
