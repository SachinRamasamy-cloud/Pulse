import { useState, useEffect } from 'react';
import { serverAPI } from '../utils/api';

export default function AgentSetupPanel({ serverId, connectionType }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState('');

  useEffect(() => {
    serverAPI.agentSetup(serverId)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load setup.'))
      .finally(() => setLoading(false));
  }, [serverId]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) return (
    <div className="h-24 flex items-center justify-center">
      <span className="h-5 w-5 rounded-full border-2 border-base-600 border-t-neon animate-spin" />
    </div>
  );

  if (error) return (
    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
  );

  const isDocker = connectionType === 'docker';

  // One-liner for bash agent
  const oneliner = isDocker
    ? 'docker-compose up -d'
    : `bash <(curl -sSL ${window.location.origin.replace('5173', '5000')}/api/agent/install/${data.agentToken})`;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-pro-light text-lg">{isDocker ? '◈' : '⬡'}</span>
        <h3 className="font-ui font-semibold text-white text-sm">
          {isDocker ? 'Docker Agent' : 'Bash Agent'} — Setup Instructions
        </h3>
        <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulse-dot ml-auto" />
      </div>

      {/* Token display — partial only, never expose full token in UI text */}
      <div className="bg-base-900 border border-base-600 rounded-lg p-3 space-y-1">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Agent Token (keep secret)</p>
        <div className="flex items-center gap-2">
          <code className="text-neon text-xs font-mono flex-1 truncate">
            {data.agentToken.slice(0, 20)}•••{data.agentToken.slice(-6)}
          </code>
          <button onClick={() => copy(data.agentToken, 'token')}
            className="btn-ghost text-xs px-2 py-0.5 flex-shrink-0">
            {copied === 'token' ? '✓ Copied' : 'Copy full'}
          </button>
        </div>
      </div>

      {/* Step 1 */}
      <div>
        <p className="text-xs text-slate-400 mb-2">
          <span className="text-neon font-mono mr-1.5">Step 1</span>
          {isDocker ? 'Save the file below as docker-compose.yml on your server' : 'Run this command on your server as root:'}
        </p>
        {!isDocker && (
          <div className="relative">
            <pre className="bg-base-950 border border-base-600 rounded-lg p-3 text-xs font-mono text-neon overflow-x-auto whitespace-pre-wrap break-all pr-16">
              {data.script}
            </pre>
            <button onClick={() => copy(data.script, 'script')}
              className="absolute top-2 right-2 btn-ghost text-xs px-2 py-0.5 bg-base-800">
              {copied === 'script' ? '✓' : 'Copy'}
            </button>
          </div>
        )}
        {isDocker && (
          <div className="relative">
            <pre className="bg-base-950 border border-base-600 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-56 pr-16">
              {data.script}
            </pre>
            <button onClick={() => copy(data.script, 'script')}
              className="absolute top-2 right-2 btn-ghost text-xs px-2 py-0.5 bg-base-800">
              {copied === 'script' ? '✓' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2 (docker only) */}
      {isDocker && (
        <div>
          <p className="text-xs text-slate-400 mb-2">
            <span className="text-neon font-mono mr-1.5">Step 2</span>Start the agent:
          </p>
          <div className="relative">
            <pre className="bg-base-950 border border-base-600 rounded-lg p-3 text-xs font-mono text-neon">
              docker-compose up -d
            </pre>
            <button onClick={() => copy('docker-compose up -d', 'cmd')}
              className="absolute top-2 right-2 btn-ghost text-xs px-2 py-0.5 bg-base-800">
              {copied === 'cmd' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* What happens next */}
      <div className="bg-neon/5 border border-neon/15 rounded-lg p-3 space-y-1">
        <p className="text-neon text-xs font-semibold">What happens next</p>
        <ul className="text-slate-400 text-xs space-y-1 leading-relaxed">
          <li>• Agent starts and sends metrics every 30 seconds</li>
          <li>• CPU, RAM, disk, load average appear within 30s</li>
          <li>• The "Waiting" status badge turns green automatically</li>
          <li>• No port forwarding or firewall changes needed — agent calls out, not in</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <details className="group cursor-pointer">
        <summary className="text-xs text-slate-500 hover:text-slate-300 transition-colors list-none flex items-center gap-1 font-mono">
          <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
          Troubleshooting
        </summary>
        <div className="mt-3 text-xs text-slate-500 space-y-2 pl-4 font-mono">
          <p><span className="text-slate-400">Check agent status:</span> systemctl status pulseboard-agent</p>
          <p><span className="text-slate-400">View logs:</span> journalctl -u pulseboard-agent -f</p>
          <p><span className="text-slate-400">Restart:</span> systemctl restart pulseboard-agent</p>
          <p><span className="text-slate-400">Uninstall:</span> systemctl disable --now pulseboard-agent && rm /usr/local/bin/pulseboard-agent</p>
          {isDocker && <p><span className="text-slate-400">View Docker logs:</span> docker-compose logs -f</p>}
        </div>
      </details>
    </div>
  );
}
