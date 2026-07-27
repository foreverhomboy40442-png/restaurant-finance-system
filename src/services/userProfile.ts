/**
 * 粵香園 — Supabase `profiles` 使用者個人資料
 *
 * 帳號設定的暱稱、職稱等欄位僅寫入 profiles，不觸發 Auth email 變更流程。
 */

import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  display_name: string | null;
  job_title: string | null;
}

export interface UpdateUserProfileInput {
  display_name: string;
  job_title: string;
}

interface ProfileRow {
  id: string;
  display_name?: string | null;
  job_title?: string | null;
}

function mapRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    display_name: row.display_name?.trim() || null,
    job_title: row.job_title?.trim() || null,
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
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
    .select('id, display_name, job_title')
    .single();

  if (error) {
    console.error('[userProfile] 更新失敗：', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true, profile: mapRow(data as ProfileRow) };
}
