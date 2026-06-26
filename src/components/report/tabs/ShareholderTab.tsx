/**
 * 股東報表 Tab
 *
 * 嚴謹財務計算流（由上至下）：
 * 1. 營收（Gross Revenue）
 * 2. 支出（Operating Expenses）
 * 3. 年終獎金儲備（預設每月 69,000）
 * 4. = 稅前淨利（Net Income Before Tax）
 * 5. 所得稅（可編輯 %，預設 1%）
 * 6. 員工紅利（稅後淨利 × 10%）
 * 7. = 股東盈餘
 * 8. 預留盈餘（可編輯 %，預設 10%）
 * 9. ★ 最終可分配盈餘（大字加粗）
 *
 * 細項預設折疊，保持畫面整潔。
 * 自訂月份組合：勾選任意月份計算累計。
 */

import { useMemo, useState, useEffect } from 'react';
import type { ExpenseItem, RevenueItem } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { getBreakdownCategoryLabel } from '../../../utils/lang';
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
  getCategoryBreakdown,
  monthToLabel,
  sumExpenses,
  sumRevenues,
} from '../utils/reportCalc';
import { exportShareholderExcel } from '../utils/exportShareholderExcel';

interface ShareholderTabProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
}

export default function ShareholderTab({ revenues, expenses }: ShareholderTabProps) {
  const { t, lang } = useLanguage();
  const allMonths = useMemo(() => getAllMonths(revenues, expenses), [revenues, expenses]);

  // 預設選取全部月份
  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);
  // ── 已提交（計算用）參數 ──────────────────────────────────────────────────
  const [taxRate, setTaxRate] = useState<number>(0);
  const [yearEndMonthly, setYearEndMonthly] = useState<number>(69000);
  const [employeeBonusPct, setEmployeeBonusPct] = useState<number>(10);
  const [reserveRate, setReserveRate] = useState<number>(0);
  const [expenseDetailOpen, setExpenseDetailOpen] = useState(false);

  // ── 全區單一鎖定開關（預設鎖定）────────────────────────────────────────
  const [paramsLocked, setParamsLocked] = useState(true);

  // ── 暫存草稿（解鎖期間編輯，未確認前不影響計算）────────────────────────
  const [draftTax, setDraftTax] = useState(0);
  const [draftYearEnd, setDraftYearEnd] = useState(69000);
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
      setEmployeeBonusPct(row.employee_bonus_pct);
      setReserveRate(row.reserve_rate);
      setDraftTax(row.tax_rate);
      setDraftYearEnd(row.year_end_monthly);
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
    !paramsLocked && (
      draftTax        !== taxRate        ||
      draftYearEnd    !== yearEndMonthly ||
      draftBonus      !== employeeBonusPct ||
      draftReserve    !== reserveRate
    );

  function handleToggleLock(checked: boolean) {
    if (checked) {
      // 重新鎖定：放棄草稿，回復已提交值
      setDraftTax(taxRate);
      setDraftYearEnd(yearEndMonthly);
      setDraftBonus(employeeBonusPct);
      setDraftReserve(reserveRate);
    } else {
      // 解鎖：草稿初始化為目前已提交值
      setDraftTax(taxRate);
      setDraftYearEnd(yearEndMonthly);
      setDraftBonus(employeeBonusPct);
      setDraftReserve(reserveRate);
    }
    setParamsLocked(checked);
  }

  async function handleParamsCommit() {
    setParamsSaving(true);
    setParamsError('');

    const result = await saveRestaurantParameters({
      tax_rate: draftTax,
      year_end_monthly: draftYearEnd,
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
  const operatingExpenses = sumExpenses(selExp);
  const catBreakdown      = useMemo(() => getCategoryBreakdown(selExp), [selExp]);
  const yearEndBonus      = yearEndMonthly * selectedMonths.length;

  // ── 逐月 PnL → 橫向 reduce 加總（確保虧損月紅利為負值，與 Excel 合計欄精確對齊）──
  const perMonthPnl = useMemo(() =>
    selectedMonths.map((month) => {
      const { revenues: mRev, expenses: mExp } = filterByMonths(revenues, expenses, [month]);
      return calcPnl({
        grossRevenue:      sumRevenues(mRev),
        operatingExpenses: sumExpenses(mExp),
        yearEndBonus:      yearEndMonthly,
        taxRate,
        employeeBonusPct,
        reserveRate,
      });
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revenues, expenses, selectedMonths, yearEndMonthly, taxRate, employeeBonusPct, reserveRate],
  );

  const netBeforeTax       = perMonthPnl.reduce((s, p) => s + p.netBeforeTax,       0);
  const taxAmount          = perMonthPnl.reduce((s, p) => s + p.taxAmount,          0);
  const employeeBonus      = perMonthPnl.reduce((s, p) => s + p.employeeBonus,      0);
  const shareholderSurplus = perMonthPnl.reduce((s, p) => s + p.shareholderSurplus, 0);
  const reservedSurplus    = perMonthPnl.reduce((s, p) => s + p.reservedSurplus,    0);
  const finalDistributable = perMonthPnl.reduce((s, p) => s + p.finalDistributable, 0);

  function handleExport() {
    exportShareholderExcel({
      selectedMonths,
      revenues,
      expenses,
      yearEndMonthly,
      taxRate,
      employeeBonusPct,
      reserveRate,
    });
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
        {/* 標題列 + 全區紅色鎖定開關 */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-canton-dark/40">
            {t('financialParams')}
          </span>
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
        </div>

        {/* 四張輸入卡片 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ParamInput
            key={`tax-${paramsLocked}`}
            label={t('taxRateLabel')}
            value={paramsLocked ? taxRate : draftTax}
            onChange={setDraftTax}
            unit="%"
            min={0}
            max={30}
            disabled={paramsLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`bonus-${paramsLocked}`}
            label={t('employeeBonusRateLabel')}
            value={paramsLocked ? employeeBonusPct : draftBonus}
            onChange={setDraftBonus}
            unit="%"
            min={0}
            max={50}
            disabled={paramsLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`yearend-${paramsLocked}`}
            label={t('yearEndReserveLabel')}
            value={paramsLocked ? yearEndMonthly : draftYearEnd}
            onChange={setDraftYearEnd}
            unit={t('unitCurrency')}
            min={0}
            max={500000}
            disabled={paramsLocked || paramsLoading || paramsSaving}
          />
          <ParamInput
            key={`reserve-${paramsLocked}`}
            label={t('reserveRateLabel')}
            value={paramsLocked ? reserveRate : draftReserve}
            onChange={setDraftReserve}
            unit="%"
            min={0}
            max={50}
            disabled={paramsLocked || paramsLoading || paramsSaving}
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

      {/* ── 財務瀑布流報表 ── */}
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
                <div className="mb-2 ml-8 space-y-1">
                  {Object.keys({
                    ingredients: true,
                    labor: true,
                    rent: true,
                    utilities: true,
                    marketing: true,
                    repair: true,
                    fixed_salary: true,
                    other: true,
                  }).map((key) => {
                    const val = catBreakdown[key as keyof typeof catBreakdown] as number;
                    if (val === 0) return null;
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-canton-dark/50">└ {getBreakdownCategoryLabel(lang, key)}</span>
                        <span className="font-mono tabular-nums text-canton-dark/50">
                          −${fmt(val)}
                        </span>
                      </div>
                    );
                  })}
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
