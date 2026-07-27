import { useState, type FormEvent } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { clearRememberedSession } from '../lib/authSession';
import LanguageSwitcher from './common/LanguageSwitcher';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

/**
 * 登入牆 — 左側品牌 Logo、右側登入表單。
 */
export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t('errInvalidEmail'));
      return;
    }
    if (!trimmedPassword) {
      setError(t('errPasswordRequired'));
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError || !data.session) {
        setError(signInError?.message ?? t('errLoginFailed'));
        return;
      }

      if (rememberMe) {
        localStorage.setItem('is_remember_me', 'true');
        localStorage.setItem('remember_me_session', JSON.stringify(data.session));
      } else {
        clearRememberedSession();
      }

      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errLoginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 items-center justify-center bg-canton-bg lg:flex">
        <img
          src="/logo.png"
          alt={t('brandName')}
          className="w-[min(320px,45%)] object-contain"
        />
      </div>

      <div className="relative flex w-full flex-col justify-center bg-white px-5 py-12 sm:px-16 md:px-20 lg:w-1/2 lg:px-20 xl:px-28">
        <div className="absolute right-5 top-5 sm:right-8 md:right-10">
          <LanguageSwitcher />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-3 flex items-center gap-3">
            <img
              src="/logo.png"
              alt={t('brandName')}
              className="h-11 w-11 object-contain"
            />
            <span className="text-lg font-semibold tracking-wide text-canton-dark">
              {t('brandName')}
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-snug text-canton-dark">
            {t('appTitle')}
          </h1>

          <form className="mt-12 space-y-8" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-canton-dark/70">
                {t('loginEmailLabel')}
              </label>
              <input
                id="email"
                type="email"
                className="canton-input"
                placeholder={t('loginEmailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-canton-dark/70">
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                className="canton-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm text-canton-dark/70">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-red-600"
                disabled={loading}
              />
              {t('rememberMe')}
            </label>

            {error && (
              <p className="text-sm text-canton-red" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-sm bg-canton-red py-3.5 text-sm font-medium tracking-wide text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
