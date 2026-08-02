/**
 * 營運綜合決策面板
 *
 * 佈局（由上至下）：
 * 1. 自訂時間篩選器 + 即時日期區間標籤
 * 2. 三大核心 KPI 卡片（總營收 / 總支出 / 總損益）
 * 3. 月度收支趨勢折線圖（全寬）
 */

import { useMemo, useState, useCallback } from 'react';
import type { ExpenseItem, RevenueItem } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { formatMonthShortLabel, getReportCategoryLabel } from '../../../utils/lang';
import SvgLineChart from '../charts/SvgLineChart';
import {
  filterExpenses,
  filterExpensesByDateRange,
  filterRevenues,
  filterRevenuesByDateRange,
  fmt,
  fmtPct,
  getReportCategoryBreakdown,
  groupExpensesByReportCategory,
  REPORT_CATEGORY_ORDER,
  getCurrentMonthPrefix,
  getCurrentYear,
  getMonthlyData,
  getTodayISO,
  safeDivide,
  sumExpenses,
  sumRevenues,
  type PeriodFilter,
} from '../utils/reportCalc';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ManagementTabProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
}

// ─── 靜態設定 ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  ingredients:    '#C9882B',
  labor:          '#A62424',
  utilities:      '#2A7A3B',
  repair:         '#E07040',
  operating_misc: '#888888',
};

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  return iso.replace(/-/g, '/');
}

