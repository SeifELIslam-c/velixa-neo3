import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/lib/auth';

interface AuthPageProps {
  onSuccess?: () => void;
}

export function AuthPage({ onSuccess }: AuthPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin') {
        await authApi.signInWithEmail(email, password);
      } else {
        await authApi.signUpWithEmail(email, password);
      }
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      await authApi.signInWithGoogle();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),transparent_24%),linear-gradient(180deg,#090909,#000)] px-6 py-20 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/10 bg-black/50 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden border-r border-white/8 bg-[linear-gradient(180deg,rgba(239,68,68,0.08),rgba(255,255,255,0.02))] p-10 md:block">
            <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">Velixa Neo</p>
            <h1 className="mt-6 text-5xl font-black leading-none tracking-tight">
              {t('Fast sign-in for your orders and checkout.')}
            </h1>
            <p className="mt-6 max-w-md text-white/60">
              {t('Sign in to shop faster, follow your orders, and keep your saved information ready for checkout.')}
            </p>
          </div>

          <div className="p-8 md:p-10">
            <p className="text-[11px] uppercase tracking-[0.35em] text-red-300">
              {mode === 'signin' ? t('Sign In') : t('Create Account')}
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              {mode === 'signin' ? t('Welcome back') : t('Start your account')}
            </h2>
            <p className="mt-3 text-white/55">
              {t('Google works instantly. Email/password is available too.')}
            </p>

            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-3 font-semibold text-white transition hover:bg-red-500/20 disabled:opacity-60"
            >
              <span className="text-lg font-black">G</span>
              {t('Continue with Google')}
            </button>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-sm text-white/35">{t('or')}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/70">{t('Email')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('Email Placeholder')}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 leading-6 outline-none transition focus:border-red-500/60"
              />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/70">{t('Password')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('Password')}
                minLength={6}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 leading-6 outline-none transition focus:border-red-500/60"
              />
              </label>

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-red-500 px-5 py-3 font-bold text-white transition hover:bg-red-400 disabled:opacity-60"
              >
                {loading ? t('Please wait...') : mode === 'signin' ? t('Sign In') : t('Create Account')}
              </button>
            </form>

            <button
              onClick={() => setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}
              className="mt-5 text-sm text-white/60 transition hover:text-white"
            >
              {mode === 'signin'
                ? t("Don't have an account? Create one")
                : t('Already have an account? Sign in')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
