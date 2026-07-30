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
      date: createFinancialDate(row.date),
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
      date: createFinancialDate(row.date),
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

export async function fetchExpenseRecords(): Promise<ExpenseItem[]> {
  const { data, error } = await supabase
    .from('financial_records')
    .select('*')
    .eq('type', 'expense')
    .order('date', { ascending: false });

  if (error) {
    console.error('[financialRecords] 載入失敗：', error.message);
    return [];
  }

  if (!data?.length) return [];

  const items: ExpenseItem[] = [];
  for (const row of data as FinancialRecordRow[]) {
    const item = mapRowToExpenseItem(row);
    if (item) items.push(item);
  }
  return items;
}

export async function fetchRevenueRecords(): Promise<RevenueItem[]> {
  const { data, error } = await supabase
    .from('financial_records')
    .select('*')
    .eq('type', 'revenue')
    .order('date', { ascending: false });

  if (error) {
    console.error('[financialRecords] 營收載入失敗：', error.message);
    return [];
  }

  if (!data?.length) return [];

  const items: RevenueItem[] = [];
  for (const row of data as FinancialRecordRow[]) {
    const item = mapRowToRevenueItem(row);
    if (item) items.push(item);
  }
  return items;
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

export async function insertRevenueRecord(
  input: InsertRevenueRecordInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const selectedDate = normalizeExpenseDate(input.date || getTodayDateString());
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const payload = {
    date: selectedDate,
    type: 'revenue' as const,
    main_category: toRevenueMainCategory(input.period),
    amount: Math.abs(enteredAmount),
  };

  const { error } = await supabase.from('financial_records').insert([payload]);

  if (error) {
    console.error('[financialRecords] 營收新增失敗：', error.message);
    return { ok: false, message: error.message };
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
): Promise<{ ok: true } | { ok: false; message: string }> {
  const selectedDate = normalizeExpenseDate(input.date);
  const enteredAmount = input.amount;

  if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
    return { ok: false, message: '金額必須為正數' };
  }

  const { error } = await supabase
    .from('financial_records')
    .update({
      date: selectedDate,
      main_category: toRevenueMainCategory(input.period),
      amount: Math.abs(enteredAmount),
    })
    .eq('id', id)
    .eq('type', 'revenue');

  if (error) {
    console.error('[financialRecords] 營收更新失敗：', error.message);
    return { ok: false, message: error.message };
  }

  return { ok: true };
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
