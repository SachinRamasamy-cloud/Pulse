export default function LoadingSpinner({ full = false, size = 'md' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-7 w-7', lg: 'h-10 w-10' };

  const spinner = (
    <div
      className={`${sizes[size]} rounded-full border-2 border-base-600 border-t-neon animate-spin`}
    />
  );

  if (full) {
    return (
      <div className="min-h-screen bg-base-900 flex flex-col items-center justify-center gap-4">
        {spinner}
        <p className="text-sm font-mono text-slate-500">Initialising PulseBoard…</p>
      </div>
    );
  }

  return spinner;
}
