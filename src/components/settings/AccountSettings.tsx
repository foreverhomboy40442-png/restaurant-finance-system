import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
  showLabel: string;
  hideLabel: string;
  autoComplete: 'new-password' | 'off';
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggleVisible,
  showLabel,
  hideLabel,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-canton-dark/70">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="canton-input pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-canton-dark/45 transition-colors hover:text-canton-dark/70"
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1 1 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639a10.453 10.453 0 0 1-4.046 5.236M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function AccountSettings() {
  const { t } = useLanguage();
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;

        if (userError) {
          setError(userError.message);
          return;
        }

        setCurrentEmail(user?.email ?? '');
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : t('errLoadAccountFailed'));
      }
    }

    void loadAccount();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedNewEmail = newEmail.trim().toLowerCase();
    const wantsEmailChange =
      trimmedNewEmail.length > 0 && trimmedNewEmail !== currentEmail.trim().toLowerCase();
    const wantsPasswordChange = newPassword.length > 0;

    if (!wantsEmailChange && !wantsPasswordChange) {
      setError(t('errChangeRequired'));
      return;
    }

    if (wantsEmailChange && !trimmedNewEmail.includes('@')) {
      setError(t('errInvalidEmail'));
      return;
    }

    if (wantsPasswordChange) {
      if (newPassword.length < 4) {
        setError(t('errPasswordMin'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t('errPasswordMismatch'));
        return;
      }
    }

    setLoading(true);

    try {
      const updatePayload: { email?: string; password?: string } = {};
      if (wantsEmailChange) updatePayload.email = trimmedNewEmail;
      if (wantsPasswordChange) updatePayload.password = newPassword;

      const { error: updateError } = await supabase.auth.updateUser(updatePayload);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (wantsPasswordChange) {
        setNewPassword('');
        setConfirmPassword('');
      }

      if (wantsEmailChange && wantsPasswordChange) {
        setMessage(t('msgEmailAndPasswordUpdated'));
      } else if (wantsEmailChange) {
        setMessage(t('msgEmailVerificationSent'));
      } else {
        setMessage(t('msgPasswordUpdated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errSaveAccountFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-canton-dark">{t('accountSettingsTitle')}</h2>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-sm border border-canton-dark/8 bg-white p-6 shadow-canton"
        noValidate
      >
        <div>
          <label htmlFor="original-email" className="mb-2 block text-sm text-canton-dark/70">
            {t('originalEmail')}
          </label>
          <input
            id="original-email"
            type="email"
            className="canton-input cursor-not-allowed bg-slate-50 text-slate-500"
            value={currentEmail}
            disabled
          />
        </div>

        <div>
          <label htmlFor="new-email" className="mb-2 block text-sm text-canton-dark/70">
            {t('newEmailLabel')}
          </label>
          <input
            id="new-email"
            type="email"
            className="canton-input"
            placeholder={t('newEmailPlaceholder')}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <PasswordField
          id="new-password"
          label={t('newPassword')}
          value={newPassword}
          visible={showNewPassword}
          onChange={setNewPassword}
          onToggleVisible={() => setShowNewPassword((prev) => !prev)}
          showLabel={t('toggleShowPassword')}
          hideLabel={t('toggleHidePassword')}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirm-password"
          label={t('confirmNewPassword')}
          value={confirmPassword}
          visible={showConfirmPassword}
          onChange={setConfirmPassword}
          onToggleVisible={() => setShowConfirmPassword((prev) => !prev)}
          showLabel={t('toggleShowPassword')}
          hideLabel={t('toggleHidePassword')}
          autoComplete="new-password"
        />

        {error && (
          <p className="text-sm text-canton-red" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-700" role="status">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-canton-red py-3 text-sm font-medium tracking-wide text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('savingAccount') : t('saveAccount')}
        </button>
      </form>
    </div>
  );
}
