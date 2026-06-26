import { createClient } from '@supabase/supabase-js';

/** 後台若誤填 REST 路徑，自動還原為 Supabase 專案根 URL */
function resolveSupabaseUrl(raw: string | undefined): string {
  if (!raw?.trim()) {
    throw new Error('缺少 VITE_SUPABASE_URL，請確認 .env 已設定');
  }
  return raw.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

const supabaseUrl = resolveSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey?.trim()) {
  throw new Error('缺少 VITE_SUPABASE_ANON_KEY，請確認 .env 已設定');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
