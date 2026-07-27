/**
 * 粵香園帳務系統 — localStorage 資料讀寫層
 *
 * 職責：
 * - 持久化每日交易的營收 / 支出明細
 * - 寫入時防護已鎖定（locked）帳目不被篡改或刪除
 * - 讀取時以執行期驗證過濾髒資料，避免污染記憶體
 *
 * PRD 對應：在尚未串接後端前，所有交易資料即時讀寫 localStorage。
 */

import {
  AUDIT_STATUS,
  createFinancialDate,
  createMoney,
  isAuditStatus,
  isFinancialDate,
  isMoney,
  isLockedAuditStatus,
} from '../types/core';
import type { ExpenseItem, ExpenseCategory, RevenueItem, RevenuePeriod } from '../types/daily-transaction';
import {
  EXPENSE_CATEGORY,
  REVENUE_PERIOD,
} from '../types/daily-transaction';

// ---------------------------------------------------------------------------
// localStorage Key 定義
// ---------------------------------------------------------------------------

/** 營收明細列表的 localStorage 鍵名 */
export const RESTAURANT_REVENUE_STORAGE_KEY =
  'yuexiangyuan:revenue-items' as const;

/** 支出明細列表的 localStorage 鍵名 */
export const RESTAURANT_EXPENSE_STORAGE_KEY =
  'yuexiangyuan:expense-items' as const;

// ---------------------------------------------------------------------------
// 內部工具
// ---------------------------------------------------------------------------

/** 判斷是否在瀏覽器環境（SSR / 測試環境可能無 localStorage） */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 從 localStorage 讀取原始 JSON 字串；不存在時回傳 null */
function readRaw(key: string): string | null {
  if (!isBrowser()) {
    console.warn('[storage] 非瀏覽器環境，無法讀取 localStorage');
    return null;
  }
  return window.localStorage.getItem(key);
}

/** 將 JSON 字串寫入 localStorage */
function writeRaw(key: string, value: string): void {
  if (!isBrowser()) {
    console.warn('[storage] 非瀏覽器環境，無法寫入 localStorage');
    return;
  }
  window.localStorage.setItem(key, value);
}

/** 解析 JSON 為未知陣列；格式錯誤時回傳 null 並記錄錯誤 */
function parseJsonArray(raw: string, label: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`[storage] ${label} 資料格式錯誤：預期陣列，收到 ${typeof parsed}`);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(`[storage] ${label} JSON 解析失敗：`, error);
    return null;
  }
}

const REVENUE_PERIODS = new Set<string>(Object.values(REVENUE_PERIOD));
const EXPENSE_CATEGORIES = new Set<string>(Object.values(EXPENSE_CATEGORY));

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isRevenuePeriod(value: unknown): value is RevenuePeriod {
  return typeof value === 'string' && REVENUE_PERIODS.has(value);
}

function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && EXPENSE_CATEGORIES.has(value);
}

/**
 * 將未知物件驗證並轉換為 RevenueItem。
 * 驗證失敗回傳 null，並輸出警告（不拋出，避免單筆髒資料拖垮整包）。
 */
function parseRevenueItem(raw: unknown, index: number): RevenueItem | null {
  if (typeof raw !== 'object' || raw === null) {
    console.warn(`[storage] 營收明細 [${index}] 略過：非物件`);
    return null;
  }

  const item = raw as Record<string, unknown>;

  if (!isNonEmptyString(item.id)) {
    console.warn(`[storage] 營收明細 [${index}] 略過：id 不合法`);
    return null;
  }
  if (!isFinancialDate(item.date)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：date 不合法`);
    return null;
  }
  if (!isRevenuePeriod(item.period)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：period 不合法`);
    return null;
  }
  if (!isMoney(item.amount)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：amount 不合法`);
    return null;
  }
  if (!isNonEmptyString(item.operatorId)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：operatorId 不合法`);
    return null;
  }
  if (!isAuditStatus(item.auditStatus)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：auditStatus 不合法`);
    return null;
  }
  if (!isOptionalString(item.note)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：note 不合法`);
    return null;
  }
  if (!isNonEmptyString(item.createdAt)) {
    console.warn(`[storage] 營收明細 [${index}] (id=${item.id}) 略過：createdAt 不合法`);
    return null;
  }

  return {
    id: item.id,
    date: createFinancialDate(item.date),
    period: item.period,
    amount: createMoney(item.amount),
    operatorId: item.operatorId,
    auditStatus: item.auditStatus,
    ...(item.note !== undefined ? { note: item.note } : {}),
    createdAt: item.createdAt,
  };
}

