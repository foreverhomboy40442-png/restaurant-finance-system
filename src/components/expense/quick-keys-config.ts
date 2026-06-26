/**
 * 粵香園帳務系統 — 支出管理快捷鍵設定
 *
 * 五分頁結構：
 *   1. 現金支出 (cash)        — 食材、雜支、電費、瓦斯
 *   2. PT 薪資 (pt)           — 點工人員
 *   3. 支付貨款 (payment)     — 供應商貨款
 *   4. 修繕費用 (repair)      — 裝潢、冷氣、燈泡等維修
 *   5. 固定支出 (fixed_salary) — 正職薪資（下拉選員工）＋ 房租
 */

import type { ExpenseCategory } from '../../types';
import { EXPENSE_CATEGORY } from '../../types';

// ---------------------------------------------------------------------------
// 型別定義
// ---------------------------------------------------------------------------

export interface QuickKeyItem {
  key: string;
  label: string;
  /** 預設自動帶入的供應商；空字串代表需使用者選擇或填寫 */
  merchant: string;
  category: ExpenseCategory;
  defaultNote?: string;
  suggestedNotes?: string[];
  /** 當設定此陣列時，AmountInputModal 的供應商欄位改為下拉選單 */
  merchantOptions?: readonly string[];
}

export type ExpenseTab = 'cash' | 'pt' | 'payment' | 'repair' | 'fixed_salary';

export const EXPENSE_TAB_LABEL: Record<ExpenseTab, string> = {
  cash:         '現金支出',
  pt:           'PT 薪資',
  payment:      '支付貨款',
  repair:       '修繕費用',
  fixed_salary: '固定支出',
};

// ---------------------------------------------------------------------------
// 分頁一：現金支出（移入電費 / 瓦斯；菜金改純自填）
// ---------------------------------------------------------------------------

export const CASH_QUICK_KEYS: QuickKeyItem[] = [
  {
    key: 'cash-菜金',
    label: '菜金',
    merchant: '菜金',
    category: EXPENSE_CATEGORY.INGREDIENTS,
    // 移除固定廠商下拉，讓老闆自由備註
  },
  {
    key: 'cash-油條',
    label: '油條',
    merchant: '油條',
    category: EXPENSE_CATEGORY.INGREDIENTS,
  },
  {
    key: 'cash-雞',
    label: '雞',
    merchant: '雞',
    category: EXPENSE_CATEGORY.INGREDIENTS,
  },
  {
    key: 'cash-乾貨',
    label: '乾貨',
    merchant: '乾貨',
    category: EXPENSE_CATEGORY.INGREDIENTS,
  },
  {
    key: 'cash-便當盒',
    label: '便當盒',
    merchant: '便當盒',
    category: EXPENSE_CATEGORY.OTHER,
  },
  {
    key: 'cash-雜貨',
    label: '雜貨',
    merchant: '雜貨',
    category: EXPENSE_CATEGORY.OTHER,
  },
  {
    key: 'cash-電費',
    label: '電費',
    merchant: '電費',
    category: EXPENSE_CATEGORY.UTILITIES,
  },
  {
    key: 'cash-瓦斯',
    label: '瓦斯',
    merchant: '瓦斯',
    category: EXPENSE_CATEGORY.UTILITIES,
  },
  {
    key: 'cash-其他',
    label: '其他',
    merchant: '',
    category: EXPENSE_CATEGORY.OTHER,
  },
];

// ---------------------------------------------------------------------------
// 分頁二：PT 薪資（移除電費 / 瓦斯）
// ---------------------------------------------------------------------------

export const PT_QUICK_KEYS: QuickKeyItem[] = [
  {
    key: 'pt-拖地',
    label: '拖地',
    merchant: '拖地',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-收垃圾',
    label: '收垃圾',
    merchant: '收垃圾',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-林安邦',
    label: '林安邦',
    merchant: '林安邦',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-陳東海',
    label: '陳東海',
    merchant: '陳東海',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-林進賢',
    label: '林進賢',
    merchant: '林進賢',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-Dee',
    label: 'Dee',
    merchant: 'Dee',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-垃圾廚餘',
    label: '垃圾（廚餘）',
    merchant: '垃圾（廚餘）',
    category: EXPENSE_CATEGORY.LABOR,
  },
  {
    key: 'pt-洗碗',
    label: '洗碗',
    merchant: '洗碗',
    category: EXPENSE_CATEGORY.LABOR,
  },
];

