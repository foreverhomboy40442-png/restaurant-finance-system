/**
 * 粵香園帳務系統 — 每日交易核心資料模型
 *
 * 本檔案定義「每日交易」模組的兩筆核心實體：
 * - RevenueItem：單筆營收明細（上午 / 下午 / 全日）
 * - ExpenseItem：單筆支出明細（食材、人事、房租等科目）
 *
 * 所有金額、日期、審計狀態皆引用 {@link ./core} 的原子型別，不在此重複定義。
 */

import type { AuditStatus, FinancialDate, Money } from './core';

// ---------------------------------------------------------------------------
// 一、營收明細（RevenueItem）
// ---------------------------------------------------------------------------

/**
 * 餐期分類。
 *
 * PRD 對應：每日交易「上午營收 / 下午營收」；`all_day` 保留給不分餐期的整筆入帳。
 */
export type RevenuePeriod = 'lunch' | 'dinner' | 'all_day';

/** 餐期分類常數值 */
export const REVENUE_PERIOD = {
  /** 上午 / 午餐時段 */
  LUNCH: 'lunch',
  /** 下午 / 晚餐時段 */
  DINNER: 'dinner',
  /** 全日（不分餐期） */
  ALL_DAY: 'all_day',
} as const satisfies Record<string, RevenuePeriod>;

/** 餐期分類中文標籤（供 UI 下拉選單、列表渲染） */
export const REVENUE_PERIOD_LABEL: Record<RevenuePeriod, string> = {
  lunch: '上午',
  dinner: '下午',
  all_day: '全日',
};

/**
 * 營收明細。
 *
 * 代表一筆已入帳的營收紀錄。同一 {@link FinancialDate} 下可有多筆明細
 * （例如上午現金、下午信用卡、小費等），報表層再依日期加總。
 *
 * 欄位說明：
 * - `date`：財務歸屬日，由「當日 / 前一日 / 自訂日期」轉換而來
 * - `createdAt`：使用者實際操作時間（ISO 8601），與 `date` 語意不同
 * - `auditStatus`：草稿可編輯；audited / locked 進入唯讀防線
 */
export interface RevenueItem {
  /** 全系統唯一識別碼（建議 UUID） */
  id: string;
  /** 財務歸屬日：此筆營收算在哪一天 */
  date: FinancialDate;
  /** 餐期分類：上午 / 下午 / 全日 */
  period: RevenuePeriod;
  /** 營收金額（元，TWD） */
  amount: Money;
  /** 經手人 / 登入員工 ID，供稽核追蹤 */
  operatorId: string;
  /** 帳目審計狀態 */
  auditStatus: AuditStatus;
  /** 備註（選填），如：外送平台結算差異、特殊說明 */
  note?: string;
  /** 操作時間戳記（ISO 8601），記錄實際入帳時刻 */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 二、支出明細（ExpenseItem）
// ---------------------------------------------------------------------------

/**
 * 支出科目分類。
 *
 * 對應餐廳日常成本結構，供報表依大類聚合。
 */
export type ExpenseCategory =
  | 'ingredients'
  | 'labor'
  | 'rent'
  | 'utilities'
  | 'marketing'
  | 'repair'
  | 'fixed_salary'
  | 'other';

/** 支出科目常數值 */
export const EXPENSE_CATEGORY = {
  /** 食材採購（菜金、雞、乾貨等） */
  INGREDIENTS: 'ingredients',
  /** PT 點工薪資 */
  LABOR: 'labor',
  /** 房租 */
  RENT: 'rent',
  /** 水電瓦斯等公用事業 */
  UTILITIES: 'utilities',
  /** 行銷推廣 */
  MARKETING: 'marketing',
  /** 修繕費用（裝潢、冷氣、燈泡等） */
  REPAIR: 'repair',
  /** 固定薪資（正式員工） */
  FIXED_SALARY: 'fixed_salary',
  /** 其他雜支 */
  OTHER: 'other',
} as const satisfies Record<string, ExpenseCategory>;

/** 支出科目中文標籤（供 UI 渲染） */
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  ingredients: '食材',
  labor: 'PT 薪資',
  rent: '房租',
  utilities: '水電',
  marketing: '行銷',
  repair: '修繕',
  fixed_salary: '固定支出',
  other: '雜支',
};

/**
 * 支出明細。
 *
 * 代表一筆已入帳的支出紀錄，涵蓋現金支出、PT 薪資、採購等場景。
 * 同一 {@link FinancialDate} 下可有多筆明細，報表層再依科目加總。
 *
 * 欄位說明：
 * - `merchant`：供應商或店家名稱（如：阿隆蔬菜、某水電公司）
 * - `invoiceNumber`：發票或收據號碼（選填），供對帳與稽核
 * - `note`：備註（選填），如 PT 項目名稱、修繕說明
 */
export interface ExpenseItem {
  /** 全系統唯一識別碼（建議 UUID） */
  id: string;
  /** 財務歸屬日：此筆支出算在哪一天 */
  date: FinancialDate;
  /** 支出科目大類 */
  category: ExpenseCategory;
  /** 支出金額（元，TWD） */
  amount: Money;
  /** 供應商 / 店家名稱 */
  merchant: string;
  /** 發票或收據號碼（選填） */
  invoiceNumber?: string;
  /** 經手人 / 登入員工 ID，供稽核追蹤 */
  operatorId: string;
  /** 帳目審計狀態 */
  auditStatus: AuditStatus;
  /** 備註（選填） */
  note?: string;
  /** 操作時間戳記（ISO 8601），記錄實際入帳時刻 */
  createdAt: string;
}
