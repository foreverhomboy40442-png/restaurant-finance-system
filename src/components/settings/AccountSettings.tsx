import { useEffect, useState, type FormEvent } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';

export default function AccountSettings() {
  const { t } = useLanguage();
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email ?? '';
      setCurrentEmail(email);
      setNewEmail(email);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = newEmail.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError(t('errInvalidEmail'));
      return;
    }

    const wantsEmailChange = trimmedEmail !== currentEmail;
    const wantsPasswordChange = newPassword.length > 0;

    if (!wantsEmailChange && !wantsPasswordChange) {
      setError(t('errChangeRequired'));
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

    const updatePayload: { email?: string; password?: string } = {};
    if (wantsEmailChange) updatePayload.email = trimmedEmail;
    if (wantsPasswordChange) updatePayload.password = newPassword;

    const { data, error: updateError } = await supabase.auth.updateUser(updatePayload);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updatedEmail = data.user?.email ?? trimmedEmail;
    setCurrentEmail(updatedEmail);
    setNewEmail(updatedEmail);
    setNewPassword('');
    setConfirmPassword('');
    setMessage(wantsEmailChange ? t('msgAccountUpdated') : t('msgPasswordUpdated'));
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-canton-dark">{t('accountSettingsTitle')}</h2>
        <p className="mt-1 text-sm text-canton-dark/55">
          {t('accountSettingsDesc')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-sm border border-canton-dark/8 bg-white p-6 shadow-canton"
        noValidate
      >
        <div>
          <label htmlFor="current-email" className="mb-2 block text-sm text-canton-dark/70">
            {t('currentEmail')}
          </label>
          <input
            id="current-email"
            type="email"
            className="canton-input cursor-not-allowed bg-slate-50 text-slate-500"
            value={currentEmail}
            readOnly
          />
        </div>

        <div>
          <label htmlFor="new-email" className="mb-2 block text-sm text-canton-dark/70">
            {t('newEmail')}
          </label>
          <input
            id="new-email"
            type="email"
            className="canton-input"
            placeholder="name@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="new-password" className="mb-2 block text-sm text-canton-dark/70">
            {t('newPassword')}
          </label>
          <input
            id="new-password"
            type="password"
            className="canton-input"
            placeholder="••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-2 block text-sm text-canton-dark/70">
            {t('confirmNewPassword')}
          </label>
          <input
            id="confirm-password"
            type="password"
            className="canton-input"
            placeholder="••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

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