/**
 * 將未知物件驗證並轉換為 ExpenseItem。
 * 驗證失敗回傳 null，並輸出警告。
 */
function parseExpenseItem(raw: unknown, index: number): ExpenseItem | null {
  if (typeof raw !== 'object' || raw === null) {
    console.warn(`[storage] 支出明細 [${index}] 略過：非物件`);
    return null;
  }

  const item = raw as Record<string, unknown>;

  if (!isNonEmptyString(item.id)) {
    console.warn(`[storage] 支出明細 [${index}] 略過：id 不合法`);
    return null;
  }
  if (!isFinancialDate(item.date)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：date 不合法`);
    return null;
  }
  if (!isExpenseCategory(item.category)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：category 不合法`);
    return null;
  }
  if (!isMoney(item.amount)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：amount 不合法`);
    return null;
  }
  if (!isNonEmptyString(item.merchant)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：merchant 不合法`);
    return null;
  }
  if (!isOptionalString(item.invoiceNumber)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：invoiceNumber 不合法`);
    return null;
  }
  if (!isNonEmptyString(item.operatorId)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：operatorId 不合法`);
    return null;
  }
  if (!isAuditStatus(item.auditStatus)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：auditStatus 不合法`);
    return null;
  }
  if (!isOptionalString(item.note)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：note 不合法`);
    return null;
  }
  if (!isNonEmptyString(item.createdAt)) {
    console.warn(`[storage] 支出明細 [${index}] (id=${item.id}) 略過：createdAt 不合法`);
    return null;
  }

  return {
    id: item.id,
    date: createFinancialDate(item.date),
    category: item.category,
    amount: createMoney(item.amount),
    merchant: item.merchant,
    ...(item.invoiceNumber !== undefined ? { invoiceNumber: item.invoiceNumber } : {}),
    operatorId: item.operatorId,
    auditStatus: item.auditStatus,
    ...(item.note !== undefined ? { note: item.note } : {}),
    createdAt: item.createdAt,
  };
}

/**
 * 比對兩筆營收明細的所有業務欄位是否完全一致。
 * 用於 locked 帳目的二次校對，防止非法篡改。
 */
function isSameRevenueItem(a: RevenueItem, b: RevenueItem): boolean {
  return (
    a.id === b.id &&
    a.date === b.date &&
    a.period === b.period &&
    a.amount === b.amount &&
    a.operatorId === b.operatorId &&
    a.auditStatus === b.auditStatus &&
    a.note === b.note &&
    a.createdAt === b.createdAt
  );
}

/**
 * 比對兩筆支出明細的所有業務欄位是否完全一致。
 */
function isSameExpenseItem(a: ExpenseItem, b: ExpenseItem): boolean {
  return (
    a.id === b.id &&
    a.date === b.date &&
    a.category === b.category &&
    a.amount === b.amount &&
    a.merchant === b.merchant &&
    a.invoiceNumber === b.invoiceNumber &&
    a.operatorId === b.operatorId &&
    a.auditStatus === b.auditStatus &&
    a.note === b.note &&
    a.createdAt === b.createdAt
  );
}

/**
 * 寫入前的 locked 帳目防篡改校對。
 *
 * 規則：
 * 1. 既有的 locked 明細不可被刪除
 * 2. 既有的 locked 明細不可被修改任何欄位
 * 3. 若 incoming 中含 locked 且該 id 已存在於 existing，必須與 existing 完全一致
 *
 * @throws 若偵測到對 locked 帳目的非法刪除或篡改
 */