// ---------------------------------------------------------------------------
// 分頁三：支付貨款
// ---------------------------------------------------------------------------

export const PAYMENT_QUICK_KEYS: QuickKeyItem[] = [
  {
    key: 'pay-檯布',
    label: '檯布',
    merchant: '檯布',
    category: EXPENSE_CATEGORY.OTHER,
    defaultNote: '支付貨款',
  },
  {
    key: 'pay-惠通一',
    label: '惠通(一)',
    merchant: '惠通(一)',
    category: EXPENSE_CATEGORY.INGREDIENTS,
    defaultNote: '支付貨款',
  },
  {
    key: 'pay-酒',
    label: '酒',
    merchant: '酒',
    category: EXPENSE_CATEGORY.INGREDIENTS,
    defaultNote: '支付貨款',
  },
  {
    key: 'pay-大友二',
    label: '大友(二)',
    merchant: '大友(二)',
    category: EXPENSE_CATEGORY.INGREDIENTS,
    defaultNote: '支付貨款',
  },
  {
    key: 'pay-惠通二',
    label: '惠通(二)',
    merchant: '惠通(二)',
    category: EXPENSE_CATEGORY.INGREDIENTS,
    defaultNote: '支付貨款',
  },
  {
    key: 'pay-其他',
    label: '其他',
    merchant: '',
    category: EXPENSE_CATEGORY.OTHER,
    defaultNote: '支付貨款',
  },
];

// ---------------------------------------------------------------------------
// 分頁四：修繕費用（備註下拉：裝潢 / 冷氣 / 燈泡 / 自填）
// ---------------------------------------------------------------------------

export const REPAIR_QUICK_KEYS: QuickKeyItem[] = [
  {
    key: 'repair-修繕',
    label: '修繕',
    merchant: '修繕',
    category: EXPENSE_CATEGORY.REPAIR,
    suggestedNotes: ['裝潢', '冷氣', '燈泡'],
  },
  {
    key: 'repair-其他',
    label: '其他',
    merchant: '',
    category: EXPENSE_CATEGORY.REPAIR,
  },
];

// ---------------------------------------------------------------------------
// 分頁五：固定支出（正職薪資下拉選員工 ＋ 房租）
// ---------------------------------------------------------------------------

const FIXED_SALARY_EMPLOYEES = [
  '曾美惠', '梁桂蓮', '林美玉', '陳速華', '陳棋瑞',
  '高雲鵬', '黃楚平', '林安邦', '陳世郎', '鍾耀霆',
  'Noel', '吳慧芬', '張綺蓮', '小惠', '吳啟德',
  '吳大衛', '鍾正綱',
] as const;

export const FIXED_SALARY_QUICK_KEYS: QuickKeyItem[] = [
  {
    key: 'fixed-正職薪資',
    label: '正職薪資',
    merchant: '',
    category: EXPENSE_CATEGORY.FIXED_SALARY,
    merchantOptions: FIXED_SALARY_EMPLOYEES,
  },
  {
    key: 'fixed-房租',
    label: '房租',
    merchant: '房租',
    category: EXPENSE_CATEGORY.RENT,
  },
];

// ---------------------------------------------------------------------------
// 彙整：依分頁索引
// ---------------------------------------------------------------------------

export const QUICK_KEYS_BY_TAB: Record<ExpenseTab, QuickKeyItem[]> = {
  cash:         CASH_QUICK_KEYS,
  pt:           PT_QUICK_KEYS,
  payment:      PAYMENT_QUICK_KEYS,
  repair:       REPAIR_QUICK_KEYS,
  fixed_salary: FIXED_SALARY_QUICK_KEYS,
};
