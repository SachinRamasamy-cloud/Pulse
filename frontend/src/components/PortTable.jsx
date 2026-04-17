export default function PortTable({ ports }) {
  if (!ports?.length) return <p className="text-slate-500 text-sm">No port data available.</p>;

  const open   = ports.filter((p) => p.open);
  const closed = ports.filter((p) => !p.open);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4 font-mono text-sm">
        <span className="text-neon">{open.length} open</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-500">{closed.length} closed</span>
        <span className="text-slate-600">/</span>
        <span className="text-slate-500">{ports.length} scanned</span>
      </div>

      {/* Open ports table */}
      {open.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-base-600">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-base-600 bg-base-800">
                <th className="text-left px-4 py-2.5 text-xs font-mono text-slate-500 uppercase tracking-widest">Port</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono text-slate-500 uppercase tracking-widest">Service</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono text-slate-500 uppercase tracking-widest">Latency</th>
                <th className="text-left px-4 py-2.5 text-xs font-mono text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {open.map((port) => (
                <tr key={port.port} className="border-b border-base-700 last:border-0 hover:bg-base-700/40 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-neon font-medium">{port.port}</td>
                  <td className="px-4 py-2.5 text-slate-300">{port.service}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">
                    {port.latencyMs != null ? `${port.latencyMs}ms` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="badge-online text-xs">Open</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Closed ports (collapsed) */}
      {closed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 font-mono hover:text-slate-300 transition-colors list-none flex items-center gap-1">
            <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Show {closed.length} closed ports
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5 pt-2">
            {closed.map((p) => (
              <span key={p.port} className="px-2 py-0.5 bg-base-800 border border-base-600 rounded text-xs font-mono text-slate-600">
                {p.port}/{p.service}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
