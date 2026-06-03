'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageCircle, Eye, EyeOff, Loader2,
  Bot, Zap, Users, BarChart3, Shield, ArrowRight,
} from 'lucide-react';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/types';

const FEATURES = [
  { icon: Bot, title: 'GPT-4o AI Replies', desc: 'Automatically responds, qualifies leads, and handles FAQs 24/7' },
  { icon: Zap, title: 'Smart Automation', desc: 'Trigger workflows, campaigns, and scheduled follow-ups' },
  { icon: Users, title: 'Multi-Number Support', desc: 'Manage all WhatsApp numbers from a single dashboard' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track conversations, lead scores, and conversion rates' },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.user as User, data.token as string, data.refreshToken as string);
      router.push('/dashboard');
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex w-[480px] xl:w-[540px] flex-shrink-0 bg-gradient-to-br from-green-950 via-green-900 to-emerald-800 flex-col justify-between p-10 relative overflow-hidden select-none">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-green-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-8 w-1 h-32 bg-green-500/20 rounded-full" />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/50">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Rexo Bot</span>
          </div>

          <h1 className="text-[2.6rem] font-extrabold text-white leading-[1.15] mb-5">
            Rexo Bot — The smartest<br />WhatsApp AI assistant
          </h1>
          <p className="text-green-300/80 text-base leading-relaxed mb-12">
            AI-powered automation that handles conversations, qualifies leads, and grows your business — 24/7.
          </p>

          <div className="space-y-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
                className="flex items-start gap-3.5"
              >
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <f.icon className="w-4 h-4 text-green-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-green-400/60 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-green-500/40 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>Enterprise-grade security · Meta Cloud API · GPT-4o</span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-950 p-4 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-[360px] sm:max-w-[380px]"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">Rexo Bot</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">Sign in to your dashboard</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-150 flex items-center justify-center gap-2.5 shadow-md shadow-green-500/20 text-sm mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
              ) : (
                <>Sign in to Dashboard <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-gray-300 dark:text-gray-600 text-xs mt-10">
            WhatsApp AI Bot v2.0 · Powered by GPT-4o
          </p>
        </motion.div>
      </div>
    </div>
  );
}
