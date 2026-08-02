-- 回填支出 merchant（子項目）為 null 或誤存為大科目的歷史資料
-- 執行前請先完成 001_financial_records_details.sql
-- 在 Supabase Dashboard → SQL Editor 執行一次即可。

-- 1) 將誤把「大科目名稱」寫進 merchant 的紀錄清空，以便下方回填
update public.financial_records
set merchant = null
where type = 'expense'
  and merchant in (
    '食材', 'PT 薪資', 'PT薪資', '房租', '水電', '行銷', '修繕', '固定支出', '雜支'
  );

-- 2) 依 note 精確比對已知子項目（與 quick-keys-config 一致）
update public.financial_records fr
set merchant = m.label
from (
  values
    ('菜金'), ('油條'), ('雞'), ('乾貨'),
    ('便當盒'), ('雜貨'), ('電費'), ('瓦斯'),
    ('拖地'), ('收垃圾'), ('林安邦'), ('陳東海'), ('林進賢'),
    ('Dee'), ('垃圾（廚餘）'), ('洗碗'), ('PT'),
    ('檯布'), ('惠通'), ('酒'), ('大友(二)'), ('惠通(一)'), ('惠通(二)'),
    ('修繕'), ('房租'),
    ('曾美惠'), ('梁桂蓮'), ('林美玉'), ('陳速華'), ('陳棋瑞'),
    ('高雲鵬'), ('黃楚平'), ('陳世郎'), ('鍾耀霆'),
    ('Noel'), ('吳慧芬'), ('張綺蓮'), ('小惠'), ('吳啟德'),
    ('吳大衛'), ('鍾正綱')
) as m(label)
where fr.type = 'expense'
  and (fr.merchant is null or btrim(fr.merchant) = '')
  and fr.note is not null
  and btrim(fr.note) = m.label;

-- 3) note 內含關鍵字（較長者優先，避免「惠通(二)」被「惠通」誤判）
update public.financial_records
set merchant = case
  when note ilike '%大友(二)%' or note ilike '%大友（二）%' then '大友(二)'
  when note ilike '%惠通(二)%' or note ilike '%惠通（二）%' then '惠通'
  when note ilike '%惠通(一)%' or note ilike '%惠通（一）%' then '惠通'
  when note ilike '%垃圾（廚餘）%' or note ilike '%垃圾(廚餘)%' then '垃圾（廚餘）'
  when note ilike '%菜金%' then '菜金'
  when note ilike '%油條%' then '油條'
  when note ilike '%便當盒%' then '便當盒'
  when note ilike '%收垃圾%' then '收垃圾'
  when note ilike '%林進賢%' then '林進賢'
  when note ilike '%林安邦%' then '林安邦'
  when note ilike '%陳東海%' then '陳東海'
  when note ilike '%陳世郎%' then '陳世郎'
  when note ilike '%鍾耀霆%' then '鍾耀霆'
  when note ilike '%鍾正綱%' then '鍾正綱'
  when note ilike '%吳慧芬%' then '吳慧芬'
  when note ilike '%張綺蓮%' then '張綺蓮'
  when note ilike '%曾美惠%' then '曾美惠'
  when note ilike '%梁桂蓮%' then '梁桂蓮'
  when note ilike '%林美玉%' then '林美玉'
  when note ilike '%陳速華%' then '陳速華'
  when note ilike '%陳棋瑞%' then '陳棋瑞'
  when note ilike '%高雲鵬%' then '高雲鵬'
  when note ilike '%黃楚平%' then '黃楚平'
  when note ilike '%吳啟德%' then '吳啟德'
  when note ilike '%吳大衛%' then '吳大衛'
  when note ilike '%惠通%' then '惠通'
  when note ilike '%乾貨%' then '乾貨'
  when note ilike '%雜貨%' then '雜貨'
  when note ilike '%檯布%' then '檯布'
  when note ilike '%修繕%' then '修繕'
  when note ilike '%裝潢%' then '修繕'
  when note ilike '%冷氣%' then '修繕'
  when note ilike '%燈泡%' then '修繕'
  when note ilike '%電費%' then '電費'
  when note ilike '%瓦斯%' then '瓦斯'
  when note ilike '%房租%' then '房租'
  when note ilike '%拖地%' then '拖地'
  when note ilike '%洗碗%' then '洗碗'
  when note ilike '%油條%' then '油條'
  when note ilike '%雞%' then '雞'
  when note ilike '%酒%' then '酒'
  else merchant
end
where type = 'expense'
  and (merchant is null or btrim(merchant) = '')
  and note is not null
  and btrim(note) <> '';

-- 4) 依大科目給最低限度兜底（僅限仍無 merchant 者，方便報表不再出現 null）
update public.financial_records
set merchant = case main_category
  when '食材' then '待補子項目'
  when 'PT 薪資' then 'PT'
  when '固定支出' then '正職薪資'
  when '水電' then '電費'
  when '修繕' then '修繕'
  when '房租' then '房租'
  when '雜支' then '其他'
  when '行銷' then '其他'
  else '其他'
end
where type = 'expense'
  and (merchant is null or btrim(merchant) = '');

-- 5) 驗證：應回傳 0 筆
select id, date, main_category, merchant, note
from public.financial_records
where type = 'expense'
  and (merchant is null or btrim(merchant) = '')
order by date desc
limit 50;
