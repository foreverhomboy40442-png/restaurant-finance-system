/**
 * 支出結構分析 — 五大類別與子科目分組（與支出入帳分頁對齊）
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕 / 固定支出
 * 內圈：各分頁底下的實際項目（菜金、油條、林安邦…）分別加總
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

/** 子科目顯示名稱：供應商 → 備註 → 科目中文標籤 */
export function resolveExpenseSubLabel(item: ExpenseItem): string {
  const merchant = normalizeMerchant(item.merchant);
  const note = item.note?.trim();

  // 修繕：備註細分（裝潢 / 冷氣 / 燈泡）
  if (item.category === EXPENSE_CATEGORY.REPAIR && note) {
    if (!merchant || merchant === '修繕') return note;
  }

  if (merchant) return merchant;
  if (note) return note;
  return EXPENSE_CATEGORY_LABEL[item.category];
}

/** 各分頁快捷鍵定義的項目順序（作為圖表排序優先） */
export function getPreferredSubLabels(tab: ExpenseTab): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const key of QUICK_KEYS_BY_TAB[tab]) {
    if (key.label === '其他' && !key.merchant.trim()) continue;

    if (!seen.has(key.label)) {
      labels.push(key.label);
      seen.add(key.label);
    }

    if (key.merchant.trim() && key.merchant !== key.label && !seen.has(key.merchant)) {
      labels.push(key.merchant);
      seen.add(key.merchant);
    }

    if (key.merchantOptions) {
      for (const name of key.merchantOptions) {
        if (!seen.has(name)) {
          labels.push(name);
          seen.add(name);
        }
      }
    }
  }

  return labels;
}

export interface SubCategoryBucket {
  label: string;
  value: number;
}

/** 依分頁加總各子科目（每個項目獨立一行，不再整包歸「其他」） */
export function buildSubCategoryBuckets(
  expenses: ExpenseItem[],
  tab: ExpenseTab,
): SubCategoryBucket[] {
  const buckets = new Map<string, number>();

  for (const e of expenses) {
    if (classifyExpenseTab(e) !== tab) continue;
    const label = resolveExpenseSubLabel(e);
    buckets.set(label, (buckets.get(label) ?? 0) + e.amount);
  }

  const preferred = getPreferredSubLabels(tab);
  const result: SubCategoryBucket[] = [];
  const used = new Set<string>();

  for (const label of preferred) {
    const value = buckets.get(label);
    if (value !== undefined && value > 0) {
      result.push({ label, value });
      used.add(label);
    }
  }

  const extras = [...buckets.entries()]
    .filter(([label, value]) => value > 0 && !used.has(label))
    .sort((a, b) => b[1] - a[1]);

  for (const [label, value] of extras) {
    result.push({ label, value });
  }

  return result;
}
