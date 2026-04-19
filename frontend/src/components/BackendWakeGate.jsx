import { useCallback, useEffect, useRef, useState } from 'react';
import { systemAPI } from '../utils/api';

const RETRY_MS = 3000;
const REQUEST_TIMEOUT_MS = 7000;

export default function BackendWakeGate({ children }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lastError, setLastError] = useState('');
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const checkBackend = useCallback(async () => {
    if (cancelledRef.current) return;
    setAttempt((n) => n + 1);

    try {
      await systemAPI.health({ timeout: REQUEST_TIMEOUT_MS });
      if (cancelledRef.current) return;
      setReady(true);
      setLastError('');
      clearTimer();
    } catch (err) {
      if (cancelledRef.current) return;
      const message = err?.response?.data?.error || err?.message || 'Wake-up check failed';
      setLastError(message);
      timerRef.current = setTimeout(checkBackend, RETRY_MS);
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    checkBackend();
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, [checkBackend]);

  if (ready) return children;

  return (
    <div className="min-h-screen bg-base-950 bg-grid relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-neon/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-5">
        <div className="card w-full max-w-lg p-8 space-y-6">
          <div className="flex items-center justify-between">
            <span className="badge border border-neon/30 bg-neon/10 text-neon text-xs">
              System Check
            </span>
            <span className="font-mono text-[11px] text-slate-500">Attempt {attempt}</span>
          </div>

          <div className="space-y-3">
            <h1 className="font-ui font-bold text-2xl text-white">Waking PulseBoard Backend</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your server is starting on Render free tier. This usually takes under a minute.
              We will continue automatically once it is live.
            </p>
          </div>

          <div className="space-y-3">
            <div className="h-2 w-full rounded-full bg-base-700 overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-neon/50 via-neon to-cyan-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
              <span className="h-2 w-2 rounded-full bg-neon animate-pulse" />
              Establishing secure API connection...
            </div>
          </div>

          <div className="rounded-lg border border-base-600 bg-base-900 px-3 py-2 text-xs font-mono text-slate-500">
            {lastError ? `Last response: ${lastError}` : 'Waiting for first backend response...'}
          </div>
        </div>
      </div>
    </div>
  );
}
