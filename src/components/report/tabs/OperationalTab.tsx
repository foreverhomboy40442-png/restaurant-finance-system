/**
 * 營運分析 Tab
 *
 * 功能：
 * 1. 時間軸篩選（日 / 月 / 年）
 * 2. 三大核心 KPI 卡片（總營收 / 總支出 / 淨損益）
 * 3. 支出科目橫向長條分析
 * 4. 歷史趨勢折線圖（三條線：營收 / 支出 / 淨利）
 * 5. 全月份彙總表格（含累計現金流）
 */

import { useMemo, useState, useCallback } from 'react';
import type { AuditStatus, ExpenseItem, RevenueItem } from '../../../types';
import SvgDonutChart from '../charts/SvgDonutChart';
import SvgLineChart from '../charts/SvgLineChart';
import {
  filterExpenses,
  filterExpensesByDateRange,
  filterRevenues,
  filterRevenuesByDateRange,
  fmt,
  fmtPct,
  fmtSigned,
  getCategoryBreakdown,
  getMonthlyData,
  getTodayISO,
  safeDivide,
  sumExpenses,
  sumRevenues,
  type PeriodFilter,
} from '../utils/reportCalc';

interface OperationalTabProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
}

const PERIOD_OPTIONS: { id: PeriodFilter; label: string }[] = [
  { id: 'day',    label: '今日' },
  { id: 'month',  label: '本月' },
  { id: 'year',   label: '本年' },
  { id: 'custom', label: '自訂區間' },
];

const CATEGORY_COLORS: Record<string, string> = {
  ingredients: '#C9882B',
  labor:       '#A62424',
  rent:        '#1A6FA8',
  utilities:   '#2A7A3B',
  marketing:   '#8B5CF6',
  other:       '#888888',
};

const CATEGORY_LABELS: Record<string, string> = {
  ingredients:  '食材',
  labor:        'PT 薪資',
  rent:         '房租',
  utilities:    '水電',
  marketing:    '行銷',
  repair:       '修繕',
  fixed_salary: '固定支出',
  other:        '雜支',
};

