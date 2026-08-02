/**
 * 粵香園 — Supabase `financial_records` 雲端流水帳
 */

import { supabase } from '../lib/supabase';
import {
  AUDIT_STATUS,
  createFinancialDate,
  createMoney,
  toFinancialDateFromDate,
} from '../types';
import type {
  AuditStatus,
  ExpenseCategory,
  ExpenseItem,
  RevenueItem,
  RevenuePeriod,
} from '../types';
import {
  EXPENSE_CATEGORY,
  EXPENSE_CATEGORY_LABEL,
  REVENUE_PERIOD,
  REVENUE_PERIOD_LABEL,
} from '../types';

interface FinancialRecordRow {
  id: string | number;
  date: string;
  type: string;
  main_category: string;
  amount: number;
  merchant?: string | null;
  note?: string | null;
  operator_id?: string | null;
  audit_status?: string | null;
  created_at?: string | null;
}

/** Supabase PostgREST 單次查詢上限 */
const FETCH_PAGE_SIZE = 1000;

export interface FetchRecordsOk<T> {
  ok: true;
  data: T[];
  totalRows: number;
  droppedCount: number;
}

export interface FetchRecordsErr {
  ok: false;
  message: string;
}

export type FetchRecordsResult<T> = FetchRecordsOk<T> | FetchRecordsErr;

export interface InsertExpenseRecordInput {
  date: string;
  category: ExpenseCategory;
  amount: number;
  merchant?: string;
  note?: string;
  operatorId?: string;
}

export interface InsertRevenueRecordInput {
  date: string;
  period: RevenuePeriod;
  amount: number;
  operatorId?: string;
  note?: string;
}

function getTodayDateString(): string {
  return toFinancialDateFromDate(new Date()) as string;
}

/** 確保傳給 PostgreSQL 的日期為 YYYY-MM-DD */
export function normalizeExpenseDate(dateInput: string): string {
  const trimmed = dateInput.trim();
  createFinancialDate(trimmed);
  return trimmed;
}

/** 將 Supabase 回傳日期正規化為 YYYY-MM-DD（相容 ISO 時間戳與斜線格式） */
function normalizeRowDate(raw: string): string {
  const normalized = raw.trim().replace(/\//g, '-');
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return normalized;
}

function toMainCategory(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABEL[category];
}

function fromMainCategory(label: string): ExpenseCategory {
  const matched = (
    Object.entries(EXPENSE_CATEGORY_LABEL) as [ExpenseCategory, string][]
  ).find(([, value]) => value === label);
  return matched?.[0] ?? EXPENSE_CATEGORY.OTHER;
}

function toRevenueMainCategory(period: RevenuePeriod): string {
  return REVENUE_PERIOD_LABEL[period];
}

function fromRevenueMainCategory(label: string): RevenuePeriod {
  const matched = (
    Object.entries(REVENUE_PERIOD_LABEL) as [RevenuePeriod, string][]
  ).find(([, value]) => value === label);
  if (matched) return matched[0];
  if (label === REVENUE_PERIOD.LUNCH || label === REVENUE_PERIOD.DINNER || label === REVENUE_PERIOD.ALL_DAY) {
    return label;
  }
  return REVENUE_PERIOD.LUNCH;
}

function parseAuditStatus(value: unknown): AuditStatus {
  if (value === AUDIT_STATUS.DRAFT || value === 'draft') return AUDIT_STATUS.DRAFT;
  if (value === AUDIT_STATUS.AUDITED || value === 'audited') return AUDIT_STATUS.AUDITED;
  if (value === AUDIT_STATUS.LOCKED || value === 'locked') return AUDIT_STATUS.LOCKED;
  return AUDIT_STATUS.DRAFT;
}

function isMissingColumnError(error: { message?: string; code?: string }): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('schema cache')
  );
}

interface ExpenseRecordPayload {
  date: string;
  type: 'expense';
  main_category: string;
  amount: number;
  merchant?: string;
  note?: string;
  operator_id?: string;
  audit_status?: string;
}

