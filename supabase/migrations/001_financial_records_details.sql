-- 粵香園 financial_records 擴充欄位
-- 在 Supabase Dashboard → SQL Editor 執行此腳本一次即可。

alter table public.financial_records
  add column if not exists merchant text,
  add column if not exists note text,
  add column if not exists operator_id text,
  add column if not exists audit_status text default 'draft';

-- 已登入使用者可讀寫（若尚未設定 RLS policy，請一併執行）
alter table public.financial_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_records'
      and policyname = 'authenticated read financial_records'
  ) then
    create policy "authenticated read financial_records"
      on public.financial_records for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_records'
      and policyname = 'authenticated insert financial_records'
  ) then
    create policy "authenticated insert financial_records"
      on public.financial_records for insert to authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_records'
      and policyname = 'authenticated update financial_records'
  ) then
    create policy "authenticated update financial_records"
      on public.financial_records for update to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_records'
      and policyname = 'authenticated delete financial_records'
  ) then
    create policy "authenticated delete financial_records"
      on public.financial_records for delete to authenticated using (true);
  end if;
end $$;
