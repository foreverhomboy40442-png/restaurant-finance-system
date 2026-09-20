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

/** 登入帳號別名 → Supabase Auth Email（介面只顯示短帳號，不強制加網域） */
const LOGIN_EMAIL_ALIASES: Record<string, string> = {
  admin: 'admin@yuexiangyuan.com',
  // 訪客股東共用帳號（介面輸入 guest888；Auth 仍需合法 Email）
  guest888: 'guest888@gmail.com',
};

/**
 * 將登入輸入解析為 Auth Email。
 * - 已知短帳號走別名表（例如 guest888）
 * - 已含 @ 視為完整 Email
 * - 其餘短帳號不自動加 @yuexiangyuan.com
 */
export function resolveLoginEmail(identity: string): string {
  const trimmed = identity.trim().toLowerCase();
  if (!trimmed) return '';
  if (LOGIN_EMAIL_ALIASES[trimmed]) return LOGIN_EMAIL_ALIASES[trimmed];
  if (trimmed.includes('@')) return trimmed;
  return trimmed;
}