function buildExpenseRecordPayload(
  input: InsertExpenseRecordInput,
  includeDetails: boolean,
): ExpenseRecordPayload {
  const selectedDate = normalizeExpenseDate(input.date || getTodayDateString());
  const base: ExpenseRecordPayload = {
    date: selectedDate,
    type: 'expense',
    main_category: toMainCategory(input.category),
    amount: -Math.abs(input.amount),
  };

  if (!includeDetails) return base;

  return {
    ...base,
    audit_status: AUDIT_STATUS.DRAFT,
    ...(input.merchant?.trim() ? { merchant: input.merchant.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.operatorId?.trim() ? { operator_id: input.operatorId.trim() } : {}),
  };
}

function mapRowToExpenseItem(row: FinancialRecordRow): ExpenseItem | null {
  try {
    const rawAmount = Number(row.amount);
    if (!Number.isFinite(rawAmount)) return null;

    return {
      id: String(row.id),
      date: createFinancialDate(normalizeRowDate(row.date)),
      category: fromMainCategory(row.main_category),
      amount: createMoney(Math.abs(rawAmount), { allowZero: false }),
      merchant: (row.merchant?.trim() || row.main_category || '支出').trim(),
      operatorId: row.operator_id?.trim() || 'admin',
      auditStatus: parseAuditStatus(row.audit_status),
      ...(row.note?.trim() ? { note: row.note.trim() } : {}),
      createdAt: row.created_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function mapRowToRevenueItem(row: FinancialRecordRow): RevenueItem | null {
  try {
    const rawAmount = Number(row.amount);
    if (!Number.isFinite(rawAmount)) return null;

    return {
      id: String(row.id),
      date: createFinancialDate(normalizeRowDate(row.date)),
      period: fromRevenueMainCategory(row.main_category),
      amount: createMoney(Math.abs(rawAmount), { allowZero: false }),
      operatorId: row.operator_id?.trim() || 'admin',
      auditStatus: parseAuditStatus(row.audit_status),
      ...(row.note?.trim() ? { note: row.note.trim() } : {}),
      createdAt: row.created_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchAllRowsByType(
  type: 'expense' | 'revenue',
): Promise<{ rows: FinancialRecordRow[] } | { error: string }> {
  const rows: FinancialRecordRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('financial_records')
      .select('*')
      .eq('type', type)
      .order('date', { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      return { error: error.message };
    }

    const page = (data ?? []) as FinancialRecordRow[];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return { rows };
}

function mapRowsToItems<T>(
  rows: FinancialRecordRow[],
  mapper: (row: FinancialRecordRow) => T | null,
): { items: T[]; droppedCount: number } {
  const items: T[] = [];
  let droppedCount = 0;

  for (const row of rows) {
    const item = mapper(row);
    if (item) {
      items.push(item);
    } else {
      droppedCount += 1;
    }
  }

  if (droppedCount > 0) {
    console.warn(
      `[financialRecords] ${droppedCount} 筆雲端紀錄因格式不符已略過，網站加總可能低於雲端總額`,
    );
  }

  return { items, droppedCount };
}

export async function fetchExpenseRecords(): Promise<FetchRecordsResult<ExpenseItem>> {
  const result = await fetchAllRowsByType('expense');
  if ('error' in result) {
    console.error('[financialRecords] 載入失敗：', result.error);
    return { ok: false, message: result.error };
  }

  const { items, droppedCount } = mapRowsToItems(result.rows, mapRowToExpenseItem);
  return {
    ok: true,
    data: items,
    totalRows: result.rows.length,
    droppedCount,
  };
}

export async function fetchRevenueRecords(): Promise<FetchRecordsResult<RevenueItem>> {
  const result = await fetchAllRowsByType('revenue');
  if ('error' in result) {
    console.error('[financialRecords] 營收載入失敗：', result.error);
    return { ok: false, message: result.error };
  }

  const { items, droppedCount } = mapRowsToItems(result.rows, mapRowToRevenueItem);
  return {
    ok: true,
    data: items,
    totalRows: result.rows.length,
    droppedCount,
  };
}

/** 將本機曾鎖定但雲端仍為 draft 的帳目，補寫 audit_status 至 Supabase */
export async function migrateLocalLocksToCloud(
  localLockedIds: string[],
  cloudItems: Array<{ id: string; auditStatus: AuditStatus }>,
): Promise<void> {
  const cloudDraftIds = new Set(
    cloudItems
      .filter((item) => item.auditStatus === AUDIT_STATUS.DRAFT)
      .map((item) => item.id),
  );

  for (const id of localLockedIds) {
    if (!cloudDraftIds.has(id)) continue;
    await supabase
      .from('financial_records')
      .update({ audit_status: AUDIT_STATUS.LOCKED })
      .eq('id', id)
      .eq('audit_status', AUDIT_STATUS.DRAFT);
  }
}

export async function lockExpenseRecord(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('financial_records')
    .update({ audit_status: AUDIT_STATUS.LOCKED })
    .eq('id', id)
    .eq('type', 'expense')
    .eq('audit_status', AUDIT_STATUS.DRAFT)
    .select('id');

  if (error) {
    console.error('[financialRecords] 支出鎖定失敗：', error.message);
    return { ok: false, message: error.message };
  }

  if (!data?.length) {
    return { ok: false, message: '找不到可鎖定的草稿支出，或該筆已在雲端鎖定' };
  }

  return { ok: true };
}

export async function lockRevenueRecord(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from('financial_records')
    .update({ audit_status: AUDIT_STATUS.LOCKED })
    .eq('id', id)
    .eq('type', 'revenue')
    .eq('audit_status', AUDIT_STATUS.DRAFT)
    .select('id');

  if (error) {
    console.error('[financialRecords] 營收鎖定失敗：', error.message);
    return { ok: false, message: error.message };
  }

  if (!data?.length) {
    return { ok: false, message: '找不到可鎖定的草稿營收，或該筆已在雲端鎖定' };
  }

  return { ok: true };
}

async function insertExpensePayload(
  payload: ExpenseRecordPayload,
): Promise<{ ok: true } | { ok: false; message: string; missingColumn?: boolean }> {
  const { error } = await supabase.from('financial_records').insert([payload]);

  if (error) {
    console.error('[financialRecords] 新增失敗：', error.message);
    return {
      ok: false,
      message: error.message,
      missingColumn: isMissingColumnError(error),
    };
  }

  return { ok: true };
}

export async function insertExpenseRecord(
  input: InsertExpenseRecordInput,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const fullPayload = buildExpenseRecordPayload(
    { ...input, amount: enteredAmount },
    true,
  );
  const result = await insertExpensePayload(fullPayload);

  if (result.ok) {
    return { ok: true };
  }

  if (!result.missingColumn) {
    return { ok: false, message: result.message };
  }

  const fallbackPayload = buildExpenseRecordPayload(
    { ...input, amount: enteredAmount },
    false,
  );
  const fallbackResult = await insertExpensePayload(fallbackPayload);

  if (!fallbackResult.ok) {
    return { ok: false, message: fallbackResult.message };
  }

  return {
    ok: true,
    warning:
      '支出已入帳，但 Supabase 尚未建立 merchant / note 欄位，供應商細節暫未寫入雲端。請在 Supabase SQL Editor 執行專案內 migration 後重新入帳。',
  };
}

interface RevenueRecordPayload {
  date: string;
  type: 'revenue';
  main_category: string;
  amount: number;
  operator_id?: string;
  note?: string;
  audit_status?: string;
}

function buildRevenueRecordPayload(
  input: InsertRevenueRecordInput,
  includeDetails: boolean,
): RevenueRecordPayload {
  const selectedDate = normalizeExpenseDate(input.date || getTodayDateString());
  const base: RevenueRecordPayload = {
    date: selectedDate,
    type: 'revenue',
    main_category: toRevenueMainCategory(input.period),
    amount: Math.abs(input.amount),
  };

  if (!includeDetails) return base;

  return {
    ...base,
    audit_status: AUDIT_STATUS.DRAFT,
    ...(input.operatorId?.trim() ? { operator_id: input.operatorId.trim() } : {}),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

async function insertRevenuePayload(
  payload: RevenueRecordPayload,
): Promise<{ ok: true } | { ok: false; message: string; missingColumn?: boolean }> {
  const { error } = await supabase.from('financial_records').insert([payload]);

  if (error) {
    console.error('[financialRecords] 營收新增失敗：', error.message);
    return {
      ok: false,
      message: error.message,
      missingColumn: isMissingColumnError(error),
    };
  }

  return { ok: true };
}

export async function insertRevenueRecord(
  input: InsertRevenueRecordInput,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const fullPayload = buildRevenueRecordPayload(
    { ...input, amount: enteredAmount },
    true,
  );
  const result = await insertRevenuePayload(fullPayload);

  if (result.ok) {
    return { ok: true };
  }

  if (!result.missingColumn) {
    return { ok: false, message: result.message };
  }

  const fallbackPayload = buildRevenueRecordPayload(
    { ...input, amount: enteredAmount },
    false,
  );
  const fallbackResult = await insertRevenuePayload(fallbackPayload);

  if (!fallbackResult.ok) {
    return { ok: false, message: fallbackResult.message };
  }

  return {
    ok: true,
    warning:
      '營收已入帳，但 Supabase 尚未建立 operator_id / note 欄位，部分細節暫未寫入雲端。請執行專案 migration 後重新入帳。',
  };
}

async function updateRevenuePayload(
  id: string,
  payload: RevenueRecordPayload,
): Promise<{ ok: true } | { ok: false; message: string; missingColumn?: boolean }> {
  const { error } = await supabase
    .from('financial_records')
    .update(payload)
    .eq('id', id)
    .eq('type', 'revenue');

  if (error) {
    console.error('[financialRecords] 營收更新失敗：', error.message);
    return {
      ok: false,
      message: error.message,
      missingColumn: isMissingColumnError(error),
    };
  }

  return { ok: true };
}

async function updateExpensePayload(
  id: string,
  payload: ExpenseRecordPayload,
): Promise<{ ok: true } | { ok: false; message: string; missingColumn?: boolean }> {
  const { error } = await supabase
    .from('financial_records')
    .update(payload)
    .eq('id', id)
    .eq('type', 'expense');

  if (error) {
    console.error('[financialRecords] 更新失敗：', error.message);
    return {
      ok: false,
      message: error.message,
      missingColumn: isMissingColumnError(error),
    };
  }

  return { ok: true };
}

export async function updateExpenseRecord(
  id: string,
  input: InsertExpenseRecordInput,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const fullPayload = buildExpenseRecordPayload(
    { ...input, amount: enteredAmount },
    true,
  );
  const result = await updateExpensePayload(id, fullPayload);

  if (result.ok) {
    return { ok: true };
  }

  if (!result.missingColumn) {
    return { ok: false, message: result.message };
  }

  const fallbackPayload = buildExpenseRecordPayload(
    { ...input, amount: enteredAmount },
    false,
  );
  const fallbackResult = await updateExpensePayload(id, fallbackPayload);

  if (!fallbackResult.ok) {
    return { ok: false, message: fallbackResult.message };
  }

  return {
    ok: true,
    warning:
      '支出已更新，但 Supabase 尚未建立 merchant / note 欄位，供應商細節暫未寫入雲端。',
  };
}

export async function updateRevenueRecord(
  id: string,
  input: InsertRevenueRecordInput,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const fullPayload = buildRevenueRecordPayload(
    { ...input, amount: enteredAmount },
    true,
  );
  const result = await updateRevenuePayload(id, fullPayload);

  if (result.ok) {
    return { ok: true };
  }

  if (!result.missingColumn) {
    return { ok: false, message: result.message };
  }

  const fallbackPayload = buildRevenueRecordPayload(
    { ...input, amount: enteredAmount },
    false,
  );
  const fallbackResult = await updateRevenuePayload(id, fallbackPayload);

  if (!fallbackResult.ok) {
    return { ok: false, message: fallbackResult.message };
  }

  return {
    ok: true,
    warning:
      '營收已更新，但 Supabase 尚未建立 operator_id / note 欄位，部分細節暫未寫入雲端。',
  };
}

export async function deleteExpenseRecord(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('financial_records')
    .delete()
    .eq('id', id)
    .eq('type', 'expense');

  if (error) {
    console.error('[financialRecords] 刪除失敗：', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function deleteRevenueRecord(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('financial_records')
    .delete()
    .eq('id', id)
    .eq('type', 'revenue');

  if (error) {
    console.error('[financialRecords] 營收刪除失敗：', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