export default function OperationalTab({ revenues, expenses }: OperationalTabProps) {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customStart, setCustomStart] = useState<string>(() => {
    const today = getTodayISO();
    const [y, m] = today.split('-');
    return `${y}-${m}-01`;
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getTodayISO());

  // 篩選後的資料（供 KPI + 圖表）
  const filteredRevenues = useMemo(() => {
    if (period === 'custom') {
      return filterRevenuesByDateRange(revenues, customStart, customEnd);
    }
    return filterRevenues(revenues, period);
  }, [revenues, period, customStart, customEnd]);

  const filteredExpenses = useMemo(() => {
    if (period === 'custom') {
      return filterExpensesByDateRange(expenses, customStart, customEnd);
    }
    return filterExpenses(expenses, period);
  }, [expenses, period, customStart, customEnd]);

  const totalRev = sumRevenues(filteredRevenues);
  const totalExp = sumExpenses(filteredExpenses);
  const netProfit = totalRev - totalExp;

  const catBreakdown = useMemo(() => getCategoryBreakdown(filteredExpenses), [filteredExpenses]);

  // 全資料折線圖（不受篩選影響，展示歷史趨勢）
  const monthlyData = useMemo(() => getMonthlyData(revenues, expenses), [revenues, expenses]);

  const catEntries = Object.entries(catBreakdown).filter(([k]) => k !== 'total') as [string, number][];

  // 依科目分組的篩選後支出明細（供展開表用）
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, typeof filteredExpenses>();
    for (const e of filteredExpenses) {
      const key = e.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // 每科目內依日期降序排列
    for (const [, items] of map) {
      items.sort((a, b) => b.date.localeCompare(a.date));
    }
    return map;
  }, [filteredExpenses]);

  // 展開/收合狀態
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const toggleCat = useCallback((key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const lineChartSeries = [
    {
      label: '總營收',
      color: '#2A7A3B',
      values: monthlyData.map((d) => d.revenue),
    },
    {
      label: '總支出',
      color: '#A62424',
      values: monthlyData.map((d) => d.expenses),
    },
    {
      label: '淨損益',
      color: '#C9882B',
      values: monthlyData.map((d) => d.net),
      dashed: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── 時間篩選器 ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriod(opt.id)}
              className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
                period === opt.id
                  ? 'bg-canton-red text-white'
                  : 'border border-canton-dark/12 bg-white text-canton-dark/60 hover:border-canton-red/40 hover:text-canton-dark'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 自訂區間 Date Picker — 僅在選擇「自訂區間」時展開 */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-sm border border-canton-dark/8 bg-white px-4 py-3 shadow-canton">
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-canton-dark/55">開始日期</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="canton-input py-1.5 text-sm"
              />
            </div>
            <span className="select-none text-canton-dark/30">—</span>
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-canton-dark/55">結束日期</label>
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

      {/* ── KPI 卡片 ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <KpiCard label="總營收" value={totalRev} variant="positive" />
        <KpiCard label="總支出" value={totalExp} variant="neutral" />
        <KpiCard
          label="淨損益"
          value={netProfit}
          variant={netProfit < 0 ? 'negative' : 'positive'}
          extra={
            totalRev > 0
              ? `毛利率 ${fmtPct(safeDivide(netProfit, totalRev) * 100)}`
              : undefined
          }
        />
      </div>

      {/* ── 支出科目拆解 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 左側：科目支出橫向長條 */}
        <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton">
          <h3 className="mb-4 text-sm font-semibold text-canton-dark">
            支出科目拆解
          </h3>
          {catBreakdown.total > 0 ? (
            <div className="space-y-3">
              {catEntries
                .sort(([, a], [, b]) => b - a)
                .map(([key, val]) => {
                  const pct = safeDivide(val, catBreakdown.total) * 100;
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-canton-dark/70">
                          {CATEGORY_LABELS[key] ?? key}
                        </span>
                        <span className="font-mono tabular-nums text-canton-dark/55">
                          {fmtPct(pct)} &nbsp;${fmt(val)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-canton-dark/6">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: CATEGORY_COLORS[key] ?? '#888',
                            opacity: 0.8,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-canton-dark/35">
              暫無支出資料
            </div>
          )}
        </div>

        {/* 右側：科目支出比例（圓環圖） */}
        <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton">
          <h3 className="mb-4 text-sm font-semibold text-canton-dark">
            科目支出比例
          </h3>
          <SvgDonutChart
            segments={catEntries.map(([key, val]) => ({
              label: CATEGORY_LABELS[key] ?? key,
              value: val,
              color: CATEGORY_COLORS[key] ?? '#888',
            }))}
            size={180}
          />
        </div>
      </div>

      {/* ── 科目支出明細表（可展開） ── */}
      <div className="rounded-sm border border-canton-dark/8 bg-white shadow-canton">
        <div className="border-b border-canton-dark/6 px-5 py-4">
          <h3 className="text-sm font-semibold text-canton-dark">科目支出明細表</h3>
          <p className="mt-0.5 text-[11px] text-canton-dark/40">點擊科目列可展開各筆明細</p>
        </div>

        {catBreakdown.total > 0 ? (
          <div className="divide-y divide-canton-dark/5">
            {catEntries
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([key, total], idx) => {
                const pct = safeDivide(total, catBreakdown.total) * 100;
                const color = CATEGORY_COLORS[key] ?? '#888';
                const label = CATEGORY_LABELS[key] ?? key;
                const items = expensesByCategory.get(key) ?? [];
                const isOpen = expandedCats.has(key);

                return (
                  <div key={key}>
                    {/* 科目列 */}
                    <button
                      type="button"
                      onClick={() => toggleCat(key)}
                      className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-canton-bg/60"
                    >
                      {/* 序號 */}
                      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-canton-dark/30">
                        {idx + 1}
                      </span>
                      {/* 色標 */}
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: color, opacity: 0.85 }}
                      />
                      {/* 科目名稱 */}
                      <span className="flex-1 text-sm font-medium text-canton-dark/80">
                        {label}
                      </span>
                      {/* 比例長條 */}
                      <div className="hidden w-28 sm:block">
                        <div className="h-1.5 overflow-hidden rounded-full bg-canton-dark/6">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                          />
                        </div>
                      </div>
                      {/* 百分比 */}
                      <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-canton-dark/50">
                        {fmtPct(pct)}
                      </span>
                      {/* 金額 */}
                      <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums text-canton-dark/80">
                        ${fmt(total)}
                      </span>
                      {/* 筆數 + 展開箭頭 */}
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-canton-dark/35">
                        <span>{items.length} 筆</span>
                        <svg
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    {/* 展開子明細列 */}
                    {isOpen && items.length > 0 && (
                      <div className="border-t border-canton-dark/4 bg-canton-bg/40">
                        <table className="w-full min-w-[460px] text-xs">
                          <thead>
                            <tr className="border-b border-canton-dark/5 text-[10px] text-canton-dark/35">
                              <th className="py-2 pl-14 pr-3 text-left font-medium">日期</th>
                              <th className="px-3 py-2 text-left font-medium">項目／廠商</th>
                              <th className="px-3 py-2 text-left font-medium">備註</th>
                              <th className="px-3 py-2 text-center font-medium">狀態</th>
                              <th className="py-2 pl-3 pr-5 text-right font-medium">金額</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, i) => (
                              <tr
                                key={item.id}
                                className={`border-b border-canton-dark/4 ${
                                  i % 2 === 0 ? '' : 'bg-white/60'
                                }`}
                              >
                                <td className="py-2 pl-14 pr-3 font-mono text-canton-dark/50">
                                  {item.date}
                                </td>
                                <td className="max-w-[160px] truncate px-3 py-2 text-canton-dark/70">
                                  {item.merchant || '—'}
                                </td>
                                <td className="max-w-[140px] truncate px-3 py-2 text-canton-dark/45">
                                  {item.note || '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <AuditBadge status={item.auditStatus} />
                                </td>
                                <td className="py-2 pl-3 pr-5 text-right font-mono tabular-nums text-canton-dark/75">
                                  ${fmt(item.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-canton-dark/8 bg-white/40">
                              <td colSpan={4} className="py-2 pl-14 pr-3 text-[10px] text-canton-dark/35">
                                小計
                              </td>
                              <td className="py-2 pl-3 pr-5 text-right font-mono text-xs font-semibold tabular-nums text-canton-dark/70">
                                ${fmt(total)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* 總計列 */}
            <div className="flex items-center gap-3 bg-canton-bg px-5 py-3">
              <span className="w-5 shrink-0" />
              <span className="h-3 w-3 shrink-0" />
              <span className="flex-1 text-xs font-semibold text-canton-dark/55">總計</span>
              <div className="hidden w-28 sm:block" />
              <span className="w-14 shrink-0" />
              <span className="w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-canton-dark">
                ${fmt(catBreakdown.total)}
              </span>
              <span className="shrink-0 w-[4.5rem]" />
            </div>
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center text-sm text-canton-dark/35">
            暫無支出資料
          </div>
        )}
      </div>

      {/* ── 歷史趨勢折線圖 ── */}
      <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton">
        <h3 className="mb-1 text-sm font-semibold text-canton-dark">
          營運趨勢（全資料）
        </h3>
        <p className="mb-4 text-xs text-canton-dark/40">
          展示所有可用月份之收支與淨損益走勢，不受上方時間篩選影響。
        </p>
        <SvgLineChart
          xLabels={monthlyData.map((d) => d.label)}
          series={lineChartSeries}
          height={240}
          yUnit="元"
        />
      </div>

      {/* ── 月份彙總表格 ── */}
      <div className="rounded-sm border border-canton-dark/8 bg-white shadow-canton">
        <div className="border-b border-canton-dark/6 px-5 py-4">
          <h3 className="text-sm font-semibold text-canton-dark">月份彙總表</h3>
        </div>
        <div className="overflow-x-auto">
          {monthlyData.length > 0 ? (
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-canton-dark/6 bg-canton-bg text-[11px] text-canton-dark/45">
                  <th className="px-5 py-3 text-left font-medium">月份</th>
                  <th className="px-4 py-3 text-right font-medium">總營收</th>
                  <th className="px-4 py-3 text-right font-medium">總支出</th>
                  <th className="px-4 py-3 text-right font-medium">淨損益</th>
                  <th className="px-4 py-3 text-right font-medium">累計盈餘</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => (
                  <tr
                    key={row.month}
                    className={`border-b border-canton-dark/5 ${i % 2 === 0 ? '' : 'bg-canton-bg/40'}`}
                  >
                    <td className="px-5 py-3 font-mono text-canton-dark/70">
                      {row.month}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                      ${fmt(row.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-canton-dark/65">
                      ${fmt(row.expenses)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${
                        row.net < 0 ? 'text-canton-red' : 'text-emerald-700'
                      }`}
                    >
                      {fmtSigned(row.net)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${
                        row.cumNet < 0 ? 'text-canton-red/80' : 'text-canton-dark/60'
                      }`}
                    >
                      {fmtSigned(row.cumNet)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-canton-dark/10 bg-canton-bg font-semibold">
                  <td className="px-5 py-3 text-xs text-canton-dark/50">合計</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                    ${fmt(monthlyData.reduce((s, d) => s + d.revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-canton-dark/65">
                    ${fmt(monthlyData.reduce((s, d) => s + d.expenses, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-canton-dark/65">
                    {fmtSigned(monthlyData.reduce((s, d) => s + d.net, 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-canton-dark/40 text-xs">
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="flex h-28 items-center justify-center text-sm text-canton-dark/35">
              暫無資料，請先新增營收或支出明細
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 審計狀態標籤 ──────────────────────────────────────────────────────────

function AuditBadge({ status }: { status: AuditStatus }) {
  const map: Record<AuditStatus, { label: string; cls: string }> = {
    draft:   { label: '草稿',   cls: 'bg-canton-dark/8 text-canton-dark/45' },
    audited: { label: '已審計', cls: 'bg-blue-50 text-blue-600' },
    locked:  { label: '已鎖定', cls: 'bg-emerald-50 text-emerald-700' },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── KPI 卡片子元件 ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  variant: 'positive' | 'negative' | 'neutral';
  extra?: string;
}

function KpiCard({ label, value, variant, extra }: KpiCardProps) {
  const colorClass =
    variant === 'negative'
      ? 'text-canton-red'
      : variant === 'positive'
        ? 'text-emerald-600'
        : 'text-canton-dark';

  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-canton-dark/8 bg-white p-2 shadow-canton sm:p-4 md:p-5">
      <p className="truncate text-[9px] font-medium uppercase tracking-widest text-canton-dark/38 sm:text-[10px] md:text-[11px]">
        {label}
      </p>
      <p className={`mt-1.5 min-w-0 truncate font-mono tabular-nums sm:mt-2 ${colorClass}`}>
        <span className="text-[11px] sm:text-sm md:text-base">{value < 0 ? '−' : ''}$</span>
        <span className="text-sm sm:text-base md:text-lg">{fmt(Math.abs(value))}</span>
      </p>
      {extra && (
        <p className="mt-0.5 truncate text-[9px] text-canton-dark/35 sm:mt-1 sm:text-[10px] md:text-xs">{extra}</p>
      )}
    </div>
  );
}