function getDateRangeLabel(
  period: PeriodFilter,
  customStart: string,
  customEnd: string,
): string {
  if (period === 'day') {
    return isoToDisplay(getTodayISO());
  }
  if (period === 'month') {
    const prefix = getCurrentMonthPrefix();
    const [y, m] = prefix.split('-');
    const today = getTodayISO();
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const end = today.startsWith(prefix)
      ? isoToDisplay(today)
      : `${y}/${m}/${String(lastDay).padStart(2, '0')}`;
    return `${y}/${m}/01 - ${end}`;
  }
  if (period === 'year') {
    const year = getCurrentYear();
    const today = getTodayISO();
    const end = today.startsWith(year) ? isoToDisplay(today) : `${year}/12/31`;
    return `${year}/01/01 - ${end}`;
  }
  return `${isoToDisplay(customStart)} - ${isoToDisplay(customEnd)}`;
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function ManagementTab({ revenues, expenses }: ManagementTabProps) {
  const { t, lang } = useLanguage();
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const today = getTodayISO();
    const [y, m] = today.split('-');
    return `${y}-${m}-01`;
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getTodayISO());

  // ── 篩選資料 ──────────────────────────────────────────────────────────────

  const filteredRevenues = useMemo(() => {
    if (period === 'custom') return filterRevenuesByDateRange(revenues, customStart, customEnd);
    return filterRevenues(revenues, period);
  }, [revenues, period, customStart, customEnd]);

  const filteredExpenses = useMemo(() => {
    if (period === 'custom') return filterExpensesByDateRange(expenses, customStart, customEnd);
    return filterExpenses(expenses, period);
  }, [expenses, period, customStart, customEnd]);

  // ── KPI ───────────────────────────────────────────────────────────────────

  const totalRev  = sumRevenues(filteredRevenues);
  const totalExp  = sumExpenses(filteredExpenses);
  const netProfit = totalRev - totalExp;

  const dateRangeLabel = useMemo(
    () => getDateRangeLabel(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  // ── 科目拆解（隨時間篩選同步） ───────────────────────────────────────────

  const catBreakdown = useMemo(
    () => getReportCategoryBreakdown(filteredExpenses),
    [filteredExpenses],
  );

  const catEntries = useMemo(
    () =>
      REPORT_CATEGORY_ORDER
        .map((key) => [key, catBreakdown[key]] as const)
        .filter(([, v]) => v > 0),
    [catBreakdown],
  );

  const expensesByCategory = useMemo(
    () => groupExpensesByReportCategory(filteredExpenses),
    [filteredExpenses],
  );

  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const toggleCat = useCallback((key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── 月度趨勢（全資料，不受時間篩選影響） ─────────────────────────────────

  const monthlyData = useMemo(
    () => getMonthlyData(revenues, expenses),
    [revenues, expenses],
  );

  const lineChartSeries = useMemo(
    () => [
      {
        label: t('totalRevenue'),
        color: '#2A7A3B',
        values: monthlyData.map((d) => d.revenue),
      },
      {
        label: t('totalExpense'),
        color: '#A62424',
        values: monthlyData.map((d) => d.expenses),
      },
      {
        label: t('netProfit'),
        color: '#C9882B',
        values: monthlyData.map((d) => d.net),
        dashed: true,
      },
    ],
    [monthlyData, t],
  );

  const periodOptions: { id: PeriodFilter; label: string }[] = useMemo(
    () => [
      { id: 'day', label: t('reportToday') },
      { id: 'month', label: t('reportThisMonth') },
      { id: 'year', label: t('reportThisYear') },
      { id: 'custom', label: t('periodCustom') },
    ],
    [t],
  );

  const chartXLabels = useMemo(
    () => monthlyData.map((d) => formatMonthShortLabel(lang, d.month)),
    [monthlyData, lang],
  );

  // ─── 渲染 ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── 1. 時間篩選器 + 日期區間標籤 ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {periodOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
                period === opt.id
                  ? 'bg-canton-red text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-canton-red/40 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            {t('dataRange')}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-700">
            {dateRangeLabel}
          </span>
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-slate-600">{t('startDate')}</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="canton-input py-1.5 text-sm"
              />
            </div>
            <span className="select-none text-slate-300">—</span>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-slate-600">{t('endDate')}</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={getTodayISO()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="canton-input py-1.5 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. 三大 KPI 卡片 ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <KpiCard label={t('totalRevenue')} value={totalRev} variant="positive" />
        <KpiCard label={t('totalExpense')} value={totalExp} variant="neutral" />
        <KpiCard
          label={t('totalPnL')}
          value={netProfit}
          variant={netProfit < 0 ? 'negative' : 'positive'}
          extra={
            totalRev > 0
              ? t('grossMarginPct', { pct: fmtPct(safeDivide(netProfit, totalRev) * 100) })
              : undefined
          }
        />
      </div>

      {/* ── 3. 科目支出比例表（可展開） ─────────────────────────────────── */}
      <div className="rounded-sm border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{t('reportCategoryRatio')}</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">{t('reportClickExpandCategory')}</p>
        </div>

        {catBreakdown.total > 0 ? (
          <div className="w-full overflow-x-auto block whitespace-nowrap">
          <table className="w-full min-w-[400px]">
            {/* 表頭 */}
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-400">
                <th className="px-5 py-2.5 text-left">{t('colCategory')}</th>
                <th className="px-4 py-2.5 text-right">{t('colTotalAmount')}</th>
                <th className="px-5 py-2.5 text-right">{t('colPctOfTotalExpense')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {catEntries.map(([key, total]) => {
                const pct    = safeDivide(total, catBreakdown.total) * 100;
                const color  = CATEGORY_COLORS[key] ?? '#888';
                const label  = getReportCategoryLabel(lang, key);
                const items  = expensesByCategory.get(key) ?? [];
                const isOpen = expandedCats.has(key);

                return (
                  <>
                    {/* 科目列（可點擊展開） */}
                    <tr
                      key={key}
                      onClick={() => toggleCat(key)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: color, opacity: 0.85 }}
                          />
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                          <span className="text-[11px] text-slate-400">
                            {t('entryCount', { count: items.length })}
                          </span>
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-slate-700">
                        ${fmt(total)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-slate-500">
                        {fmtPct(pct)}
                      </td>
                    </tr>

                    {/* 展開子明細列 */}
                    {isOpen && items.map((item, i) => {
                      const itemPct = safeDivide(item.amount, catBreakdown.total) * 100;
                      const itemName = [item.merchant, item.note].filter(Boolean).join('・') || '—';
                      return (
                        <tr
                          key={item.id}
                          className={`border-l-2 ${i % 2 === 0 ? 'bg-slate-50/60' : 'bg-white'}`}
                          style={{ borderLeftColor: color }}
                        >
                          <td className="py-2.5 pl-10 pr-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-slate-700">{itemName}</span>
                              <span className="font-mono text-[10px] text-slate-400">{item.date}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">
                            ${fmt(item.amount)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-mono text-xs tabular-nums text-slate-400">
                            {fmtPct(itemPct)}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>

            {/* 合計列 */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-5 py-3 text-xs text-slate-500">{t('totalLabel')}</td>
                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-slate-900">
                  ${fmt(catBreakdown.total)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-slate-500">
                  100.0%
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center text-sm text-slate-400">
            {t('noExpenseData')}
          </div>
        )}
      </div>

      {/* ── 5. 月度收支趨勢折線圖（全寬） ─────────────────────────────── */}
      <div className="rounded-sm border border-slate-100 bg-white p-5 shadow-sm md:p-8">
        <h3 className="mb-0.5 text-sm font-semibold text-slate-900">{t('monthlyTrendTitle')}</h3>
        <p className="mb-4 text-xs text-slate-500">
          {t('monthlyTrendDesc')}
        </p>
        {monthlyData.length > 0 ? (
          <SvgLineChart
            xLabels={chartXLabels}
            series={lineChartSeries}
            height={240}
            yUnit={t('unitCurrency')}
            emptyText={t('chartNoData')}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            {t('noMonthlyData')}
          </div>
        )}
      </div>

    </div>
  );
}

// ── KPI 卡片子元件（V2.6 統一字體版） ────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  variant: 'positive' | 'negative' | 'neutral';
  extra?: string;
}

function KpiCard({ label, value, variant, extra }: KpiCardProps) {
  // 正數（含總營收）黑字；支出與負損益一律紅字
  const amountColor =
    variant === 'negative' || variant === 'neutral'
      ? 'text-canton-red'
      : 'text-canton-dark';

  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-slate-100 bg-white p-2 shadow-sm sm:p-4 md:p-5">
      <p className="truncate text-[9px] font-medium uppercase tracking-widest text-slate-500 sm:text-[10px] md:text-[11px]">
        {label}
      </p>
      <p className={`mt-1.5 min-w-0 truncate font-mono tabular-nums sm:mt-2 ${amountColor}`}>
        <span className="text-[11px] sm:text-sm md:text-base">{value < 0 ? '−' : ''}$</span>
        <span className="text-sm sm:text-base md:text-lg">{fmt(Math.abs(value))}</span>
      </p>
      {extra && (
        <p className="mt-0.5 truncate text-[9px] text-slate-500 sm:mt-1 sm:text-[10px] md:text-xs">{extra}</p>
      )}
    </div>
  );
}
