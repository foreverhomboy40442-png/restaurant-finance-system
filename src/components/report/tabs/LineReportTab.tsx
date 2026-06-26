/**
 * LINE 戰報工具 Tab
 *
 * 根據即時數據自動生成每日股東財務日結單，
 * 一鍵複製至剪貼簿並顯示 Toast 確認。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExpenseItem, RevenueItem } from '../../../types';
import { fmt, getCurrentMonthPrefix, getTodayISO } from '../utils/reportCalc';

interface LineReportTabProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
}

function getTodayDisplay(): string {
  return getTodayISO().replace(/-/g, '/');
}

function fmtReport(amount: number): string {
  return `$${fmt(Math.abs(amount))}`;
}

export default function LineReportTab({ revenues, expenses }: LineReportTabProps) {
  const [copyToast, setCopyToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = getTodayISO();
  const monthPrefix = getCurrentMonthPrefix();

  // 今日數據
  const todayRevenues = useMemo(
    () => revenues.filter((r) => r.date === today),
    [revenues, today],
  );
  const todayExpenses = useMemo(
    () => expenses.filter((e) => e.date === today),
    [expenses, today],
  );
  const todayTotalRev = todayRevenues.reduce((s, r) => s + r.amount, 0);
  const todayTotalExp = todayExpenses.reduce((s, e) => s + e.amount, 0);

  // 本月累計盈餘
  const monthNetProfit = useMemo(() => {
    const mRev = revenues
      .filter((r) => r.date.startsWith(monthPrefix))
      .reduce((s, r) => s + r.amount, 0);
    const mExp = expenses
      .filter((e) => e.date.startsWith(monthPrefix))
      .reduce((s, e) => s + e.amount, 0);
    return mRev - mExp;
  }, [revenues, expenses, monthPrefix]);

  // 戰報文字
  const lineReport = useMemo(
    () =>
      [
        '=== 粵香園 股東财务日结單 ===',
        `📅 報表產出日：${getTodayDisplay()}`,
        `💰 今日總營收：${fmtReport(todayTotalRev)}`,
        `💸 今日總支出：${fmtReport(todayTotalExp)}`,
        `📊 截至目前本月累計盈餘：${monthNetProfit < 0 ? '−' : ''}${fmtReport(monthNetProfit)}`,
        '============================',
      ].join('\n'),
    [todayTotalRev, todayTotalExp, monthNetProfit],
  );

  function handleCopy() {
    navigator.clipboard.writeText(lineReport).then(() => {
      setCopyToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setCopyToast(false), 3200);
    });
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* ── 今日快覽卡片 ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickCard label="今日總營收" value={todayTotalRev} color="green" />
        <QuickCard label="今日總支出" value={todayTotalExp} color="neutral" />
        <QuickCard
          label="本月累計盈餘"
          value={monthNetProfit}
          color={monthNetProfit < 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── 自動生成戰報 ── */}
      <div className="rounded-sm border border-canton-dark/8 bg-white p-6 shadow-canton md:p-8">
        {/* 標題 */}
        <div className="mb-5 flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-canton-red/8">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
              strokeLinejoin="round" className="h-5 w-5 text-canton-red" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 7l10 7 10-7" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-canton-dark">
              每日財務 LINE 戰報自動化生成
            </h2>
            <p className="mt-0.5 text-xs text-canton-dark/45">
              根據今日即時數據自動生成，可直接複製貼至股東群組
            </p>
          </div>
        </div>

        {/* 唯讀文字框 */}
        <textarea
          readOnly
          value={lineReport}
          rows={7}
          aria-label="LINE 戰報內容"
          className="w-full resize-none rounded-sm border border-canton-dark/10 bg-canton-bg px-4 py-3.5 font-mono text-sm leading-relaxed text-canton-dark/75 outline-none"
        />

        {/* 底部操作列 */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-canton-dark/35">
            切換至報表頁面時，所有數據自動刷新。
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="flex shrink-0 items-center justify-center gap-2 rounded-sm bg-canton-red px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            一鍵複製 LINE 戰報
          </button>
        </div>
      </div>

      {/* ── 複製成功 Toast ── */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-sm bg-canton-dark px-5 py-3 text-sm text-white shadow-canton-md transition-all duration-300 ${
          copyToast
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        ✓ 複製成功！可直接貼至股東群組
      </div>
    </div>
  );
}

// ── 快覽卡片子元件 ─────────────────────────────────────────────────────────

interface QuickCardProps {
  label: string;
  value: number;
  color: 'green' | 'red' | 'neutral';
}

function QuickCard({ label, value, color }: QuickCardProps) {
  const colorClass =
    color === 'green'   ? 'text-emerald-600' :
    color === 'red'     ? 'text-canton-red'   :
                          'text-canton-dark';
  return (
    <div className="rounded-sm border border-canton-dark/8 bg-white p-5 shadow-canton">
      <p className="text-[11px] font-medium uppercase tracking-widest text-canton-dark/38">
        {label}
      </p>
      <p className={`mt-2 font-mono text-2xl tabular-nums ${colorClass}`}>
        {value < 0 ? '−' : ''}${fmt(Math.abs(value))}
      </p>
    </div>
  );
}
