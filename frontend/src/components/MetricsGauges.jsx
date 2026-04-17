function Ring({ percent, color = 'neon', size = 80, stroke = 6, label, value }) {
  const r   = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const fill = percent != null ? (percent / 100) * circ : 0;

  const colors = {
    neon:    '#00e5a0',
    cyan:    '#22d3ee',
    pro:     '#7c3aed',
    warn:    '#fb923c',
    danger:  '#f87171',
  };

  const arcColor = percent > 85 ? colors.danger : percent > 70 ? colors.warn : colors[color] || colors.neon;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          {/* Arc */}
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={percent != null ? arcColor : 'transparent'}
            strokeWidth={stroke}
            strokeDasharray={`${fill} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-sm text-white leading-none">
            {percent != null ? `${Math.round(percent)}%` : '—'}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">{label}</p>
        {value && <p className="text-[10px] text-slate-600 font-mono mt-0.5">{value}</p>}
      </div>
    </div>
  );
}

function fmt(bytes) {
  if (bytes == null) return null;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

function fmtUptime(seconds) {
  if (seconds == null) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600)  / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MetricsGauges({ metrics, updatedAgo }) {
  if (!metrics) return null;

  const { cpuPercent, ramUsed, ramTotal, diskUsed, diskTotal, loadAvg1, loadAvg5, loadAvg15, uptimeSeconds, processes, netIn, netOut, updatedAt } = metrics;

  const ramPct  = ramTotal  ? (ramUsed  / ramTotal)  * 100 : null;
  const diskPct = diskTotal ? (diskUsed / diskTotal)  * 100 : null;

  const secondsAgo = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000) : null;
  const fresh = secondsAgo != null && secondsAgo < 90;

  return (
    <div className="space-y-5">
      {/* Freshness indicator */}
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${fresh ? 'bg-neon animate-pulse-dot' : 'bg-slate-600'}`} />
        <span className="text-xs text-slate-500 font-mono">
          {secondsAgo != null ? `Updated ${secondsAgo}s ago` : 'No data yet'}
          {!fresh && secondsAgo != null && ' — agent may be offline'}
        </span>
      </div>

      {/* Gauges row */}
      <div className="flex justify-around">
        <Ring percent={cpuPercent}  label="CPU"  value={loadAvg1 != null ? `load ${loadAvg1}` : null} />
        <Ring percent={ramPct}  color="cyan" label="RAM"  value={ramTotal  ? `${fmt(ramUsed)} / ${fmt(ramTotal)}`  : null} />
        <Ring percent={diskPct} color="pro"  label="Disk" value={diskTotal ? `${fmt(diskUsed)} / ${fmt(diskTotal)}` : null} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {[
          { label: 'Load avg',  value: loadAvg1 != null ? `${loadAvg1} / ${loadAvg5} / ${loadAvg15}` : null },
          { label: 'Uptime',    value: fmtUptime(uptimeSeconds) },
          { label: 'Processes', value: processes },
          { label: 'Net In',    value: netIn  != null ? `${fmt(netIn)}/s`  : null },
          { label: 'Net Out',   value: netOut != null ? `${fmt(netOut)}/s` : null },
        ].map(({ label, value }) => value != null && (
          <div key={label} className="bg-base-900 border border-base-700 rounded-lg px-3 py-2">
            <p className="text-slate-600 uppercase tracking-widest text-[10px]">{label}</p>
            <p className="text-neon font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