function assertLockedRevenuesIntegrity(
  existing: RevenueItem[],
  incoming: RevenueItem[],
): void {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));

  for (const stored of existing) {
    if (!isLockedAuditStatus(stored.auditStatus)) {
      continue;
    }

    const matched = incomingById.get(stored.id);

    if (!matched) {
      console.error(
        `[storage] 防篡改攔截：試圖刪除已鎖定的營收明細 (id=${stored.id})`,
      );
      throw new Error(`禁止刪除已鎖定的營收明細：${stored.id}`);
    }

    if (!isSameRevenueItem(stored, matched)) {
      console.error(
        `[storage] 防篡改攔截：試圖修改已鎖定的營收明細 (id=${stored.id})`,
      );
      throw new Error(`禁止修改已鎖定的營收明細：${stored.id}`);
    }
  }

  for (const item of incoming) {
    if (!isLockedAuditStatus(item.auditStatus)) {
      continue;
    }

    const stored = existing.find((e) => e.id === item.id);
    if (stored && isLockedAuditStatus(stored.auditStatus) && !isSameRevenueItem(stored, item)) {
      console.error(
        `[storage] 防篡改攔截：locked 營收明細二次校對失敗 (id=${item.id})`,
      );
      throw new Error(`已鎖定營收明細資料不一致：${item.id}`);
    }
  }
}

/**
 * 支出明細的 locked 帳目防篡改校對（邏輯同營收）。
 */
