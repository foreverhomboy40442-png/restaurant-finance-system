/**
 * 報表中心 — 示範資料播種器
 *
 * 功能：
 * - 播種 2026 年 1-4 月符合千萬年營收規模的真實感示範數據
 * - 採「audited」狀態（非 locked），不觸發防篡改防線
 * - 僅在使用者明確點擊「載入示範資料」時才執行，不自動污染
 * - 播種前比對月份，避免重複寫入
 */

import { createFinancialDate, createMoney } from '../../../types/core';
import type { ExpenseItem, RevenueItem } from '../../../types';
import {
  loadExpenses,
  loadRevenues,
  saveExpense,
  saveRevenue,
} from '../../../services/storage';

// ── 唯一 ID 生成器 ─────────────────────────────────────────────────────────

let _seedCounter = 0;
function genId(): string {
  _seedCounter += 1;
  return `mock-${_seedCounter}-${Date.now().toString(36)}`;
}

// ── 月份存在性檢查 ─────────────────────────────────────────────────────────

export function getMockMonthsPresent(revenues: RevenueItem[]): string[] {
  const MOCK_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04'];
  const existing = new Set(revenues.map((r) => r.date.substring(0, 7)));
  return MOCK_MONTHS.filter((m) => existing.has(m));
}

// ── 週次日期輔助 ───────────────────────────────────────────────────────────

/** 週結算日：每月 7、14、21、28 日 */
const WEEK_DAYS = [7, 14, 21, 28] as const;

function date(ym: string, day: number): string {
  const [y, m] = ym.split('-');
  return `${y}-${m}-${String(day).padStart(2, '0')}`;
}

// ── 月度示範數據定義 ───────────────────────────────────────────────────────

interface WeekRevEntry {
  period: 'lunch' | 'dinner';
  amount: number;
}

interface MonthRevenueSpec {
  ym: string;
  weeklyEntries: WeekRevEntry[]; // 每週重複 4 次
}

interface ExpenseEntry {
  day: number;
  category: 'ingredients' | 'labor' | 'rent' | 'utilities' | 'marketing' | 'other';
  amount: number;
  merchant: string;
  note: string;
}

interface MonthExpenseSpec {
  ym: string;
  entries: ExpenseEntry[];
}

// ── 1-4 月營收規格 ─────────────────────────────────────────────────────────
// 週合計 = 287,000 | 244,500 | 316,250 | 299,500（各 × 4 = 月合計）
// 月合計：1,148,000 | 978,000 | 1,265,000 | 1,198,000

// 週合計：287,000 | 244,500 | 316,250 | 299,500（各 × 4 = 月合計）
// 月合計：1,148,000 | 978,000 | 1,265,000 | 1,198,000
const MONTH_REVENUE_SPECS: MonthRevenueSpec[] = [
  {
    ym: '2026-01',
    weeklyEntries: [
      { period: 'lunch',  amount: 114800 },
      { period: 'dinner', amount: 172200 },
    ],
  },
  {
    ym: '2026-02',
    weeklyEntries: [
      { period: 'lunch',  amount: 97800 },
      { period: 'dinner', amount: 146700 },
    ],
  },
  {
    ym: '2026-03',
    weeklyEntries: [
      { period: 'lunch',  amount: 126500 },
      { period: 'dinner', amount: 189750 },
    ],
  },
  {
    ym: '2026-04',
    weeklyEntries: [
      { period: 'lunch',  amount: 119800 },
      { period: 'dinner', amount: 179700 },
    ],
  },
];

// ── 1-4 月支出規格 ─────────────────────────────────────────────────────────
// 月合計：855,000 | 742,000 | 922,000 | 878,000

