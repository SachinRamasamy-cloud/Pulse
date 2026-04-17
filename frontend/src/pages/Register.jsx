import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register }  = useAuth();
  const navigate      = useNavigate();
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-950 bg-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-md bg-neon/10 border border-neon/30">
            <span className="absolute h-2.5 w-2.5 rounded-full bg-neon animate-pulse-dot" />
          </span>
          <span className="font-mono font-semibold text-lg text-white">
            Pulse<span className="text-neon">Board</span>
          </span>
        </Link>

        <div className="card p-7">
          <h1 className="font-ui font-bold text-xl text-white mb-1">Create account</h1>
          <p className="text-sm text-slate-500 mb-6">Start monitoring servers for free</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full justify-center mt-2" disabled={loading}>
              {loading ? (
                <><span className="h-3.5 w-3.5 rounded-full border-2 border-base-900/40 border-t-base-950 animate-spin" /> Creating account…</>
              ) : 'Create account — it\'s free'}
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-neon hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-xs text-slate-600 text-center mt-4">
          Free plan: up to 3 servers, basic monitoring. No credit card required.
        </p>
      </div>
    </div>
  );
}