function assertLockedExpensesIntegrity(
  existing: ExpenseItem[],
  incoming: ExpenseItem[],
): void {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));

  for (const stored of existing) {
    if (!isLockedAuditStatus(stored.auditStatus)) {
      continue;
    }

    const matched = incomingById.get(stored.id);

    if (!matched) {
      console.error(
        `[storage] 防篡改攔截：試圖刪除已鎖定的支出明細 (id=${stored.id})`,
      );
      throw new Error(`禁止刪除已鎖定的支出明細：${stored.id}`);
    }

    if (!isSameExpenseItem(stored, matched)) {
      console.error(
        `[storage] 防篡改攔截：試圖修改已鎖定的支出明細 (id=${stored.id})`,
      );
      throw new Error(`禁止修改已鎖定的支出明細：${stored.id}`);
    }
  }

  for (const item of incoming) {
    if (!isLockedAuditStatus(item.auditStatus)) {
      continue;
    }

    const stored = existing.find((e) => e.id === item.id);
    if (stored && isLockedAuditStatus(stored.auditStatus) && !isSameExpenseItem(stored, item)) {
      console.error(
        `[storage] 防篡改攔截：locked 支出明細二次校對失敗 (id=${item.id})`,
      );
      throw new Error(`已鎖定支出明細資料不一致：${item.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 公開 API — 讀取
// ---------------------------------------------------------------------------

/**
 * 從 localStorage 讀取並驗證所有營收明細。
 *
 * 防呆策略：
 * - 無資料 → 回傳空陣列
 * - JSON 損毀 → 回傳空陣列並記錄錯誤
 * - 單筆欄位不合法 → 略過該筆，僅回傳通過驗證的乾淨資料
 */
export function loadRevenues(): RevenueItem[] {
  const raw = readRaw(RESTAURANT_REVENUE_STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  const array = parseJsonArray(raw, '營收明細');
  if (array === null) {
    return [];
  }

  const valid: RevenueItem[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = parseRevenueItem(array[i], i);
    if (item !== null) {
      valid.push(item);
    }
  }

  if (valid.length < array.length) {
    console.warn(
      `[storage] 營收明細：${array.length - valid.length} 筆髒資料已過濾，${valid.length} 筆載入成功`,
    );
  }

  return valid;
}

/**
 * 從 localStorage 讀取並驗證所有支出明細。
 * 防呆策略同 {@link loadRevenues}。
 */
export function loadExpenses(): ExpenseItem[] {
  const raw = readRaw(RESTAURANT_EXPENSE_STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  const array = parseJsonArray(raw, '支出明細');
  if (array === null) {
    return [];
  }

  const valid: ExpenseItem[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = parseExpenseItem(array[i], i);
    if (item !== null) {
      valid.push(item);
    }
  }

  if (valid.length < array.length) {
    console.warn(
      `[storage] 支出明細：${array.length - valid.length} 筆髒資料已過濾，${valid.length} 筆載入成功`,
    );
  }

  return valid;
}

// ---------------------------------------------------------------------------
// 公開 API — 寫入
// ---------------------------------------------------------------------------

/**
 * 將營收明細列表寫入 localStorage。
 *
 * 寫入前防線：
 * 1. 讀取現有資料，對所有 locked 明細進行二次校對
 * 2. 偵測到刪除或篡改 locked 帳目時拋出錯誤，拒絕寫入
 *
 * @throws 若違反 locked 帳目不可變更原則
 */
export function saveRevenue(items: RevenueItem[]): void {
  const existing = loadRevenues();
  assertLockedRevenuesIntegrity(existing, items);

  writeRaw(RESTAURANT_REVENUE_STORAGE_KEY, JSON.stringify(items));
}

/**
 * 將支出明細列表寫入 localStorage。
 *
 * 寫入前防線同 {@link saveRevenue}。
 *
 * @throws 若違反 locked 帳目不可變更原則
 */
export function saveExpense(items: ExpenseItem[]): void {
  const existing = loadExpenses();
  assertLockedExpensesIntegrity(existing, items);

  writeRaw(RESTAURANT_EXPENSE_STORAGE_KEY, JSON.stringify(items));
}

/**
 * 將指定支出明細核帳鎖定（draft → locked）。
 * 以 localStorage 完整快照為基底做 in-place 更新，絕不以 filter 重建陣列，
 * 確保已鎖定項目不會從傳入 saveExpense 的陣列中消失。
 */
export function lockExpenseItem(id: string, snapshot: ExpenseItem): void {
  if (snapshot.id !== id) {
    throw new Error(`支出 id 不一致：${snapshot.id} ≠ ${id}`);
  }
  if (snapshot.auditStatus !== AUDIT_STATUS.DRAFT) {
    throw new Error('僅草稿狀態可核帳鎖定');
  }

  const existing = loadExpenses();
  const index = existing.findIndex((item) => item.id === id);

  const updated =
    index >= 0
      ? existing.map((item) =>
          item.id === id && item.auditStatus === AUDIT_STATUS.DRAFT
            ? { ...item, ...snapshot, auditStatus: AUDIT_STATUS.LOCKED }
            : item,
        )
      : [...existing, { ...snapshot, auditStatus: AUDIT_STATUS.LOCKED }];

  saveExpense(updated);
}

/**
 * 將指定營收明細核帳鎖定（draft → locked）。
 * 以 localStorage 完整快照為基底做 in-place 更新，絕不以 filter 重建陣列，
 * 確保已鎖定項目不會從傳入 saveRevenue 的陣列中消失。
 */
export function lockRevenueItem(id: string, snapshot: RevenueItem): void {
  if (snapshot.id !== id) {
    throw new Error(`營收 id 不一致：${snapshot.id} ≠ ${id}`);
  }
  if (snapshot.auditStatus !== AUDIT_STATUS.DRAFT) {
    throw new Error('僅草稿狀態可核帳鎖定');
  }

  const existing = loadRevenues();
  const index = existing.findIndex((item) => item.id === id);

  const updated =
    index >= 0
      ? existing.map((item) =>
          item.id === id && item.auditStatus === AUDIT_STATUS.DRAFT
            ? { ...item, ...snapshot, auditStatus: AUDIT_STATUS.LOCKED }
            : item,
        )
      : [...existing, { ...snapshot, auditStatus: AUDIT_STATUS.LOCKED }];

  saveRevenue(updated);
}
