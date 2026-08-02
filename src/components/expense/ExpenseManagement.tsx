/**
 * 粵香園帳務系統 — 支出管理主工作區
 *
 * 架構：三分頁 Tab（現金支出 / PT 薪資 / 支付貨款）
 * 入帳流程：
 *   快捷鍵 → AmountInputModal（填金額）→ ExpenseConfirmModal（二次確認）→ saveExpense → ExpenseTable
 * 編輯流程：
 *   點擊表格「編輯」→ 展開 EditForm → ExpenseConfirmModal（二次確認）→ saveExpense
 *
 * PRD §2 分頁三特殊規格：
 *   點選「支付貨款」快捷鍵後，系統自動帶入供應商與支出科目，備註預設「支付貨款」。
 */

import { useMemo, useState, type FormEvent } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getExpenseCategoryLabel } from '../../utils/lang';
import type { TranslationKey } from '../../utils/lang';
import {
  AUDIT_STATUS,
  createFinancialDate,
  toFinancialDateFromDate,
} from '../../types';
import type { ExpenseCategory, ExpenseItem } from '../../types';
import { EXPENSE_CATEGORY } from '../../types';
import { lockExpenseRecord } from '../../services/financialRecords';
import {
  deleteExpenseRecord,
  insertExpenseRecord,
  updateExpenseRecord,
} from '../../services/financialRecords';
import {
  formatMoneyDisplay,
  validateRevenueAmountInput,
} from '../../utils/revenue-form';
import ExpenseConfirmModal from './ExpenseConfirmModal';
import ExpenseTable from './ExpenseTable';
import AmountInputModal from './AmountInputModal';
import {
  type ExpenseTab,
  QUICK_KEYS_BY_TAB,
  type QuickKeyItem,
} from './quick-keys-config';

const EXPENSE_TAB_I18N: Record<ExpenseTab, TranslationKey> = {
  cash: 'expenseTabCash',
  pt: 'expenseTabPt',
  payment: 'expenseTabPayment',
  repair: 'expenseTabRepair',
  fixed_salary: 'expenseTabFixed',
};

const EXPENSE_TAB_ORDER: ExpenseTab[] = ['cash', 'pt', 'payment', 'repair', 'fixed_salary'];

// ---------------------------------------------------------------------------
// 型別
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = Object.values(EXPENSE_CATEGORY);

interface PendingExpenseForm {
  dateInput: string;
  category: ExpenseCategory;
  amountRaw: string;
  merchant: string;
  invoiceNumber: string;
  operatorId: string;
  note: string;
}

type ConfirmMode = 'create' | 'update' | 'delete' | null;

interface ExpenseManagementProps {
  expenses: ExpenseItem[];
  onExpensesChange: () => void | Promise<void>;
  defaultOperatorId?: string;
}

// ---------------------------------------------------------------------------
// 工具函式
// ---------------------------------------------------------------------------

function getTodayDateInput(): string {
  return toFinancialDateFromDate(new Date()) as string;
}

function createEmptyForm(defaultOperatorId: string): PendingExpenseForm {
  return {
    dateInput: getTodayDateInput(),
    category: EXPENSE_CATEGORY.INGREDIENTS,
    amountRaw: '',
    merchant: '',
    invoiceNumber: '',
    operatorId: defaultOperatorId,
    note: '',
  };
}

function formFromItem(item: ExpenseItem): PendingExpenseForm {
  return {
    dateInput: item.date as string,
    category: item.category,
    amountRaw: String(item.amount),
    merchant: item.merchant,
    invoiceNumber: item.invoiceNumber ?? '',
    operatorId: item.operatorId,
    note: item.note ?? '',
  };
}

// ---------------------------------------------------------------------------
// 主元件
// ---------------------------------------------------------------------------

