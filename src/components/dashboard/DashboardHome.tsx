/**
 * 首頁儀表板 (Dashboard)
 *
 * 功能：
 * 1. 時間維度切換 Pills（當日 / 當週 / 當月 / 自訂區間）+ 即時日期區間顯示
 * 2. 核心 KPI 看板（總營收 / 總支出 / 淨損益）— 極致放大加黑 typography
 * 3. 支出結構 SVG 甜甜圈圖（固定顯示，Bento Box 穩定版面）
 * 4. 快捷新增按鈕
 * 5. 待辦事項 To-Do List（含 23:30 今日未入帳防漏提醒）
 */

import { useEffect, useMemo, useState } from 'react';
import type { ExpenseItem, RevenueItem } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../utils/lang';
import SvgDrillDownChart from '../report/charts/SvgDrillDownChart';
import {
  filterExpensesByDateRange,
  filterRevenuesByDateRange,
  fmt,
  getCurrentMonthPrefix,
  getCurrentWeekRange,
  getTodayISO,
  excludeRepairExpenses,
  sumOperatingExpenses,
  sumRevenues,
} from '../report/utils/reportCalc';

// ── 本地型別 ────────────────────────────────────────────────────────────────

type DashboardPeriod = 'day' | 'week' | 'month' | 'custom';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

// ── 待辦事項 storage ─────────────────────────────────────────────────────────

const TODO_STORAGE_KEY = 'yuexiangyuan:todos';

function loadTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TodoItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).text === 'string' &&
        typeof (item as Record<string, unknown>).done === 'boolean',
    );
  } catch {
    return [];
  }
}

function saveTodos(todos: TodoItem[]): void {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 靜默忽略
  }
}

// ── 常數 ─────────────────────────────────────────────────────────────────────

const PERIOD_KEYS: Record<DashboardPeriod, TranslationKey> = {
  day: 'periodDay',
  week: 'periodWeek',
  month: 'periodMonth',
  custom: 'periodCustom',
};

const PERIOD_ORDER: DashboardPeriod[] = ['day', 'week', 'month', 'custom'];

// ── 工具函式 ─────────────────────────────────────────────────────────────────

function getDefaultCustomStart(): string {
  const today = getTodayISO();
  const [y, m] = today.split('-');
  return `${y}-${m}-01`;
}

/** YYYY-MM-DD → YYYY/MM/DD */
function isoToDisplay(iso: string): string {
  return iso.replace(/-/g, '/');
}

