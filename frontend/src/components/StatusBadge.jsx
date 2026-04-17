/**
 * BUG FIX #8: Three states:
 * - null + agentInstalled=false → "Waiting for agent"  (never pinged)
 * - null                        → "Unchecked"          (custom, never refreshed)
 * - true                        → "Online X ms"
 * - false                       → "Offline"
 */
export default function StatusBadge({ online, pingMs, connectionType, agentInstalled }) {
  const isAgent = connectionType === 'agent' || connectionType === 'docker';

  // Agent that has never reported
  if (online === null && isAgent && !agentInstalled) {
    return (
      <span className="badge bg-pro/10 text-pro-light border border-pro/25 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-pro-light animate-pulse-dot" />
        Waiting
      </span>
    );
  }

  // Custom / never refreshed
  if (online === null || online === undefined) {
    return (
      <span className="badge bg-base-700 text-slate-500 border border-base-500 text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
        Unchecked
      </span>
    );
  }

  return online ? (
    <span className="badge-online text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse-dot" />
      Online {pingMs != null && <span className="opacity-70">{pingMs}ms</span>}
    </span>
  ) : (
    <span className="badge-offline text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
      Offline
    </span>
  );
}
