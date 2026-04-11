import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [magicMessage, setMagicMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, loginWithMagicLink } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMagicMessage('');
    // Debug: log start of login flow
    // console.log('[Login] submit start', { email });
    setIsSubmitting(true);
    try {
      await login(email, password);
      // console.log('[Login] login succeeded, navigating');
      navigate('/');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err ?? 'Invalid credentials');
      const isNetworkError =
        /failed to fetch|network error|load failed|timeout|timed out/i.test(msg);
      setError(
        isNetworkError
          ? 'Connection problem. Check your internet and try again.'
          : msg,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    setError('');
    setMagicMessage('');
    if (!email) {
      setError('Please enter your email to receive a magic link.');
      return;
    }
    setIsSubmitting(true);
    try {
      await loginWithMagicLink(email);
      setMagicMessage('We’ve emailed you a login link. Please check your inbox.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err ?? 'Could not send magic link.');
      const isNetworkError =
        /failed to fetch|network error|load failed|timeout|timed out/i.test(msg);
      setError(
        isNetworkError
          ? 'Connection problem. Check your internet and try again.'
          : msg,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-off-white px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="card p-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">Welcome Back</h1>
            <p className="text-stone-500">Continue your adventure journey</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}
          {magicMessage && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-6 text-sm">
              {magicMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
            <button
              type="submit"
              disabled={isSubmitting}
              className="olive-button w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Logging in…' : 'Login'}
            </button>
          </form>

          <div className="mt-3 text-center">
            <Link
              to="/forgot-password"
              className="text-sm text-olive-drab font-medium hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleMagicLink}
              className="text-sm text-olive-drab font-medium hover:underline"
            >
              Or send me a magic login link
            </button>
          </div>

          <div className="mt-8 text-center text-stone-500 text-sm">
            Don't have an account? <Link to="/register" className="text-olive-drab font-bold hover:underline">Sign up</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
