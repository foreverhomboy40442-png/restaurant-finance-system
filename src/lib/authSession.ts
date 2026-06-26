import type { Session } from '@supabase/supabase-js';

const IS_REMEMBER_ME_KEY = 'is_remember_me';
const REMEMBER_ME_SESSION_KEY = 'remember_me_session';

/** 舊版 key，登出或重新登入時一併清除 */
const LEGACY_REMEMBER_ME_KEY = 'yuexiang_remember_me';
const LEGACY_SESSION_KEY = 'yuexiang_auth_session';

export function isRememberMeEnabled(): boolean {
  return localStorage.getItem(IS_REMEMBER_ME_KEY) === 'true';
}

export function persistRememberedSession(session: Session): void {
  localStorage.setItem(IS_REMEMBER_ME_KEY, 'true');
  localStorage.setItem(REMEMBER_ME_SESSION_KEY, JSON.stringify(session));
}

export function clearRememberedSession(): void {
  localStorage.removeItem(IS_REMEMBER_ME_KEY);
  localStorage.removeItem(REMEMBER_ME_SESSION_KEY);
  localStorage.removeItem(LEGACY_REMEMBER_ME_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
}

export function loadRememberedSession():
  | { access_token: string; refresh_token: string }
  | null {
  if (localStorage.getItem(IS_REMEMBER_ME_KEY) !== 'true') return null;

  const raw = localStorage.getItem(REMEMBER_ME_SESSION_KEY);
  if (!raw) return null;

  try {
    const backup = JSON.parse(raw) as Session;
    if (!backup.access_token || !backup.refresh_token) return null;
    return {
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    };
  } catch {
    clearRememberedSession();
    return null;
  }
}

/** 老闆習慣輸入 admin，對齊 Supabase Email 格式 */
export function resolveLoginEmail(identity: string): string {
  const trimmed = identity.trim().toLowerCase();
  if (trimmed === 'admin') return 'admin@yuexiangyuan.com';
  if (!trimmed.includes('@')) return `${trimmed}@yuexiangyuan.com`;
  return trimmed;
}
