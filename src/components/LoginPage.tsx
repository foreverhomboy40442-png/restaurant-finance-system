import { useState, type FormEvent } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  clearRememberedSession,
  resolveLoginEmail,
} from '../lib/authSession';
import LanguageSwitcher from './common/LanguageSwitcher';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

/**
 * 登入牆 — Supabase Auth + 記住我自動登入 + 雙語切換。
 */
export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useLanguage();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const trimmedIdentity = identity.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentity) {
      setError(t('errIdentityRequired'));
      return;
    }
    if (!trimmedPassword) {
      setError(t('errPasswordRequired'));
      return;
    }
    if (trimmedPassword.length < 4) {
      setError(t('errPasswordMin'));
      return;
    }

    setLoading(true);

    const email = resolveLoginEmail(trimmedIdentity);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: trimmedPassword,
    });

    setLoading(false);

    if (signInError || !data.session) {
      setError(t('errLoginFailed'));
      return;
    }

    if (rememberMe) {
      localStorage.setItem('is_remember_me', 'true');
      localStorage.setItem('remember_me_session', JSON.stringify(data.session));
    } else {
      clearRememberedSession();
    }

    onLoginSuccess();
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
          <div className="mb-10 flex items-center gap-3">
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
            {t('brandName')} · {t('appTitle')}
          </h1>

          <form className="mt-12 space-y-8" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="identity"
                className="mb-2 block text-sm text-canton-dark/70"
              >
                {t('identityLabel')}
              </label>
              <input
                id="identity"
                type="text"
                className="canton-input"
                placeholder={t('identityPlaceholder')}
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-canton-dark/70"
              >
                {t('passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                className="canton-input"
                placeholder={t('passwordPlaceholder')}
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
