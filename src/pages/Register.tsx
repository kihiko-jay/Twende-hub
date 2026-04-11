import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import type { UserRole } from '@/lib/supabase.types.ts';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('participant');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register({ name, email, password, role });
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err ?? 'Something went wrong');
      const isNetworkError =
        /failed to fetch|network error|load failed|timeout|timed out/i.test(msg);
      const isServerError =
        !isNetworkError && /server|internal|500|stack|depth|unavailable/i.test(msg);
      setError(
        isNetworkError
          ? 'Connection problem. Check your internet and try again.'
          : isServerError
            ? 'Server error during sign up. Please try again in a moment.'
            : msg
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-off-white px-4 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="card p-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">Join TwendeHub</h1>
            <p className="text-stone-500">Start your next outdoor adventure</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Full Name</label>
              <input
                type="text"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Email Address</label>
              <input
                type="email"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">Password</label>
              <input
                type="password"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">I want to</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(['participant', 'organizer', 'vehicle_owner', 'photographer', 'vendor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 rounded-xl border transition-all font-medium ${role === r ? 'bg-olive-drab border-olive-drab text-white' : 'bg-white border-stone-200 text-stone-600'}`}
                  >
                    {r === 'participant' && 'Join Events'}
                    {r === 'organizer' && 'Organize Events'}
                    {r === 'vehicle_owner' && 'List Vehicles'}
                    {r === 'photographer' && 'Photography'}
                    {r === 'vendor' && 'Vendor'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="olive-button w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-8 text-center text-stone-500 text-sm">
            Already have an account? <Link to="/login" className="text-olive-drab font-bold hover:underline">Login</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
