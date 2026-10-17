-- =============================================================
-- 大阪京都瘋女18 — 共享後端建表 SQL
-- =============================================================
-- 用途：給「旅遊行程網頁」的共享記帳 / 留言 / Day4 投票使用。
--
-- 重要：請在「專門為這趟旅遊新開的 Supabase 專案」執行，
--       千萬不要在餐廳財務系統的 Supabase 執行。
--
-- 使用方式：
--   1. 到 Supabase 專案 → SQL Editor → New query
--   2. 整段貼上並 Run
--   3. 回報我這個專案的 Project URL 與 anon(publishable) key
-- =============================================================

-- 這趟旅程的固定代號（前端會用同一個值）
-- 如需多趟共用同一後端，可改以 trip_id 區分；本專案固定如下。

-- ---------- 記帳 ----------
create table if not exists public.trip_expenses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     text not null default 'osaka-kyoto-2026',
  member      text not null,
  item        text not null,
  amount      numeric(12, 2) not null check (amount > 0),
  currency    text not null default 'JPY' check (currency in ('JPY', 'TWD')),
  category    text not null default '其他',
  spent_on    date not null default (now() at time zone 'Asia/Tokyo')::date,
  created_at  timestamptz not null default now()
);

create index if not exists trip_expenses_trip_idx
  on public.trip_expenses (trip_id, created_at desc);

-- ---------- 留言板 ----------
create table if not exists public.trip_messages (
  id          uuid primary key default gen_random_uuid(),
  trip_id     text not null default 'osaka-kyoto-2026',
  member      text not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists trip_messages_trip_idx
  on public.trip_messages (trip_id, created_at desc);

-- ---------- Day4 投票（每人每選項一列）----------
create table if not exists public.trip_day4_votes (
  trip_id     text not null default 'osaka-kyoto-2026',
  member      text not null,
  option_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (trip_id, member, option_id)
);

-- =============================================================
-- Row Level Security
-- 說明：這是四人同遊的輕量共享，用 anon key + 固定 trip_id。
--       安全性屬於「知道連結才找得到」等級，非帳號級別。
-- =============================================================
alter table public.trip_expenses   enable row level security;
alter table public.trip_messages   enable row level security;
alter table public.trip_day4_votes enable row level security;

-- 記帳：可讀、可新增、可刪除（限本趟 trip_id）
drop policy if exists trip_expenses_rw on public.trip_expenses;
create policy trip_expenses_rw on public.trip_expenses
  for all
  using (trip_id = 'osaka-kyoto-2026')
  with check (trip_id = 'osaka-kyoto-2026');

-- 留言：可讀、可新增（不開放刪除）
drop policy if exists trip_messages_read on public.trip_messages;
create policy trip_messages_read on public.trip_messages
  for select
  using (trip_id = 'osaka-kyoto-2026');

drop policy if exists trip_messages_insert on public.trip_messages;
create policy trip_messages_insert on public.trip_messages
  for insert
  with check (trip_id = 'osaka-kyoto-2026');

-- Day4 投票：可讀、可新增、可刪除（取消投票）
drop policy if exists trip_votes_rw on public.trip_day4_votes;
create policy trip_votes_rw on public.trip_day4_votes
  for all
  using (trip_id = 'osaka-kyoto-2026')
  with check (trip_id = 'osaka-kyoto-2026');

-- =============================================================
-- 開啟 Realtime（記帳與留言即時同步）
-- =============================================================
alter publication supabase_realtime add table public.trip_expenses;
alter publication supabase_realtime add table public.trip_messages;
alter publication supabase_realtime add table public.trip_day4_votes;

-- 完成！回報 Project URL 與 anon key 給我即可。
