/**
 * 股東報表 Tab
 *
 * 嚴謹財務計算流（由上至下）：
 * 1. 營收（Gross Revenue）
 * 2. 支出（Operating Expenses）
 * 3. 年終獎金儲備（預設每月 69,000）
 * 4. 修繕金儲備（預設每月 50,000，年 600,000）
 * 5. = 稅前淨利（Net Income Before Tax）
 * 6. 所得稅（可編輯 %，預設 1%）
 * 7. 員工紅利（稅後淨利 × 10%）
 * 8. = 股東盈餘
 * 9. 預留盈餘（可編輯 %，預設 10%）
 * 10. ★ 最終可分配盈餘（大字加粗）
 *
 * 細項預設折疊，保持畫面整潔。
 * 自訂月份組合：勾選任意月份計算累計。
 */

import { useMemo, useState, useEffect } from 'react';
import type { ExpenseItem, RevenueItem } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import {
  formatMonthShortLabel,
  getReportCategoryLabel,
  type TranslationKey,
} from '../../../utils/lang';
import {
  preloadRestaurantParameters,
  saveRestaurantParameters,
} from '../../../services/restaurantParameters';
import {
  calcPnl,
  filterByMonths,
  fmt,
  fmtSigned,
  getAllMonths,
  getReportCategoryBreakdown,
  OPERATING_REPORT_CATEGORY_ORDER,
  monthToLabel,
  filterRepairExpenses,
  sumOperatingExpenses,
  sumRepairExpenses,
  sumRevenues,
  type ReportCategoryKey,
} from '../utils/reportCalc';
import { exportShareholderExcel } from '../utils/exportShareholderExcel';
import SvgLineChart from '../charts/SvgLineChart';
import SvgDonutChart from '../charts/SvgDonutChart';

interface ShareholderTabProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
  /** 訪客股東：財務參數僅可檢視，不可解鎖／儲存 */
  paramsReadOnly?: boolean;
  /** 訪客股東：隱藏 Excel 匯出 */
  hideExcelExport?: boolean;
}

/** 五大科目固定組成說明（給股東看的定義，不含金額） */
const REPORT_CATEGORY_DEF_KEYS: Record<ReportCategoryKey, TranslationKey> = {
  ingredients: 'catIngredientsDef',
  labor: 'catLaborDef',
  utilities: 'catUtilitiesDef',
  repair: 'catRepairDef',
  operating_misc: 'catOperatingMiscDef',
};

/** 五大支出科目圖表配色（加深，利於投影／匯出閱讀） */
const REPORT_CATEGORY_COLORS: Record<ReportCategoryKey, string> = {
  ingredients: '#92400E',
  labor: '#7F1D1D',
  utilities: '#14532D',
  repair: '#9A3412',
  operating_misc: '#44403C',
};

const REVENUE_TREND_COLOR = '#5C1010';

