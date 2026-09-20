/**
 * 粵香園 — Supabase `profiles` 使用者個人資料
 *
 * 帳號設定的暱稱、職稱等欄位僅寫入 profiles，不觸發 Auth email 變更流程。
 * role 決定前端權限閘道（訪客股東僅可檢視股東報表）。
 */

import { supabase } from '../lib/supabase';
import { normalizeAppRole, type AppRole } from '../types/auth';

export interface UserProfile {
  id: string;
  display_name: string | null;
  job_title: string | null;
  role: AppRole;
}

export interface UpdateUserProfileInput {
  display_name: string;
  job_title: string;
}

interface ProfileRow {
  id: string;
  display_name?: string | null;
  job_title?: string | null;
  role?: string | null;
}

function mapRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    display_name: row.display_name?.trim() || null,
    job_title: row.job_title?.trim() || null,
    role: normalizeAppRole(row.role),
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const withRole = await supabase
    .from('profiles')
    .select('id, display_name, job_title, role')
    .eq('id', userId)
    .maybeSingle();

  if (!withRole.error && withRole.data) {
    return mapRow(withRole.data as ProfileRow);
  }

  // 相容：尚未套用 role 欄位 migration 時改讀舊欄位
  if (withRole.error) {
    console.warn('[userProfile] 含 role 查詢失敗，改用不含 role：', withRole.error.message);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, job_title')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[userProfile] 載入失敗：', error.message);
    return null;
  }

  if (!data) return null;
  return mapRow(data as ProfileRow);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<{ ok: true; profile: UserProfile } | { ok: false; message: string }> {
  const payload = {
    id: userId,
    display_name: input.display_name.trim() || null,
    job_title: input.job_title.trim() || null,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, display_name, job_title, role')
    .single();

  if (error) {
    console.error('[userProfile] 更新失敗：', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, profile: mapRow(data as ProfileRow) };
}
