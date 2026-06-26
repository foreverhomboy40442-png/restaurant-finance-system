/**
 * 報表中心 — 財務計算工具庫
 *
 * 純函式設計，無副作用，所有計算邏輯集中於此，
 * 供各報表 Tab 元件引用，避免重複計算邏輯散落各處。
 */

import type { ExpenseItem, RevenueItem } from '../../../types';

// ── 型別定義 ───────────────────────────────────────────────────────────────

export type PeriodFilter = 'day' | 'month' | 'year' | 'custom';

/** 月度聚合資料（含累計現金流） */
export interface MonthlyData {
  month: string;    // YYYY-MM
  label: string;    // 如 "1月"
  revenue: number;
  expenses: number;
  net: number;
  cumNet: number;   // 累計淨利（現金流）
}

/** 支出科目加總 */
export interface CategoryBreakdown {
  ingredients: number;
  labor: number;
  rent: number;
  utilities: number;
  marketing: number;
  repair: number;
  fixed_salary: number;
  other: number;
  total: number;
}

// ── 日期工具 ───────────────────────────────────────────────────────────────

export function getTodayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getCurrentMonthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentYear(): string {
  return String(new Date().getFullYear());
}

/** 將 YYYY-MM 轉為顯示標籤（如 "2026/01"） */
export function monthToLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${y}/${m}`;
}

/** 取得指定 YYYY-MM 的月份中文標籤 */
export function monthToShortLabel(ym: string): string {
  const m = parseInt(ym.split('-')[1], 10);
  return `${m}月`;
}

// ── 篩選工具 ───────────────────────────────────────────────────────────────

export function filterRevenues(
  revenues: RevenueItem[],
  period: PeriodFilter,
): RevenueItem[] {
  if (period === 'day') {
    const today = getTodayISO();
    return revenues.filter((r) => r.date === today);
  }
  if (period === 'month') {
    const prefix = getCurrentMonthPrefix();
    return revenues.filter((r) => r.date.startsWith(prefix));
  }
  // year
  const year = getCurrentYear();
  return revenues.filter((r) => r.date.startsWith(year));
}

export function filterExpenses(
  expenses: ExpenseItem[],
  period: PeriodFilter,
): ExpenseItem[] {
  if (period === 'day') {
    const today = getTodayISO();
    return expenses.filter((e) => e.date === today);
  }
  if (period === 'month') {
    const prefix = getCurrentMonthPrefix();
    return expenses.filter((e) => e.date.startsWith(prefix));
  }
  // year
  const year = getCurrentYear();
  return expenses.filter((e) => e.date.startsWith(year));
}

/**
 * 將任意日期字串正規化為 YYYY-MM 月份鍵。
 *
 * 相容場景：
 *   YYYY-MM-DD         → 2026-05
 *   YYYY/MM/DD         → 2026-05  (斜線格式)
 *   YYYY-MM-DDTHH:mm:ss → 2026-05  (含時間)
 *   YYYY-M-D           → 無法通過 createFinancialDate 驗證，但仍容錯處理
 *
 * 使用正則擷取確保只取 4 位年份 + 2 位月份，不受任何後綴污染。
 */
function toMonthKey(dateStr: string): string {
  const match = dateStr.replace(/\//g, '-').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : dateStr.substring(0, 7).replace(/\//g, '-');
}

/** 依月份陣列篩選（股東報表用） */
export function filterByMonths(
  revenues: RevenueItem[],
  expenses: ExpenseItem[],
  selectedMonths: string[],
): { revenues: RevenueItem[]; expenses: ExpenseItem[] } {
  const monthSet = new Set(selectedMonths.map(toMonthKey));
  return {
    revenues: revenues.filter((r) => monthSet.has(toMonthKey(r.date))),
    expenses: expenses.filter((e) => monthSet.has(toMonthKey(e.date))),
  };
}

// ── 計算工具 ───────────────────────────────────────────────────────────────

export function sumRevenues(revenues: RevenueItem[]): number {
  return revenues.reduce((s, r) => s + r.amount, 0);
}

export function sumExpenses(expenses: ExpenseItem[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function getCategoryBreakdown(expenses: ExpenseItem[]): CategoryBreakdown {
  const b: CategoryBreakdown = {
    ingredients: 0, labor: 0, rent: 0, utilities: 0, marketing: 0, repair: 0, fixed_salary: 0, other: 0, total: 0,
  };
  for (const e of expenses) {
    // 使用 hasOwnProperty 而非 in，避免 prototype chain 干擾分類對齊
    if (Object.prototype.hasOwnProperty.call(b, e.category)) {
      ((b as unknown) as Record<string, number>)[e.category] += e.amount;
    } else {
      b.other += e.amount;
    }
    b.total += e.amount;
  }
  return b;
}

/** 取得所有已出現月份（排序後），供月選器使用 */
export function getAllMonths(
  revenues: RevenueItem[],
  expenses: ExpenseItem[],
): string[] {
  const set = new Set([
    ...revenues.map((r) => toMonthKey(r.date)),
    ...expenses.map((e) => toMonthKey(e.date)),
  ]);
  return Array.from(set).sort();
}

/** 計算月度聚合，包含累計淨利 */
export function getMonthlyData(
  revenues: RevenueItem[],
  expenses: ExpenseItem[],
): MonthlyData[] {
  const map = new Map<string, { revenue: number; expenses: number }>();

  for (const r of revenues) {
    const m = toMonthKey(r.date);
    const cur = map.get(m) ?? { revenue: 0, expenses: 0 };
    cur.revenue += r.amount;
    map.set(m, cur);
  }
  for (const e of expenses) {
    const m = toMonthKey(e.date);
    const cur = map.get(m) ?? { revenue: 0, expenses: 0 };
    cur.expenses += e.amount;
    map.set(m, cur);
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  let cumNet = 0;

  return sorted.map(([month, d]) => {
    const net = d.revenue - d.expenses;
    cumNet += net;
    return {
      month,
      label: monthToShortLabel(month),
      revenue: d.revenue,
      expenses: d.expenses,
      net,
      cumNet,
    };
  });
}

/** 依日期區間篩選營收（首頁儀表板 / 報表自訂區間共用） */
export function filterRevenuesByDateRange(
  revenues: RevenueItem[],
  start: string,
  end: string,
): RevenueItem[] {
  return revenues.filter((r) => r.date >= start && r.date <= end);
}

/** 依日期區間篩選支出（首頁儀表板 / 報表自訂區間共用） */
export function filterExpensesByDateRange(
  expenses: ExpenseItem[],
  start: string,
  end: string,
): ExpenseItem[] {
  return expenses.filter((e) => e.date >= start && e.date <= end);
}

/** 取得本週一到本週日的 ISO 日期（週一為起始） */
export function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: toISO(monday), end: toISO(sunday) };
}

// ── 格式化工具 ─────────────────────────────────────────────────────────────

/** 千分位格式（正數） */
export function fmt(amount: number): string {
  return Math.abs(amount).toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** 帶符號千分位（負數顯示 −$N） */
export function fmtSigned(amount: number): string {
  return `${amount < 0 ? '−' : ''}$${fmt(amount)}`;
}

/** 百分比格式 */
export function fmtPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/** 安全除法（分母為 0 時回傳 0） */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ── P&L 核心計算（唯一真值來源）─────────────────────────────────────────────

export interface PnlCalcParams {
  grossRevenue:     number;
  operatingExpenses:number;
  yearEndBonus:     number;
  taxRate:          number;  // 百分比，如 5 代表 5%
  employeeBonusPct: number;  // 百分比
  reserveRate:      number;  // 百分比
}

export interface PnlCalcResult {
  netBeforeTax:       number;
  taxAmount:          number;
  employeeBonus:      number;
  shareholderSurplus: number;
  reservedSurplus:    number;
  finalDistributable: number;
}

/**
 * 股東財務 P&L 計算核心（ShareholderTab 畫面與 Excel 匯出共用）。
 *
 * 商業規則（按季 / 全期總額累計發放）：
 *
 * ① 所得稅：只在稅前淨利 > 0 時課徵（虧損不計負稅）
 *
 * ② 員工紅利：對「稅後淨利」無條件套用比例，虧損月得到負值。
 *    虧損月的負數員工紅利代表「分紅池平抑損失」：
 *      虧損月 finalDistributable = netBeforeTax × (1 − employeeBonusPct%)
 *    此設計確保縱向（Total × rate）與橫向（Σ 各月紅利）絕對一致。
 *
 * ③ 預留盈餘：只在股東盈餘 > 0 時計提（虧損月不扣）
 */
export function calcPnl(p: PnlCalcParams): PnlCalcResult {
  const netBeforeTax = p.grossRevenue - p.operatingExpenses - p.yearEndBonus;

  // ① 所得稅（虧損月為 0）
  const taxAmount   = netBeforeTax > 0 ? netBeforeTax * (p.taxRate / 100) : 0;
  const netAfterTax = netBeforeTax - taxAmount;

  // ② 員工紅利：無條件計算，虧損月自動為負（平抑分紅池）
  const employeeBonus      = netAfterTax * (p.employeeBonusPct / 100);
  const shareholderSurplus = netAfterTax - employeeBonus;

  // ③ 預留盈餘（股東盈餘 ≤ 0 時跳過）
  const reservedSurplus    = shareholderSurplus > 0
    ? shareholderSurplus * (p.reserveRate / 100)
    : 0;
  const finalDistributable = shareholderSurplus - reservedSurplus;

  return { netBeforeTax, taxAmount, employeeBonus, shareholderSurplus, reservedSurplus, finalDistributable };
}
