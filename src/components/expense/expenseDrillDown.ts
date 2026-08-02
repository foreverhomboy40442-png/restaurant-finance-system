/**
 * 支出結構分析 — 五大類別與子科目分組（與支出入帳分頁對齊）
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕 / 固定支出
 * 內圈：僅顯示各分頁快捷鍵已定義的項目
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

/** 僅映射「錯誤/舊格式」名稱，勿將 菜金/油條 等子項目映射到 其他 */
const SUB_LABEL_ALIASES: Record<string, string> = {
  'PT 薪資': 'PT',
  'PT薪資': 'PT',
  '固定支出': '正職薪資',
  '裝潢': '修繕',
  '冷氣': '修繕',
  '燈泡': '修繕',
};

const GENERIC_SUB_LABELS = new Set([
  ...Object.values(EXPENSE_CATEGORY_LABEL),
  '支出',
]);

function normalizeMerchant(merchant: string): string {
  const trimmed = merchant.trim();
  return LEGACY_MERCHANT_ALIASES[trimmed] ?? trimmed;
}

function isGenericSubLabel(text: string): boolean {
  return GENERIC_SUB_LABELS.has(text.trim());
}

/** 判定一筆支出屬於哪個入帳分頁（與 ExpenseManagement 五大 Tab 一致） */
export function classifyExpenseTab(item: ExpenseItem): ExpenseTab {
  const merchant = normalizeMerchant(item.merchant);

  if (item.category === EXPENSE_CATEGORY.REPAIR) return 'repair';
  if (
    item.category === EXPENSE_CATEGORY.FIXED_SALARY ||
    item.category === EXPENSE_CATEGORY.RENT
  ) {
    return 'fixed_salary';
  }
  if (item.category === EXPENSE_CATEGORY.LABOR) return 'pt';
  if (
    PAYMENT_MERCHANT_SET.has(merchant) ||
    (typeof item.note === 'string' && item.note.includes('支付貨款'))
  ) {
    return 'payment';
  }
  return 'cash';
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

/** 在允許集合中尋找最匹配的快捷鍵項目名稱 */
function matchAllowedSubLabel(text: string, allowed: Set<string>): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (allowed.has(trimmed)) return trimmed;

  const aliased = SUB_LABEL_ALIASES[trimmed];
  if (aliased && allowed.has(aliased)) return aliased;

  const candidates = [...allowed]
    .filter((label) => label.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const label of candidates) {
    if (trimmed.includes(label)) return label;
  }

  return null;
}

/**
 * 解析一筆支出在指定分頁下應顯示的子科目（必為快捷鍵項目之一）
 */
export function resolveExpenseSubLabel(item: ExpenseItem, tab: ExpenseTab): string {
  const allowed = getAllowedSubLabelSet(tab);
  const merchant = normalizeMerchant(item.merchant);
  const note = item.note?.trim() ?? '';

  // 1. 明確的子項目名稱（菜金、油條、林安邦…）
  if (merchant && !isGenericSubLabel(merchant)) {
    const matched = matchAllowedSubLabel(merchant, allowed);
    if (matched) return matched;
  }

  // 2. 備註中可能含有子項目關鍵字
  if (note) {
    const fromNote = matchAllowedSubLabel(note, allowed);
    if (fromNote) return fromNote;
  }

  // 3. 水電：依備註或 merchant 關鍵字分到電費 / 瓦斯
  if (tab === 'cash' && item.category === EXPENSE_CATEGORY.UTILITIES) {
    const hint = `${merchant} ${note}`;
    if (hint.includes('瓦斯') && allowed.has('瓦斯')) return '瓦斯';
    if ((hint.includes('電') || hint.includes('電費')) && allowed.has('電費')) return '電費';
  }

  // 4. 舊格式別名（PT 薪資 → PT）
  if (merchant) {
    const aliased = SUB_LABEL_ALIASES[merchant];
    if (aliased && allowed.has(aliased)) return aliased;
  }

  return TAB_FALLBACK_LABEL[tab];
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
    const label = resolveExpenseSubLabel(e, tab);
    buckets.set(label, (buckets.get(label) ?? 0) + e.amount);
  }

  return [...buckets.entries()]
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
