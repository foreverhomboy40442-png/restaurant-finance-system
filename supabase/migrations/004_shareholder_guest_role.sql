-- 訪客股東角色：profiles.role = 'shareholder_guest'
-- 前端僅開放「報表 → 股東報表」檢視；財務參數唯讀；Excel／設定無權限。
-- 指派方式（管理員於 Supabase SQL）：
--   update public.profiles set role = 'shareholder_guest' where id = '<auth.users.id>';

alter table public.profiles
  add column if not exists role text not null default 'user';

comment on column public.profiles.role is
  '應用角色：admin（管理員）、user（一般）、shareholder_guest（訪客股東）';

-- 判斷目前登入者是否為訪客股東（供後續 RLS 擴充）
create or replace function public.is_shareholder_guest()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'shareholder_guest'
  );
$$;

revoke all on function public.is_shareholder_guest() from public;
grant execute on function public.is_shareholder_guest() to authenticated;

-- 訪客股東不可更新財務參數（RESTRICTIVE，不影響既有 SELECT／其他角色寫入）
do $$
begin
  if to_regclass('public.restaurant_parameters') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_parameters'
      and policyname = 'restaurant_parameters_block_guest_update'
  ) then
    create policy restaurant_parameters_block_guest_update
      on public.restaurant_parameters
      as restrictive
      for update
      to authenticated
      using (not public.is_shareholder_guest())
      with check (not public.is_shareholder_guest());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_parameters'
      and policyname = 'restaurant_parameters_block_guest_insert'
  ) then
    create policy restaurant_parameters_block_guest_insert
      on public.restaurant_parameters
      as restrictive
      for insert
      to authenticated
      with check (not public.is_shareholder_guest());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_parameters'
      and policyname = 'restaurant_parameters_block_guest_delete'
  ) then
    create policy restaurant_parameters_block_guest_delete
      on public.restaurant_parameters
      as restrictive
      for delete
      to authenticated
      using (not public.is_shareholder_guest());
  end if;
end $$;
