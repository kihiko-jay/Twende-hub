import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { sendPasswordReset } from "@/services/auth.ts";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setMessage(
        "Check your email — we've sent a password reset link. It expires in 1 hour.",
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to send reset email");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-off-white px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="card p-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">
              Forgot your password?
            </h1>
            <p className="text-stone-500 text-sm">
              Enter the email linked to your TwendeHub account and we&apos;ll send you a
              reset link.
            </p>
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl mb-4 text-sm">
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="olive-button w-full py-3 text-sm disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-stone-500">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-olive-drab font-medium hover:underline"
            >
              Back to login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