function getDateRangeLabel(
  period: DashboardPeriod,
  customStart: string,
  customEnd: string,
): string {
  if (period === 'day') {
    return isoToDisplay(getTodayISO());
  }
  if (period === 'week') {
    const { start, end } = getCurrentWeekRange();
    return `${isoToDisplay(start)} - ${isoToDisplay(end)}`;
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
  return `${isoToDisplay(customStart)} - ${isoToDisplay(customEnd)}`;
}

// ── 元件 Props ───────────────────────────────────────────────────────────────

interface DashboardHomeProps {
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
  onNavigateToRevenue: () => void;
}

// ── 主元件 ──────────────────────────────────────────────────────────────────

export default function DashboardHome({
  revenues,
  expenses,
  onNavigateToRevenue,
}: DashboardHomeProps) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [customStart, setCustomStart] = useState<string>(getDefaultCustomStart);
  const [customEnd, setCustomEnd]     = useState<string>(getTodayISO);

  const [todos, setTodos]             = useState<TodoItem[]>(() => loadTodos());
  const [newTodoText, setNewTodoText] = useState('');
  const [lateWarning, setLateWarning] = useState(false);

  // 23:30 無今日營收防漏提醒
  useEffect(() => {
    function checkNightWarning() {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() >= 30) {
        const todayISO = getTodayISO();
        setLateWarning(!revenues.some((r) => r.date === todayISO));
      } else {
        setLateWarning(false);
      }
    }
    checkNightWarning();
    const timer = setInterval(checkNightWarning, 60_000);
    return () => clearInterval(timer);
  }, [revenues]);

  // 篩選資料
  const filteredRevenues = useMemo(() => {
    if (period === 'day') {
      const today = getTodayISO();
      return revenues.filter((r) => r.date === today);
    }
    if (period === 'week') {
      const { start, end } = getCurrentWeekRange();
      return revenues.filter((r) => r.date >= start && r.date <= end);
    }
    if (period === 'month') {
      const prefix = getCurrentMonthPrefix();
      return revenues.filter((r) => r.date.startsWith(prefix));
    }
    return filterRevenuesByDateRange(revenues, customStart, customEnd);
  }, [revenues, period, customStart, customEnd]);

  const filteredExpenses = useMemo(() => {
    if (period === 'day') {
      const today = getTodayISO();
      return expenses.filter((e) => e.date === today);
    }
    if (period === 'week') {
      const { start, end } = getCurrentWeekRange();
      return expenses.filter((e) => e.date >= start && e.date <= end);
    }
    if (period === 'month') {
      const prefix = getCurrentMonthPrefix();
      return expenses.filter((e) => e.date.startsWith(prefix));
    }
    return filterExpensesByDateRange(expenses, customStart, customEnd);
  }, [expenses, period, customStart, customEnd]);

  const totalRev  = sumRevenues(filteredRevenues);
  const operatingExpenses = excludeRepairExpenses(filteredExpenses);
  const totalExp  = sumOperatingExpenses(filteredExpenses);
  const netProfit = totalRev - totalExp;

  const dateRangeLabel = useMemo(
    () => getDateRangeLabel(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  // ── 待辦事項操作 ──────────────────────────────────────────────────────────

  function addTodo() {
    const text = newTodoText.trim();
    if (!text) return;
    const updated: TodoItem[] = [
      ...todos,
      { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() },
    ];
    setTodos(updated);
    saveTodos(updated);
    setNewTodoText('');
  }

  function toggleTodo(id: string) {
    const updated = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(updated);
    saveTodos(updated);
  }

  function deleteTodo(id: string) {
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    saveTodos(updated);
  }

  const sortedTodos = [
    ...todos.filter((t) => !t.done),
    ...todos.filter((t) => t.done),
  ];

  // ── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── 時間維度 Pills + 日期區間標籤 ───────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`rounded-sm px-4 py-1.5 text-sm font-medium transition-colors ${
                period === id
                  ? 'bg-canton-red text-white'
                  : 'border border-slate-200 bg-white text-slate-500 hover:border-canton-red/40 hover:text-slate-800'
              }`}
            >
              {t(PERIOD_KEYS[id])}
            </button>
          ))}
        </div>

        {/* 即時日期區間 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            {t('dataRange')}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-700">
            {dateRangeLabel}
          </span>
        </div>
      </div>

      {/* ── 自訂區間日期選擇器 ─────────────────────────────────────────── */}
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

      {/* ── KPI 看板（極致放大加黑） ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={t('totalRevenue')} value={totalRev}  variant="positive" />
        <KpiCard label={t('totalExpense')} value={totalExp}  variant="neutral"  />
        <KpiCard
          label={t('netProfit')}
          value={netProfit}
          variant={netProfit < 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* ── 支出結構分析（固定顯示，Bento Box 穩定版面） ──────────────── */}
      <div className="rounded-sm border border-slate-100 bg-white p-5 md:p-8 shadow-sm">
        <h3 className="mb-5 text-sm font-semibold text-slate-900">{t('expenseStructure')}</h3>
        <SvgDrillDownChart expenses={operatingExpenses} />
      </div>

      {/* ── 快捷操作 + 待辦事項 ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* 快捷新增 */}
        <div className="rounded-sm border border-slate-100 bg-white p-5 md:p-6 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">{t('quickAdd')}</h3>
          <button
            type="button"
            onClick={onNavigateToRevenue}
            className="w-full rounded-sm bg-canton-red px-6 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            {t('goAddRevenueLong')}
          </button>
        </div>

        {/* 待辦事項 */}
        <div className="rounded-sm border border-slate-100 bg-white p-5 md:p-6 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">{t('todoTitle')}</h3>

          {lateWarning && (
            <div className="mb-3 rounded-sm border border-canton-red/20 bg-canton-red/8 px-3 py-2.5">
              <p className="text-xs font-semibold text-canton-red">
                ⚠️ {t('revenueAlert')}
              </p>
            </div>
          )}

          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
              placeholder={t('todoPlaceholder')}
              className="canton-input flex-1 py-2 text-base"
            />
            <button
              type="button"
              onClick={addTodo}
              disabled={!newTodoText.trim()}
              className="shrink-0 rounded-sm bg-canton-red px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t('todoAdd')}
            </button>
          </div>

          <ul className="space-y-1">
            {sortedTodos.length === 0 ? (
              <li className="py-5 text-center text-sm text-slate-500">
                {t('todoEmpty')}
              </li>
            ) : (
              sortedTodos.map((todo) => (
                <li
                  key={todo.id}
                  className="group flex items-center gap-2.5 rounded-sm px-1.5 py-1.5 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => toggleTodo(todo.id)}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-[11px] font-bold transition-colors ${
                      todo.done
                        ? 'border-canton-red/50 bg-canton-red/10 text-canton-red'
                        : 'border-slate-200 text-transparent hover:border-canton-red/30 hover:bg-canton-red/5'
                    }`}
                    aria-label={todo.done ? '取消完成' : '標記完成'}
                  >
                    ✓
                  </button>

                  <span
                    className={`flex-1 text-[15px] leading-snug ${
                      todo.done ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    {todo.text}
                  </span>

                  <button
                    type="button"
                    onClick={() => deleteTodo(todo.id)}
                    className="shrink-0 text-xs text-slate-300 opacity-0 transition-opacity hover:text-canton-red group-hover:opacity-100"
                    aria-label="刪除"
                  >
                    ✕
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

      </div>
    </div>
  );
}

// ── KPI 卡片子元件（V2.6 統一字體版） ────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number;
  variant: 'positive' | 'negative' | 'neutral';
}

function KpiCard({ label, value, variant }: KpiCardProps) {
  // 正數（含總營收）黑字；支出與負損益一律紅字
  const amountColor =
    variant === 'negative' || variant === 'neutral'
      ? 'text-canton-red'
      : 'text-canton-dark';

  return (
    <div className="rounded-sm border border-slate-100 bg-white p-6 md:p-8 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className={`mt-3 font-mono text-2xl font-normal tabular-nums ${amountColor}`}>
        {value < 0 ? '−' : ''}${fmt(Math.abs(value))}
      </p>
    </div>
  );
}