export default function ShareholderTab({
  revenues,
  expenses,
  paramsReadOnly = false,
  hideExcelExport = false,
}: ShareholderTabProps) {
  const { t, lang } = useLanguage();
  const allMonths = useMemo(() => getAllMonths(revenues, expenses), [revenues, expenses]);

  // 預設選取全部月份
  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);
  // ── 已提交（計算用）參數 ──────────────────────────────────────────────────
  const [taxRate, setTaxRate] = useState<number>(0);
  const [yearEndMonthly, setYearEndMonthly] = useState<number>(69000);
  const [repairFundMonthly, setRepairFundMonthly] = useState<number>(50000);
  const [employeeBonusPct, setEmployeeBonusPct] = useState<number>(10);
  const [reserveRate, setReserveRate] = useState<number>(0);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);

  // ── 全區單一鎖定開關（預設鎖定；訪客股東永遠鎖定）────────────────────────
  const [paramsLocked, setParamsLocked] = useState(true);
  const effectivelyLocked = paramsReadOnly || paramsLocked;

  // ── 暫存草稿（解鎖期間編輯，未確認前不影響計算）────────────────────────
  const [draftTax, setDraftTax] = useState(0);
  const [draftYearEnd, setDraftYearEnd] = useState(69000);
  const [draftRepairFund, setDraftRepairFund] = useState(50000);
  const [draftBonus, setDraftBonus] = useState(10);
  const [draftReserve, setDraftReserve] = useState(0);
  const [paramsLoading, setParamsLoading] = useState(true);
  const [paramsSaving, setParamsSaving] = useState(false);
  const [paramsError, setParamsError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCloudParams() {
      setParamsLoading(true);
      setParamsError('');

      const row = await preloadRestaurantParameters();
      if (cancelled) return;

      setTaxRate(row.tax_rate);
      setYearEndMonthly(row.year_end_monthly);
      setRepairFundMonthly(row.repair_fund_monthly);
      setEmployeeBonusPct(row.employee_bonus_pct);
      setReserveRate(row.reserve_rate);
      setDraftTax(row.tax_rate);
      setDraftYearEnd(row.year_end_monthly);
      setDraftRepairFund(row.repair_fund_monthly);
      setDraftBonus(row.employee_bonus_pct);
      setDraftReserve(row.reserve_rate);
      setParamsLoading(false);
    }

    loadCloudParams();

    return () => {
      cancelled = true;
    };
  }, []);

  // 任一草稿與已提交值不同 → dirty
  const isDirty =
    !effectivelyLocked && (
      draftTax        !== taxRate        ||
      draftYearEnd    !== yearEndMonthly ||
      draftRepairFund !== repairFundMonthly ||
      draftBonus      !== employeeBonusPct ||
      draftReserve    !== reserveRate
    );

  function handleToggleLock(checked: boolean) {
    if (paramsReadOnly) return;
    if (checked) {
      // 重新鎖定：放棄草稿，回復已提交值
      setDraftTax(taxRate);
      setDraftYearEnd(yearEndMonthly);
      setDraftRepairFund(repairFundMonthly);
      setDraftBonus(employeeBonusPct);
      setDraftReserve(reserveRate);
    } else {
      // 解鎖：草稿初始化為目前已提交值
      setDraftTax(taxRate);
      setDraftYearEnd(yearEndMonthly);
      setDraftRepairFund(repairFundMonthly);
      setDraftBonus(employeeBonusPct);
      setDraftReserve(reserveRate);
    }
    setParamsLocked(checked);
  }

  async function handleParamsCommit() {
    if (paramsReadOnly) return;
    setParamsSaving(true);
    setParamsError('');

    const result = await saveRestaurantParameters({
      tax_rate: draftTax,
      year_end_monthly: draftYearEnd,
      repair_fund_monthly: draftRepairFund,
      employee_bonus_pct: draftBonus,
      reserve_rate: draftReserve,
    });

    setParamsSaving(false);

    if (!result.ok) {
      setParamsError(t('errParamsSyncFailed', { message: result.message }));
      return;
    }

    setTaxRate(draftTax);
    setYearEndMonthly(draftYearEnd);
    setRepairFundMonthly(draftRepairFund);
    setEmployeeBonusPct(draftBonus);
    setReserveRate(draftReserve);
    setParamsLocked(true);
  }

  // 同步新月份
  useMemo(() => {
    setSelectedMonths((prev) => {
      const s = new Set(prev);
      const next = allMonths.filter((m) => s.has(m));
      // 若先前未選過某月（新月份），預設選取
      const newMonths = allMonths.filter((m) => !prev.includes(m) && !next.includes(m));
      return [...next, ...newMonths];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMonths.join(',')]);

  const { revenues: selRev, expenses: selExp } = useMemo(
    () => filterByMonths(revenues, expenses, selectedMonths),
    [revenues, expenses, selectedMonths],
  );

  const grossRevenue      = sumRevenues(selRev);
  const operatingExpenses = sumOperatingExpenses(selExp);
  const catBreakdown      = useMemo(() => getReportCategoryBreakdown(selExp), [selExp]);
  const repairDraws        = useMemo(() => filterRepairExpenses(selExp), [selExp]);
  const repairDrawTotal    = sumRepairExpenses(selExp);
  const yearEndBonus      = yearEndMonthly * selectedMonths.length;
  const repairFundReserve = repairFundMonthly * selectedMonths.length;

  const sortedSelectedMonths = useMemo(
    () => [...selectedMonths].sort(),
    [selectedMonths],
  );

  /** 所選月份逐月營收（營收成長趨勢圖） */
  const revenueTrendValues = useMemo(
    () =>
      sortedSelectedMonths.map((month) => {
        const { revenues: mRev } = filterByMonths(revenues, expenses, [month]);
        return sumRevenues(mRev);
      }),
    [revenues, expenses, sortedSelectedMonths],
  );

  const expenseShareSegments = useMemo(
    () =>
      OPERATING_REPORT_CATEGORY_ORDER
        .map((key) => ({
          key,
          label: getReportCategoryLabel(lang, key),
          value: catBreakdown[key],
          color: REPORT_CATEGORY_COLORS[key],
        }))
        .filter((seg) => seg.value > 0),
    [catBreakdown, lang],
  );

  // ── 逐月 PnL → 橫向 reduce 加總（與 Excel 合計欄對齊；虧損月員工紅利為 0）──
  const perMonthPnl = useMemo(() =>
    selectedMonths.map((month) => {
      const { revenues: mRev, expenses: mExp } = filterByMonths(revenues, expenses, [month]);
      return calcPnl({
        grossRevenue:      sumRevenues(mRev),
        operatingExpenses: sumOperatingExpenses(mExp),
        yearEndBonus:      yearEndMonthly,
        repairFund:        repairFundMonthly,
        taxRate,
        employeeBonusPct,
        reserveRate,
      });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revenues, expenses, selectedMonths, yearEndMonthly, repairFundMonthly, taxRate, employeeBonusPct, reserveRate],
  );

  const netBeforeTax       = perMonthPnl.reduce((s, p) => s + p.netBeforeTax,       0);
  const taxAmount          = perMonthPnl.reduce((s, p) => s + p.taxAmount,          0);
  const employeeBonus      = perMonthPnl.reduce((s, p) => s + p.employeeBonus,      0);
  const shareholderSurplus = perMonthPnl.reduce((s, p) => s + p.shareholderSurplus, 0);
  const reservedSurplus    = perMonthPnl.reduce((s, p) => s + p.reservedSurplus,    0);
  const finalDistributable = perMonthPnl.reduce((s, p) => s + p.finalDistributable, 0);

  async function handleExport() {
    if (hideExcelExport) return;
    try {
      await exportShareholderExcel({
        selectedMonths,
        revenues,
        expenses,
        yearEndMonthly,
        repairFundMonthly,
        taxRate,
        employeeBonusPct,
        reserveRate,
      });
    } catch (err) {
      console.error('[shareholder-export]', err);
    }
  }

  function toggleMonth(m: string) {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }

  function selectAll() {
    setSelectedMonths([...allMonths]);
  }

  function clearAll() {
    setSelectedMonths([]);
  }

  if (allMonths.length === 0) {
    return (
      <EmptyState message={t('emptyShareholder')} />
    );
  }

  const monthListSep = lang === 'en' ? ', ' : '、';

  return (
    <div className="space-y-6">
      {/* ── 月份選擇器 ── */}
      <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-canton-dark">
            {t('customMonthCombo')}
          </h3>
          <div className="flex gap-3">
            <button type="button" onClick={selectAll}
              className="text-xs text-canton-red hover:underline">{t('selectAll')}</button>
            <button type="button" onClick={clearAll}
              className="text-xs text-canton-dark/45 hover:underline">{t('clearAll')}</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allMonths.map((m) => {
            const active = selectedMonths.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMonth(m)}
                className={`rounded-sm px-3 py-1.5 text-xs font-mono transition-colors ${
                  active
                    ? 'bg-canton-red text-white'
                    : 'border border-canton-dark/12 bg-canton-bg text-canton-dark/55 hover:border-canton-red/40'
                }`}
              >
                {monthToLabel(m)}
              </button>
            );
          })}
        </div>
        {selectedMonths.length > 0 && (
          <p className="mt-2 text-xs text-canton-dark/35">
            {t('monthsSelected', { count: selectedMonths.length })} · {selectedMonths.sort().join(monthListSep)}
          </p>
        )}
      </div>

      {/* ── 可編輯參數列 ── */}
      <div className="space-y-3">
        {paramsLoading && (
          <p className="text-xs text-canton-dark/45">{t('loadingParams')}</p>
        )}
        {paramsError && (
          <p className="text-sm text-canton-red" role="alert">
            {paramsError}
          </p>
        )}
        {/* 標題列 + 全區紅色鎖定開關（訪客股東隱藏解鎖） */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-canton-dark/40">
            {t('financialParams')}
          </span>
          {!paramsReadOnly && (
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-canton-dark/60">
              {t('lockParams')}
              <input
                type="checkbox"
                checked={paramsLocked}
                onChange={(e) => handleToggleLock(e.target.checked)}
                className="h-4 w-4 accent-red-600"
                disabled={paramsLoading || paramsSaving}
              />
            </label>
          )}
        </div>

        {/* 五張輸入卡片 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <ParamInput
            key={`tax-${effectivelyLocked}`}
            label={t('taxRateLabel')}
            value={effectivelyLocked ? taxRate : draftTax}
            onChange={setDraftTax}
            unit="%"
            min={0}
            max={30}
            disabled={effectivelyLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`bonus-${effectivelyLocked}`}
            label={t('employeeBonusRateLabel')}
            value={effectivelyLocked ? employeeBonusPct : draftBonus}
            onChange={setDraftBonus}
            unit="%"
            min={0}
            max={50}
            disabled={effectivelyLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`yearend-${effectivelyLocked}`}
            label={t('yearEndReserveLabel')}
            value={effectivelyLocked ? yearEndMonthly : draftYearEnd}
            onChange={setDraftYearEnd}
            unit={t('unitCurrency')}
            min={0}
            max={500000}
            disabled={effectivelyLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`repair-${effectivelyLocked}`}
            label={t('repairFundLabel')}
            value={effectivelyLocked ? repairFundMonthly : draftRepairFund}
            onChange={setDraftRepairFund}
            unit={t('unitCurrency')}
            min={0}
            max={500000}
            disabled={effectivelyLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`reserve-${effectivelyLocked}`}
            label={t('reserveRateLabel')}
            value={effectivelyLocked ? reserveRate : draftReserve}
            onChange={setDraftReserve}
            unit="%"
            min={0}
            max={50}
            disabled={effectivelyLocked || paramsLoading || paramsSaving}
          />
        </div>

        {/* 全區確定變更按鈕（有 dirty 才顯示） */}
        {isDirty && (
          <button
            type="button"
            onClick={handleParamsCommit}
            disabled={paramsSaving}
            className="w-full rounded-sm bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-80 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paramsSaving ? t('syncingParams') : t('confirmChanges')}
          </button>
        )}
      </div>

      {/* ── 財務瀑布流報表（數據面在上） ── */}
      {selectedMonths.length === 0 ? (
        <EmptyState message={t('emptyMonths')} />
      ) : (
        <div className="rounded-sm border border-canton-dark/8 bg-white shadow-canton">
          {/* 報表標題 */}
          <div className="border-b border-canton-dark/8 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-canton-dark">
                  {t('shareholderReportTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-canton-dark/40">
                  {t('reportPeriod', {
                    range: selectedMonths.sort().join(monthListSep),
                    count: selectedMonths.length,
                  })}
                </p>
              </div>
              {!hideExcelExport && (
                <button
                  type="button"
                  onClick={handleExport}
                  className="shrink-0 bg-slate-900 text-white text-xs md:text-sm px-4 py-2 rounded-md font-medium shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a.75.75 0 0 1 .75.75v7.69l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0L5.72 10.03a.75.75 0 1 1 1.06-1.06l2.47 2.47V3.75A.75.75 0 0 1 10 3ZM3.25 15a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1-.75-.75Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t('exportPnl')}
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-canton-dark/5 px-6 py-2">
            {/* 1. 營收 */}
            <WaterfallRow
              label={t('grossRevenue')}
              value={grossRevenue}
              highlight="green"
              bold
            />

            {/* 2. 支出 */}
            <div>
              <WaterfallRow
                label={t('operatingExpenses')}
                value={-operatingExpenses}
                highlight="red"
              />
              {/* 支出細項（可折疊） */}
              <button
                type="button"
                onClick={() => setExpenseDetailOpen((v) => !v)}
                className="mb-1 ml-8 flex items-center gap-1 text-xs text-canton-dark/40 hover:text-canton-dark/65"
              >
                <span>{expenseDetailOpen ? '▲' : '▼'}</span>
                {expenseDetailOpen ? t('collapseDetails') : t('expandDetails')}
              </button>
              {expenseDetailOpen && (
                <div className="mb-3 ml-8 space-y-3">
                  <div className="space-y-1">
                    {OPERATING_REPORT_CATEGORY_ORDER.map((key) => {
                      const val = catBreakdown[key];
                      if (val === 0) return null;
                      return (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-canton-dark/50">
                            └ {getReportCategoryLabel(lang, key)}
                          </span>
                          <span className="font-mono tabular-nums text-canton-dark/50">
                            −${fmt(val)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 固定科目組成定義（不含金額，供股東理解） */}
                  <div className="rounded-sm border border-canton-dark/8 bg-canton-bg/60 px-3 py-2.5">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-canton-dark/35">
                      {t('expenseCategoryDefinition')}
                    </p>
                    <ul className="space-y-1.5">
                      {OPERATING_REPORT_CATEGORY_ORDER.map((key) => (
                        <li key={`def-${key}`} className="text-[11px] leading-relaxed text-canton-dark/50">
                          <span className="font-medium text-canton-dark/65">
                            {getReportCategoryLabel(lang, key)}
                          </span>
                          <span className="text-canton-dark/35">：</span>
                          <span>{t(REPORT_CATEGORY_DEF_KEYS[key])}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* 3. 年終獎金儲備 */}
            <WaterfallRow
              label={t('yearEndBonusReserve', {
                monthly: fmt(yearEndMonthly),
                months: selectedMonths.length,
              })}
              value={-yearEndBonus}
              sub
            />

            {/* 4. 修繕金儲備 */}
            <WaterfallRow
              label={t('repairFundReserve', {
                monthly: fmt(repairFundMonthly),
                months: selectedMonths.length,
              })}
              value={-repairFundReserve}
              sub
            />

            {/* 修繕金動支紀錄（不計入損益，僅供對帳） */}
            <div className="mb-2 ml-4 rounded-sm border border-dashed border-amber-200/80 bg-amber-50/50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-amber-900/80">
                    {t('repairFundDrawTitle')}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/55">
                    {t('repairFundDrawHint')}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums text-amber-900/80">
                  {fmt(repairDrawTotal)}
                </p>
              </div>
              {repairDraws.length > 0 && (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto border-t border-amber-200/60 pt-2">
                  {repairDraws
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 text-[11px] text-amber-900/65"
                      >
                        <span className="min-w-0 break-words">
                          {item.date} · {item.merchant || t('expenseCatRepair')}
                          {item.note ? `（${item.note}）` : ''}
                        </span>
                        <span className="shrink-0 font-mono tabular-nums">
                          {fmt(item.amount)}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {/* 稅前淨利 */}
            <WaterfallRow
              label={t('netProfitBeforeTax')}
              value={netBeforeTax}
              highlight={netBeforeTax < 0 ? 'red' : 'neutral'}
              bold
              divider
            />

            {/* 4. 稅額 */}
            <WaterfallRow
              label={t('incomeTaxRate', { rate: taxRate })}
              value={-taxAmount}
              sub
            />

            {/* 員工紅利 */}
            <WaterfallRow
              label={t('employeeBonusRate', { rate: employeeBonusPct })}
              value={employeeBonus}
              sub
            />

            {/* 股東盈餘 */}
            <WaterfallRow
              label={t('shareholderSurplus')}
              value={shareholderSurplus}
              highlight={shareholderSurplus < 0 ? 'red' : 'neutral'}
              bold
              divider
            />

            {/* 預留盈餘 */}
            <WaterfallRow
              label={t('reservedSurplusRate', { rate: reserveRate })}
              value={-reservedSurplus}
              sub
            />
          </div>

          {/* ★ 最終可分配盈餘 */}
          <div
            className={`mx-4 mb-4 mt-2 rounded-sm border p-5 text-center ${
              finalDistributable < 0
                ? 'border-canton-red bg-white'
                : 'border-slate-900 bg-white'
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-canton-dark/40">
              {t('finalDistributable')}
            </p>
            <p
              className={`mt-2 font-mono text-4xl tabular-nums md:text-5xl ${
                finalDistributable < 0 ? 'text-canton-red' : 'text-slate-950'
              }`}
            >
              {finalDistributable < 0 ? '−' : ''}$
              {fmt(Math.abs(finalDistributable))}
            </p>
            <p className="mt-1.5 text-xs text-slate-600">
              {t('statsFooter', { count: selectedMonths.length })}
            </p>
          </div>
        </div>
      )}

      {/* ── 視覺化圖表（數據面下方：營收折線 + 營業總支出甜甜圈） ── */}
      {selectedMonths.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton md:p-6">
            <h3 className="text-base font-bold text-canton-dark">
              {t('shareholderRevenueTrend')}
            </h3>
            <p className="mb-4 mt-1 text-sm text-canton-dark/55">
              {t('shareholderRevenueTrendDesc')}
            </p>
            <SvgLineChart
              xLabels={sortedSelectedMonths.map((m) => formatMonthShortLabel(lang, m))}
              series={[
                {
                  label: t('grossRevenue'),
                  color: REVENUE_TREND_COLOR,
                  values: revenueTrendValues,
                },
              ]}
              height={260}
              yUnit={t('unitCurrency')}
              emptyText={t('chartNoData')}
              emphasis
            />
          </div>

          <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton md:p-6">
            <h3 className="text-sm font-semibold text-canton-dark">
              {t('shareholderExpenseShare')}
            </h3>
            <p className="mb-3 mt-0.5 text-xs text-canton-dark/50">
              {t('shareholderExpenseShareDesc')}
            </p>
            {expenseShareSegments.length > 0 ? (
              <SvgDonutChart
                segments={expenseShareSegments.map(({ label, value, color }) => ({
                  label,
                  value,
                  color,
                }))}
                size={180}
                emphasis
                emptyText={t('chartNoData')}
                totalLabel={t('totalLabel')}
              />
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-canton-dark/50">
                {t('chartNoData')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 子元件 ─────────────────────────────────────────────────────────────────

interface WaterfallRowProps {
  label: string;
  value: number;
  highlight?: 'green' | 'red' | 'neutral';
  bold?: boolean;
  sub?: boolean;
  divider?: boolean;
}

function WaterfallRow({ label, value, highlight, bold, sub, divider }: WaterfallRowProps) {
  const valueColor =
    highlight === 'green' ? 'text-emerald-700' :
    highlight === 'red'   ? 'text-canton-red'   :
    value < 0             ? 'text-canton-red/80' :
                            'text-canton-dark/70';

  return (
    <div
      className={`flex items-center justify-between py-3 ${
        divider ? 'border-t border-canton-dark/10' : ''
      } ${sub ? 'pl-6' : ''}`}
    >
      <span
        className={`text-sm ${
          bold ? 'font-semibold text-canton-dark' : 'text-canton-dark/65'
        } ${sub ? 'text-xs text-canton-dark/50' : ''}`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-sm tabular-nums ${valueColor} ${bold ? 'text-base' : ''}`}
      >
        {fmtSigned(value)}
      </span>
    </div>
  );
}

interface ParamInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min: number;
  max: number;
  disabled?: boolean;
}

function ParamInput({ label, value, onChange, unit, min, max, disabled }: ParamInputProps) {
  const [raw, setRaw] = useState(() => String(value));

  // key 切換（鎖定狀態改變）時 useState 已重新初始化，此 effect 僅處理提交後 value 回寫
  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  return (
    <div className="rounded-sm border border-canton-dark/8 bg-white p-4 shadow-canton">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-canton-dark/50">
        {label}
      </p>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          disabled={disabled}
          onChange={(e) => {
            const str = e.target.value;
            setRaw(str);
            const v = parseFloat(str);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          onBlur={() => {
            const v = parseFloat(raw);
            if (isNaN(v) || v < min || v > max) setRaw(String(value));
          }}
          className={`canton-input w-full rounded-sm py-1.5 text-right text-sm font-mono transition-colors ${
            disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400 opacity-60' : ''
          }`}
        />
        <span className="shrink-0 text-xs text-canton-dark/50">{unit}</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-sm border border-canton-dark/8 bg-white text-sm text-canton-dark/40">
      {message}
    </div>
  );
}
