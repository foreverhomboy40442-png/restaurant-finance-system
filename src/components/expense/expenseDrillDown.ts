/**
 * 支出結構分析 — 五大類別與子科目分組（與支出入帳分頁對齊）
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕 / 固定支出
 * 內圈：僅顯示各分頁快捷鍵已定義的項目，其餘併入該分頁的兜底項目（如 PT、其他）
 */

import type { ExpenseItem } from '../../types';
import { EXPENSE_CATEGORY, EXPENSE_CATEGORY_LABEL } from '../../types';
import { QUICK_KEYS_BY_TAB, type ExpenseTab } from './quick-keys-config';

export const PAYMENT_MERCHANT_SET = new Set([
  '檯布', '惠通', '酒', '大友(二)',
  '惠通(一)', '惠通(二)',
]);

const LEGACY_MERCHANT_ALIASES: Record<string, string> = {
  '惠通(一)': '惠通',
  '惠通(二)': '惠通',
};

/** 無法對應到快捷鍵項目時，併入各分頁既有的兜底標籤 */
const TAB_FALLBACK_LABEL: Record<ExpenseTab, string> = {
  cash: '其他',
  pt: 'PT',
  payment: '其他',
  repair: '其他',
  fixed_salary: '正職薪資',
};

/** 舊資料 / 資料庫 fallback 名稱 → 快捷鍵項目 */
const SUB_LABEL_ALIASES: Record<string, string> = {
  'PT 薪資': 'PT',
  'PT薪資': 'PT',
  '支出': '其他',
  '雜支': '其他',
  '食材': '其他',
  '水電': '其他',
  '行銷': '其他',
  '固定支出': '正職薪資',
  '裝潢': '修繕',
  '冷氣': '修繕',
  '燈泡': '修繕',
};

function normalizeMerchant(merchant: string): string {
  const trimmed = merchant.trim();
  return LEGACY_MERCHANT_ALIASES[trimmed] ?? trimmed;
}

/** 判定一筆支出屬於哪個入帳分頁（與 ExpenseManagement 五大 Tab 一致） */
export function classifyExpenseTab(item: ExpenseItem): ExpenseTab {
  if (item.category === EXPENSE_CATEGORY.REPAIR) return 'repair';
  if (
    item.category === EXPENSE_CATEGORY.FIXED_SALARY ||
    item.category === EXPENSE_CATEGORY.RENT
  ) {
    return 'fixed_salary';
  }
  if (item.category === EXPENSE_CATEGORY.LABOR) return 'pt';
  if (
    PAYMENT_MERCHANT_SET.has(normalizeMerchant(item.merchant)) ||
    (typeof item.note === 'string' && item.note.includes('支付貨款'))
  ) {
    return 'payment';
  }
  return 'cash';
}

/** 從原始紀錄解析子科目名稱（供應商 → 備註 → 科目標籤） */
export function resolveExpenseSubLabel(item: ExpenseItem): string {
  const merchant = normalizeMerchant(item.merchant);
  const note = item.note?.trim();

  if (item.category === EXPENSE_CATEGORY.REPAIR && note) {
    if (!merchant || merchant === '修繕') return note;
  }

  if (merchant) return merchant;
  if (note) return note;
  return EXPENSE_CATEGORY_LABEL[item.category];
}

/** 各分頁快捷鍵允許出現在圖表上的項目集合 */
export function getAllowedSubLabelSet(tab: ExpenseTab): Set<string> {
  const labels = new Set<string>();
  for (const key of QUICK_KEYS_BY_TAB[tab]) {
    labels.add(key.label);
    if (key.merchant.trim()) labels.add(key.merchant);
    if (key.merchantOptions) {
      for (const name of key.merchantOptions) labels.add(name);
    }
  }
  return labels;
}

/** 將任意名稱映射到該分頁快捷鍵項目（杜絕圖表出現未定義的新項目） */
export function normalizeToAllowedSubLabel(tab: ExpenseTab, raw: string): string {
  const allowed = getAllowedSubLabelSet(tab);
  const trimmed = raw.trim();

  if (allowed.has(trimmed)) return trimmed;

  const aliased = SUB_LABEL_ALIASES[trimmed];
  if (aliased && allowed.has(aliased)) return aliased;

  const fallback = TAB_FALLBACK_LABEL[tab];
  return allowed.has(fallback) ? fallback : fallback;
}

export interface SubCategoryBucket {
  label: string;
  value: number;
}

/** 依分頁加總各子科目，僅顯示快捷鍵項目，依金額遞減排序 */
export function buildSubCategoryBuckets(
  expenses: ExpenseItem[],
  tab: ExpenseTab,
): SubCategoryBucket[] {
  const buckets = new Map<string, number>();

  for (const e of expenses) {
    if (classifyExpenseTab(e) !== tab) continue;
    const raw = resolveExpenseSubLabel(e);
    const label = normalizeToAllowedSubLabel(tab, raw);
    buckets.set(label, (buckets.get(label) ?? 0) + e.amount);
  }

  return [...buckets.entries()]
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