export default function ExpenseManagement({
  expenses,
  onExpensesChange,
  defaultOperatorId = 'admin',
}: ExpenseManagementProps) {
  const { t, lang } = useLanguage();
  // 分頁狀態
  const [activeTab, setActiveTab] = useState<ExpenseTab>('cash');

  // 快捷鍵金額彈窗：pendingKey 非 null 時顯示 AmountInputModal
  const [pendingKey, setPendingKey] = useState<QuickKeyItem | null>(null);

  // 二次確認 Modal
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  // 等待確認的表單資料（快速新增或編輯共用）
  const [confirmPayload, setConfirmPayload] =
    useState<PendingExpenseForm | null>(null);

  // 編輯模式
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PendingExpenseForm>(() =>
    createEmptyForm(defaultOperatorId),
  );
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 刪除確認
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isEditing = editingId !== null;

  const editAmountValidation = useMemo(
    () => validateRevenueAmountInput(editForm.amountRaw),
    [editForm.amountRaw],
  );

  const isEditFormSubmittable =
    editForm.dateInput.trim() !== '' &&
    (editForm.category === EXPENSE_CATEGORY.FIXED_SALARY || editForm.merchant.trim() !== '') &&
    editForm.operatorId.trim() !== '' &&
    editAmountValidation.valid &&
    editAmountValidation.parsedValue !== null;

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        const dc = b.date.localeCompare(a.date);
        return dc !== 0 ? dc : b.createdAt.localeCompare(a.createdAt);
      }),
    [expenses],
  );

  const pendingDeleteItem = pendingDeleteId
    ? expenses.find((item) => item.id === pendingDeleteId)
    : undefined;

  const confirmAmountValidation = useMemo(
    () =>
      confirmPayload
        ? validateRevenueAmountInput(confirmPayload.amountRaw)
        : { valid: false, error: null, parsedValue: null },
    [confirmPayload],
  );

  // ---------------------------------------------------------------------------
  // 快捷鍵流程
  // ---------------------------------------------------------------------------

  function handleQuickKeyClick(key: QuickKeyItem) {
    setPendingKey(key);
  }

  function handleAmountConfirm(
    amount: string,
    merchant: string,
    note: string,
    date: string,
  ) {
    if (!pendingKey) return;

    const form: PendingExpenseForm = {
      dateInput: date.trim() || getTodayDateInput(),
      category: pendingKey.category,
      amountRaw: amount,
      merchant: merchant.trim() || pendingKey.merchant.trim() || pendingKey.label,
      invoiceNumber: '',
      operatorId: defaultOperatorId,
      note,
    };

    setPendingKey(null);
    setConfirmPayload(form);
    setConfirmMode('create');
  }

  function handleAmountCancel() {
    setPendingKey(null);
  }

  // ---------------------------------------------------------------------------
  // 編輯表單
  // ---------------------------------------------------------------------------

  function updateEditForm<K extends keyof PendingExpenseForm>(
    key: K,
    value: PendingExpenseForm[K],
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
    setEditFormError(null);
  }

  function handleStartEdit(item: ExpenseItem) {
    if (item.auditStatus !== AUDIT_STATUS.DRAFT) return;
    setEditingId(item.id);
    setEditForm(formFromItem(item));
    setEditFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm(createEmptyForm(defaultOperatorId));
    setEditFormError(null);
  }

  function validateEditForm(): boolean {
    setEditFormError(null);

    if (editForm.category !== EXPENSE_CATEGORY.FIXED_SALARY && !editForm.merchant.trim()) {
      setEditFormError('請填寫供應商/店家');
      return false;
    }
    if (!editForm.operatorId.trim()) {
      setEditFormError('請填寫經手人');
      return false;
    }
    if (!editAmountValidation.valid || editAmountValidation.parsedValue === null) {
      setEditFormError(editAmountValidation.error ?? '請輸入有效金額');
      return false;
    }
    try {
      createFinancialDate(editForm.dateInput);
    } catch {
      setEditFormError('財務歸屬日格式不合法');
      return false;
    }
    return true;
  }

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateEditForm()) return;
    setConfirmPayload(editForm);
    setConfirmMode('update');
  }

  // ---------------------------------------------------------------------------
  // 確認儲存（快速新增 & 編輯共用）
  // ---------------------------------------------------------------------------

  async function handleConfirmSave() {
    if (!confirmPayload || isSaving) return;

    setIsSaving(true);
    setEditFormError(null);
    setSaveNotice(null);

    try {
      const validation = validateRevenueAmountInput(confirmPayload.amountRaw);
      if (!validation.valid || validation.parsedValue === null) {
        throw new Error(validation.error ?? '金額不合法');
      }

      if (confirmMode === 'create') {
        const result = await insertExpenseRecord({
          date: confirmPayload.dateInput,
          category: confirmPayload.category,
          amount: validation.parsedValue,
          merchant: confirmPayload.merchant.trim(),
          note: confirmPayload.note.trim(),
          operatorId: confirmPayload.operatorId.trim(),
        });

        if (!result.ok) {
          throw new Error(result.message);
        }
        if ('warning' in result && result.warning) {
          setSaveNotice(result.warning);
        }
      } else if (confirmMode === 'update' && editingId) {
        const result = await updateExpenseRecord(editingId, {
          date: confirmPayload.dateInput,
          category: confirmPayload.category,
          amount: validation.parsedValue,
          merchant: confirmPayload.merchant.trim(),
          note: confirmPayload.note.trim(),
          operatorId: confirmPayload.operatorId.trim(),
        });

        if (!result.ok) {
          throw new Error(result.message);
        }
        if ('warning' in result && result.warning) {
          setSaveNotice(result.warning);
        }

        setEditingId(null);
        setEditForm(createEmptyForm(defaultOperatorId));
      } else {
        throw new Error('無效的儲存模式');
      }

      await onExpensesChange();
      setConfirmMode(null);
      setConfirmPayload(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '儲存失敗';
      setEditFormError(message);
      setSaveNotice(message);
      setConfirmMode(null);
      setConfirmPayload(null);
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // 刪除
  // ---------------------------------------------------------------------------

  function handleRequestDelete(id: string) {
    const target = expenses.find((item) => item.id === id);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) return;
    setPendingDeleteId(id);
    setConfirmMode('delete');
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId || isSaving) return;

    const target = expenses.find((item) => item.id === pendingDeleteId);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) {
      setConfirmMode(null);
      setPendingDeleteId(null);
      return;
    }

    setIsSaving(true);

    try {
      const result = await deleteExpenseRecord(pendingDeleteId);
      if (!result.ok) {
        throw new Error(result.message);
      }

      await onExpensesChange();
      if (editingId === pendingDeleteId) {
        handleCancelEdit();
      }
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : '刪除失敗');
    } finally {
      setIsSaving(false);
      setConfirmMode(null);
      setPendingDeleteId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // 鎖定
  // ---------------------------------------------------------------------------

  async function handleLockItem(id: string) {
    const target = expenses.find((item) => item.id === id);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) return;

    setIsSaving(true);
    try {
      const result = await lockExpenseRecord(id);
      if (!result.ok) {
        setEditFormError(result.message);
        return;
      }
      await onExpensesChange();
      if (editingId === id) handleCancelEdit();
    } catch (error) {
      setEditFormError(error instanceof Error ? error.message : t('errLockFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  function closeConfirmModal() {
    setConfirmMode(null);
    setConfirmPayload(null);
    setPendingDeleteId(null);
  }

  // ---------------------------------------------------------------------------
  // 渲染
  // ---------------------------------------------------------------------------

  const quickKeys = QUICK_KEYS_BY_TAB[activeTab];

  return (
    <div className="space-y-6 md:space-y-10">
      {(saveNotice || editFormError) && (
        <div
          className={`rounded-sm border px-4 py-3 text-sm ${
            editFormError
              ? 'border-canton-red/25 bg-canton-red/[0.06] text-canton-red'
              : 'border-amber-300/60 bg-amber-50 text-amber-900'
          }`}
          role="alert"
        >
          {editFormError ?? saveNotice}
        </div>
      )}

      {/* ── 頂部：三分頁 Tab 輸入區 ── */}
      <section className="max-w-full overflow-hidden rounded-sm border border-canton-dark/8 bg-white shadow-canton">
        {/* 分頁 Tab 列 */}
        <div className="flex border-b border-canton-dark/8">
          {(EXPENSE_TAB_ORDER).map((tab) => (
            <button
              key={tab}
              type="button"
              disabled={isEditing}
              onClick={() => setActiveTab(tab)}
              className={`relative min-w-0 flex-1 px-2 py-3.5 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-4 sm:text-[17px] md:px-6 ${
                activeTab === tab && !isEditing
                  ? 'text-canton-red'
                  : 'text-canton-dark/55 hover:text-canton-dark/80'
              }`}
            >
              {t(EXPENSE_TAB_I18N[tab])}
              {/* 底部紅線指示器 */}
              {activeTab === tab && !isEditing && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-canton-red"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6 md:p-8">
          {/* ── 編輯模式：全欄位表單 ── */}
          {isEditing ? (
            <div>
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-canton-dark">
                    編輯草稿帳目
                  </h2>
                  <span className="rounded-sm bg-canton-red/10 px-2 py-0.5 text-xs text-canton-red">
                    編輯模式
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="shrink-0 text-sm text-canton-dark/45 transition-colors hover:text-canton-red"
                >
                  ✕ 取消編輯
                </button>
              </div>

              <form
                className="grid grid-cols-1 gap-5 md:grid-cols-2"
                onSubmit={handleEditSubmit}
              >
                <div className="w-full max-w-full min-w-0 box-border">
                  <label
                    htmlFor="edit-date"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    財務歸屬日 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-date"
                    type="date"
                    className="canton-input !w-[80%] max-w-[260px] mx-auto block box-border"
                    value={editForm.dateInput}
                    onChange={(e) => updateEditForm('dateInput', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-category"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    支出科目 <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="edit-category"
                    className="canton-input"
                    value={editForm.category}
                    onChange={(e) => {
                      const cat = e.target.value as ExpenseCategory;
                      setEditForm((prev) => ({
                        ...prev,
                        category: cat,
                        merchant: cat === EXPENSE_CATEGORY.FIXED_SALARY
                          ? '固定薪資'
                          : prev.merchant,
                      }));
                      setEditFormError(null);
                    }}
                  >
                    {CATEGORY_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {getExpenseCategoryLabel(lang, key)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-amount"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    金額（元）<span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-amount"
                    type="text"
                    inputMode="numeric"
                    className="canton-input font-mono"
                    placeholder="請輸入整數金額"
                    value={editForm.amountRaw}
                    onChange={(e) => updateEditForm('amountRaw', e.target.value)}
                  />
                  {editAmountValidation.error && (
                    <p className="mt-1.5 text-sm text-canton-red" role="alert">
                      {editAmountValidation.error}
                    </p>
                  )}
                </div>

                {editForm.category !== EXPENSE_CATEGORY.FIXED_SALARY && (
                  <div>
                    <label
                      htmlFor="edit-merchant"
                      className="mb-2 block text-sm text-canton-dark/70"
                    >
                      供應商/店家 <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="edit-merchant"
                      type="text"
                      className="canton-input"
                      value={editForm.merchant}
                      onChange={(e) => updateEditForm('merchant', e.target.value)}
                      required
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="edit-invoice"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    發票/收據號碼（選填）
                  </label>
                  <input
                    id="edit-invoice"
                    type="text"
                    className="canton-input font-mono"
                    value={editForm.invoiceNumber}
                    onChange={(e) =>
                      updateEditForm('invoiceNumber', e.target.value)
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-operator"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    經手人 <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="edit-operator"
                    type="text"
                    className="canton-input"
                    value={editForm.operatorId}
                    onChange={(e) => updateEditForm('operatorId', e.target.value)}
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="edit-note"
                    className="mb-2 block text-sm text-canton-dark/70"
                  >
                    備註（選填）
                  </label>
                  <input
                    id="edit-note"
                    type="text"
                    className="canton-input"
                    value={editForm.note}
                    onChange={(e) => updateEditForm('note', e.target.value)}
                  />
                </div>

                {editFormError && (
                  <p className="text-sm text-canton-red md:col-span-2" role="alert">
                    {editFormError}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:col-span-2">
                  <button
                    type="submit"
                    disabled={!isEditFormSubmittable}
                    className="w-full rounded-sm bg-canton-red px-8 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                  >
                    更新支出
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-full rounded-sm border border-canton-dark/20 px-6 py-3.5 text-sm text-canton-dark/60 transition-colors hover:border-canton-red/30 hover:text-canton-red sm:w-auto"
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ── 快捷鍵網格（三分頁共用佈局） ── */
            <div>
              {/* 快捷鍵按鈕網格 */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {quickKeys.map((key) => (
                  <QuickKeyButton
                    key={key.key}
                    item={key}
                    onClick={() => handleQuickKeyClick(key)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 底部：流水帳列表（三分頁共用） ── */}
      <section className="max-w-full overflow-hidden rounded-sm border border-canton-dark/8 bg-white p-4 shadow-canton sm:p-6 md:p-8">
        <h2 className="text-base font-semibold text-canton-dark">
          {t('expenseLedger')}
        </h2>

        <ExpenseTable
          items={sortedExpenses}
          editingId={editingId}
          onEdit={handleStartEdit}
          onDelete={handleRequestDelete}
          onLock={handleLockItem}
        />
      </section>

      {/* ── 快捷鍵金額彈窗 ── */}
      <AmountInputModal
        open={pendingKey !== null}
        quickKey={pendingKey}
        onConfirm={handleAmountConfirm}
        onCancel={handleAmountCancel}
      />

      {/* ── 新增 / 更新二次確認 Modal ── */}
      <ExpenseConfirmModal
        open={confirmMode === 'create' || confirmMode === 'update'}
        title={confirmMode === 'update' ? t('confirmUpdateExpense') : t('confirmExpense')}
        confirmLabel={
          isSaving
            ? t('syncingParams')
            : confirmMode === 'update'
              ? t('confirm')
              : t('confirmAdd')
        }
        onConfirm={handleConfirmSave}
        onCancel={closeConfirmModal}
      >
        {confirmPayload && (
          <p>
            {confirmMode === 'update' ? 'Please confirm the update:' : 'Please confirm expense details:'}
            <br />
            <span className="mt-2 inline-block font-medium text-canton-dark">
              {getExpenseCategoryLabel(lang, confirmPayload.category)} ·{' '}
              {confirmPayload.merchant.trim()}
            </span>
            {confirmPayload.note && (
              <>
                <br />
                <span className="mt-1 inline-block text-sm text-canton-dark/55">
                  備註：{confirmPayload.note}
                </span>
              </>
            )}
            <br />
            <span className="mt-3 inline-block font-mono text-2xl tabular-nums text-canton-red">
              Total:{' '}
              {confirmAmountValidation.parsedValue !== null
                ? formatMoneyDisplay(confirmAmountValidation.parsedValue)
                : '—'}{' '}
              TWD
            </span>
            <br />
            <span className="mt-2 inline-block text-sm text-canton-dark/50">
              Date: {confirmPayload.dateInput}
            </span>
            <br />
            <span className="mt-1 inline-block text-sm text-canton-dark/45">
              Is this correct? Entry can still be edited in the log later.
            </span>
          </p>
        )}
      </ExpenseConfirmModal>

      {/* ── 刪除確認 Modal ── */}
      <ExpenseConfirmModal
        open={confirmMode === 'delete'}
        title={t('confirmDeleteExpense')}
        confirmLabel={t('confirm')}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closeConfirmModal}
      >
        <p>
          確定要刪除以下草稿支出嗎？此操作無法復原。
          <br />
          {pendingDeleteItem && (
            <>
              <span className="mt-3 inline-block font-medium text-canton-dark">
                {getExpenseCategoryLabel(lang, pendingDeleteItem.category)} ·{' '}
                {pendingDeleteItem.merchant}
              </span>
              <br />
              <span className="mt-2 inline-block font-mono text-xl tabular-nums text-canton-red">
                ${formatMoneyDisplay(pendingDeleteItem.amount)}
              </span>
            </>
          )}
        </p>
      </ExpenseConfirmModal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子元件：快捷鍵按鈕
// ---------------------------------------------------------------------------

interface QuickKeyButtonProps {
  item: QuickKeyItem;
  onClick: () => void;
}

function QuickKeyButton({ item, onClick }: QuickKeyButtonProps) {
  const { lang } = useLanguage();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[5rem] min-w-0 flex-col items-center justify-center gap-1 rounded-sm border border-canton-dark/10 bg-white px-1.5 py-3 text-center text-canton-dark/75 transition-all active:scale-95 hover:border-canton-red/40 hover:bg-canton-red/[0.02] hover:text-canton-dark sm:min-h-[5.5rem] sm:px-3 sm:py-4"
    >
      <span className="w-full truncate text-[15px] font-medium leading-tight sm:text-[17px]">
        {item.label}
      </span>
      <span className="w-full truncate text-[13px] text-canton-dark/40 transition-colors group-hover:text-canton-red/60 sm:text-[15px]">
        {getExpenseCategoryLabel(lang, item.category)}
      </span>
    </button>
  );
}
