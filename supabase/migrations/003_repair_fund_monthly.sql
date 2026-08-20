-- 股東報表財務參數：新增修繕金（每月攤提，首次建立預設 50,000／月）
-- 在 Supabase Dashboard → SQL Editor 執行一次即可。
-- 注意：使用者若於系統內將修繕金改為 0，即保留 0，不會被此腳本覆寫。

alter table public.restaurant_parameters
  add column if not exists repair_fund_monthly numeric default 50000;