const MONTH_EXPENSE_SPECS: MonthExpenseSpec[] = [
  {
    ym: '2026-01',
    entries: [
      // 固定成本
      { day: 1,  category: 'rent',        amount: 85000,  merchant: '房東',       note: '月租金' },
      { day: 5,  category: 'utilities',   amount: 17800,  merchant: '台電/自來水', note: '1月電費水費' },
      { day: 5,  category: 'utilities',   amount: 4700,   merchant: '台灣中油',    note: '1月瓦斯費' },
      // 食材（週採購）
      { day: 7,  category: 'ingredients', amount: 109000, merchant: '阿隆蔬菜',   note: '週蔬菜採購' },
      { day: 14, category: 'ingredients', amount: 109000, merchant: '雞肉批發行', note: '週雞肉/乾貨' },
      { day: 21, category: 'ingredients', amount: 109000, merchant: '阿隆蔬菜',   note: '週食材補購' },
      { day: 28, category: 'ingredients', amount: 109000, merchant: '現場補購',   note: '週食材補購' },
      // 人事（正職 / 大廚 — 月中發薪）
      { day: 15, category: 'labor',       amount: 50000,  merchant: '大廚',       note: '大廚底薪' },
      { day: 15, category: 'labor',       amount: 38000,  merchant: '正職員工A',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 35000,  merchant: '正職員工B',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 8000,   merchant: '全勤獎金',   note: '全勤補貼' },
      // PT（週發）
      { day: 7,  category: 'labor',       amount: 38750,  merchant: 'PT點工',     note: '林安邦/陳東海/Dee/拖地/洗碗/垃圾' },
      { day: 14, category: 'labor',       amount: 38750,  merchant: 'PT點工',     note: '林安邦/陳東海/Dee/拖地/洗碗/垃圾' },
      { day: 21, category: 'labor',       amount: 38750,  merchant: 'PT點工',     note: '林安邦/陳東海/Dee/拖地/洗碗/垃圾' },
      { day: 28, category: 'labor',       amount: 38750,  merchant: 'PT點工',     note: '林安邦/陳東海/Dee/拖地/洗碗/垃圾' },
      // 雜支
      { day: 25, category: 'other',       amount: 12500,  merchant: '清潔備品行', note: '清潔耗材/備品' },
      { day: 28, category: 'other',       amount: 13000,  merchant: '包材供應商', note: '便當盒/包裝耗材' },
      // 月合計：85000+17800+4700+436000+131000+155000+25500 = 855,000
    ],
  },
  {
    ym: '2026-02',
    entries: [
      { day: 1,  category: 'rent',        amount: 85000,  merchant: '房東',       note: '月租金' },
      { day: 5,  category: 'utilities',   amount: 17200,  merchant: '台電/自來水', note: '2月電費水費' },
      { day: 5,  category: 'utilities',   amount: 4300,   merchant: '台灣中油',    note: '2月瓦斯費' },
      { day: 7,  category: 'ingredients', amount: 92750,  merchant: '阿隆蔬菜',   note: '週食材採購' },
      { day: 14, category: 'ingredients', amount: 92750,  merchant: '雞肉批發行', note: '週雞肉/乾貨' },
      { day: 21, category: 'ingredients', amount: 92750,  merchant: '阿隆蔬菜',   note: '週食材補購' },
      { day: 28, category: 'ingredients', amount: 92750,  merchant: '現場補購',   note: '春節後補購' },
      { day: 15, category: 'labor',       amount: 50000,  merchant: '大廚',       note: '大廚底薪' },
      { day: 15, category: 'labor',       amount: 38000,  merchant: '正職員工A',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 35000,  merchant: '正職員工B',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 8000,   merchant: '全勤獎金',   note: '全勤補貼' },
      { day: 7,  category: 'labor',       amount: 29500,  merchant: 'PT點工',     note: '週點工費' },
      { day: 14, category: 'labor',       amount: 29500,  merchant: 'PT點工',     note: '週點工費' },
      { day: 21, category: 'labor',       amount: 29500,  merchant: 'PT點工',     note: '週點工費' },
      { day: 28, category: 'labor',       amount: 29500,  merchant: 'PT點工',     note: '週點工費' },
      { day: 25, category: 'other',       amount: 7500,   merchant: '清潔備品行', note: '清潔耗材' },
      { day: 28, category: 'other',       amount: 8000,   merchant: '包材供應商', note: '耗材補購' },
      // 月合計：742,000
    ],
  },
  {
    ym: '2026-03',
    entries: [
      { day: 1,  category: 'rent',        amount: 85000,  merchant: '房東',       note: '月租金' },
      { day: 5,  category: 'utilities',   amount: 18200,  merchant: '台電/自來水', note: '3月電費水費' },
      { day: 5,  category: 'utilities',   amount: 4800,   merchant: '台灣中油',    note: '3月瓦斯費' },
      { day: 7,  category: 'ingredients', amount: 120000, merchant: '阿隆蔬菜',   note: '週食材採購' },
      { day: 14, category: 'ingredients', amount: 120000, merchant: '雞肉批發行', note: '週雞肉/乾貨' },
      { day: 21, category: 'ingredients', amount: 120000, merchant: '阿隆蔬菜',   note: '週食材補購' },
      { day: 28, category: 'ingredients', amount: 120000, merchant: '現場補購',   note: '週食材補購' },
      { day: 15, category: 'labor',       amount: 50000,  merchant: '大廚',       note: '大廚底薪' },
      { day: 15, category: 'labor',       amount: 38000,  merchant: '正職員工A',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 35000,  merchant: '正職員工B',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 8000,   merchant: '全勤獎金',   note: '全勤補貼' },
      { day: 7,  category: 'labor',       amount: 44250,  merchant: 'PT點工',     note: '週點工費' },
      { day: 14, category: 'labor',       amount: 44250,  merchant: 'PT點工',     note: '週點工費' },
      { day: 21, category: 'labor',       amount: 44250,  merchant: 'PT點工',     note: '週點工費' },
      { day: 28, category: 'labor',       amount: 44250,  merchant: 'PT點工',     note: '週點工費' },
      { day: 25, category: 'other',       amount: 13000,  merchant: '清潔備品行', note: '清潔耗材' },
      { day: 28, category: 'other',       amount: 13000,  merchant: '包材供應商', note: '耗材/備品' },
      // 月合計：922,000
    ],
  },
  {
    ym: '2026-04',
    entries: [
      { day: 1,  category: 'rent',        amount: 85000,  merchant: '房東',       note: '月租金' },
      { day: 5,  category: 'utilities',   amount: 17500,  merchant: '台電/自來水', note: '4月電費水費' },
      { day: 5,  category: 'utilities',   amount: 4500,   merchant: '台灣中油',    note: '4月瓦斯費' },
      { day: 7,  category: 'ingredients', amount: 113875, merchant: '阿隆蔬菜',   note: '週食材採購' },
      { day: 14, category: 'ingredients', amount: 113875, merchant: '雞肉批發行', note: '週雞肉/乾貨' },
      { day: 21, category: 'ingredients', amount: 113875, merchant: '阿隆蔬菜',   note: '週食材補購' },
      { day: 28, category: 'ingredients', amount: 113875, merchant: '現場補購',   note: '週食材補購' },
      { day: 15, category: 'labor',       amount: 50000,  merchant: '大廚',       note: '大廚底薪' },
      { day: 15, category: 'labor',       amount: 38000,  merchant: '正職員工A',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 35000,  merchant: '正職員工B',  note: '底薪' },
      { day: 15, category: 'labor',       amount: 8000,   merchant: '全勤獎金',   note: '全勤補貼' },
      { day: 7,  category: 'labor',       amount: 41625,  merchant: 'PT點工',     note: '週點工費' },
      { day: 14, category: 'labor',       amount: 41625,  merchant: 'PT點工',     note: '週點工費' },
      { day: 21, category: 'labor',       amount: 41625,  merchant: 'PT點工',     note: '週點工費' },
      { day: 28, category: 'labor',       amount: 41625,  merchant: 'PT點工',     note: '週點工費' },
      { day: 25, category: 'other',       amount: 9000,   merchant: '清潔備品行', note: '清潔耗材' },
      { day: 28, category: 'other',       amount: 9000,   merchant: '包材供應商', note: '耗材補購' },
      // 月合計：878,000
    ],
  },
];

// ── 主播種函式 ─────────────────────────────────────────────────────────────

/**
 * 播種示範資料。
 * 回傳 `true` 表示成功寫入，`false` 表示已存在（跳過）。
 */
export function seedMockData(): boolean {
  const existingRevenues = loadRevenues();
  const existingExpenses = loadExpenses();

  const alreadyPresent = getMockMonthsPresent(existingRevenues);
  if (alreadyPresent.length >= 4) {
    return false;
  }

  const alreadyPresentSet = new Set(alreadyPresent);
  const newRevenues: RevenueItem[] = [];
  const newExpenses: ExpenseItem[] = [];

  for (const spec of MONTH_REVENUE_SPECS) {
    if (alreadyPresentSet.has(spec.ym)) continue;

    for (const weekDay of WEEK_DAYS) {
      const d = date(spec.ym, weekDay);
      for (const entry of spec.weeklyEntries) {
        try {
          newRevenues.push({
            id: genId(),
            date: createFinancialDate(d),
            period: entry.period,
            amount: createMoney(entry.amount),
            operatorId: 'mock-seed',
            auditStatus: 'audited',
            note: '示範資料',
            createdAt: new Date(`${d}T09:00:00`).toISOString(),
          });
        } catch {
          // skip invalid
        }
      }
    }
  }

  for (const spec of MONTH_EXPENSE_SPECS) {
    if (alreadyPresentSet.has(spec.ym)) continue;

    for (const entry of spec.entries) {
      const d = date(spec.ym, entry.day);
      try {
        newExpenses.push({
          id: genId(),
          date: createFinancialDate(d),
          category: entry.category,
          amount: createMoney(entry.amount),
          merchant: entry.merchant,
          operatorId: 'mock-seed',
          auditStatus: 'audited',
          note: entry.note,
          createdAt: new Date(`${d}T08:00:00`).toISOString(),
        });
      } catch {
        // skip invalid
      }
    }
  }

  if (newRevenues.length > 0 || newExpenses.length > 0) {
    saveRevenue([...existingRevenues, ...newRevenues]);
    saveExpense([...existingExpenses, ...newExpenses]);
  }

  return true;
}
