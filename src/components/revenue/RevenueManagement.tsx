import { useMemo, useState, type FormEvent } from 'react';
import {
  AUDIT_STATUS,
  createFinancialDate,
  toFinancialDateFromDate,
} from '../../types';
import type { RevenueItem, RevenuePeriod } from '../../types';
import {
  REVENUE_PERIOD,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getRevenuePeriodLabel, translateAmountValidationError } from '../../utils/lang';
import {
  deleteRevenueRecord,
  insertRevenueRecord,
  updateRevenueRecord,
} from '../../services/financialRecords';
import { lockRevenueRecord } from '../../services/financialRecords';
import {
  formatMoneyDisplay,
  validateRevenueAmountInput,
} from '../../utils/revenue-form';
import RevenueConfirmModal from './RevenueConfirmModal';
import RevenueTable from './RevenueTable';

const PERIOD_OPTIONS = Object.values(REVENUE_PERIOD);

interface PendingRevenueForm {
  dateInput: string;
  period: RevenuePeriod;
  amountRaw: string;
  operatorId: string;
  note: string;
}

type ConfirmMode = 'create' | 'update' | 'delete' | null;

interface RevenueManagementProps {
  revenues: RevenueItem[];
  onRevenuesChange: () => void | Promise<void>;
  defaultOperatorId?: string;
}

function getTodayDateInput(): string {
  return toFinancialDateFromDate(new Date()) as string;
}

function getYesterdayDateInput(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toFinancialDateFromDate(d) as string;
}

function createEmptyForm(defaultOperatorId: string): PendingRevenueForm {
  return {
    dateInput: getTodayDateInput(),
    period: REVENUE_PERIOD.LUNCH,
    amountRaw: '',
    operatorId: defaultOperatorId,
    note: '',
  };
}

function formFromItem(item: RevenueItem): PendingRevenueForm {
  return {
    dateInput: item.date as string,
    period: item.period,
    amountRaw: String(item.amount),
    operatorId: item.operatorId,
    note: item.note ?? '',
  };
}

/**
 * 營收管理主工作區：新增 / 編輯表單 + 歷史流水帳。
 */
export default function RevenueManagement({
  revenues,
  onRevenuesChange,
  defaultOperatorId = 'admin',
}: RevenueManagementProps) {
  const { t, lang } = useLanguage();
  const [form, setForm] = useState<PendingRevenueForm>(() =>
    createEmptyForm(defaultOperatorId),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEditing = editingId !== null;

  const amountValidation = useMemo(
    () => validateRevenueAmountInput(form.amountRaw),
    [form.amountRaw],
  );

  const isFormSubmittable =
    form.dateInput.trim() !== '' &&
    form.operatorId.trim() !== '' &&
    amountValidation.valid &&
    amountValidation.parsedValue !== null;

  const sortedRevenues = useMemo(
    () =>
      [...revenues].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [revenues],
  );

  /** 待核銷佇列：僅 draft 狀態，依日期降序，最多由 RevenueTable 截取前 15 筆顯示 */
  const pendingRevenues = useMemo(
    () => sortedRevenues.filter((item) => item.auditStatus === AUDIT_STATUS.DRAFT),
    [sortedRevenues],
  );

  const pendingDeleteItem = pendingDeleteId
    ? revenues.find((item) => item.id === pendingDeleteId)
    : undefined;

  function updateForm<K extends keyof PendingRevenueForm>(
    key: K,
    value: PendingRevenueForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError(null);
  }

  function resetForm() {
    setForm(createEmptyForm(defaultOperatorId));
    setEditingId(null);
    setFormError(null);
  }

  function handleStartEdit(item: RevenueItem) {
    if (item.auditStatus !== AUDIT_STATUS.DRAFT) {
      return;
    }
    setEditingId(item.id);
    setForm(formFromItem(item));
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    resetForm();
  }

  function handleRequestDelete(id: string) {
    const target = revenues.find((item) => item.id === id);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) {
      return;
    }
    setPendingDeleteId(id);
    setConfirmMode('delete');
  }

  function validateFormBeforeConfirm(): boolean {
    setFormError(null);

    if (!form.operatorId.trim()) {
      setFormError(t('errOperatorRequired'));
      return false;
    }

    if (!amountValidation.valid || amountValidation.parsedValue === null) {
      setFormError(
        translateAmountValidationError(lang, amountValidation.error)
          ?? t('errAmountRequired'),
      );
      return false;
    }

    try {
      createFinancialDate(form.dateInput);
    } catch {
      setFormError(t('errFinancialDateInvalid'));
      return false;
    }

    return true;
  }

  function handleOpenConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFormBeforeConfirm()) {
      return;
    }
    setConfirmMode(isEditing ? 'update' : 'create');
  }

  async function handleConfirmSave() {
    if (isSaving) return;

    setIsSaving(true);
    setFormError(null);

    try {
      if (!amountValidation.valid || amountValidation.parsedValue === null) {
        throw new Error(amountValidation.error ?? '金額不合法');
      }

      const recordInput = {
        date: form.dateInput,
        period: form.period,
        amount: amountValidation.parsedValue,
        operatorId: form.operatorId.trim(),
        note: form.note.trim(),
      };

      if (confirmMode === 'create') {
        const result = await insertRevenueRecord(recordInput);
        if (!result.ok) {
          throw new Error(result.message);
        }
      } else if (confirmMode === 'update' && editingId) {
        const result = await updateRevenueRecord(editingId, recordInput);
        if (!result.ok) {
          throw new Error(result.message);
        }
      } else {
        throw new Error('無效的儲存模式');
      }

      await onRevenuesChange();
      resetForm();
      setConfirmMode(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t('errSaveFailed'),
      );
      setConfirmMode(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId || isSaving) {
      return;
    }

    const target = revenues.find((item) => item.id === pendingDeleteId);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) {
      setConfirmMode(null);
      setPendingDeleteId(null);
      return;
    }

    setIsSaving(true);

    try {
      const result = await deleteRevenueRecord(pendingDeleteId);
      if (!result.ok) {
        throw new Error(result.message);
      }

      await onRevenuesChange();
      if (editingId === pendingDeleteId) {
        resetForm();
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t('errDeleteFailed'),
      );
    } finally {
      setIsSaving(false);
      setConfirmMode(null);
      setPendingDeleteId(null);
    }
  }

  async function handleLockItem(id: string) {
    const target = revenues.find((item) => item.id === id);
    if (!target || target.auditStatus !== AUDIT_STATUS.DRAFT) return;

    setIsSaving(true);
    try {
      const result = await lockRevenueRecord(id);
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      await onRevenuesChange();
      if (editingId === id) {
        resetForm();
      }
    } catch {
      setFormError(t('errLockFailed'));
    } finally {
      setIsSaving(false);
    }
  }

  function closeConfirmModal() {
    setConfirmMode(null);
    setPendingDeleteId(null);
  }

  return (
    <div className="space-y-6 md:space-y-10">
      {/* 頂部：新增 / 編輯表單 */}
      <section className="max-w-full overflow-hidden rounded-sm border border-canton-dark/8 bg-white p-4 shadow-canton sm:p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h2 className="text-base font-semibold text-canton-dark">
            {isEditing ? t('revenueEditTitle') : t('revenueAddTitle')}
          </h2>
          {isEditing && (
            <span className="shrink-0 rounded-sm bg-canton-red/10 px-2.5 py-1 text-xs text-canton-red">
              {t('revenueEditMode')}
            </span>
          )}
        </div>

        <form className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6" onSubmit={handleOpenConfirm}>
          <div>
            <label htmlFor="revenue-date" className="mb-2 block text-sm text-canton-dark/70">
              {t('revenueFinancialDate')} <span className="text-red-600">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="revenue-date"
                type="date"
                className="canton-input flex-1"
                value={form.dateInput}
                onChange={(e) => updateForm('dateInput', e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => {
                  const today     = getTodayDateInput();
                  const yesterday = getYesterdayDateInput();
                  updateForm('dateInput', form.dateInput === yesterday ? today : yesterday);
                }}
                title={
                  form.dateInput === getYesterdayDateInput()
                    ? t('revenueSwitchToday')
                    : t('revenueSwitchYesterday')
                }
                className={`shrink-0 rounded-sm border px-2.5 py-2 text-xs font-medium transition-colors ${
                  form.dateInput === getYesterdayDateInput()
                    ? 'border-canton-red/40 bg-canton-red/8 text-canton-red'
                    : 'border-canton-dark/15 bg-canton-bg text-canton-dark/55 hover:border-canton-red/30 hover:text-canton-red'
                }`}
              >
                {t('revenuePreviousDay')}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="revenue-period" className="mb-2 block text-sm text-canton-dark/70">
              {t('revenueMealPeriod')} <span className="text-red-600">*</span>
            </label>
            <select
              id="revenue-period"
              className="canton-input"
              value={form.period}
              onChange={(e) => updateForm('period', e.target.value as RevenuePeriod)}
            >
              {PERIOD_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {getRevenuePeriodLabel(lang, key)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="revenue-amount" className="mb-2 block text-sm text-canton-dark/70">
              {t('amountLabel')}<span className="text-red-600">*</span>
            </label>
            <input
              id="revenue-amount"
              type="text"
              inputMode="numeric"
              className="canton-input font-mono"
              placeholder={t('revenueAmountPlaceholder')}
              value={form.amountRaw}
              onChange={(e) => updateForm('amountRaw', e.target.value)}
            />
            {amountValidation.error && (
              <p className="mt-1.5 text-sm text-canton-red" role="alert">
                {translateAmountValidationError(lang, amountValidation.error)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="revenue-operator" className="mb-2 block text-sm text-canton-dark/70">
              {t('revenueOperator')} <span className="text-red-600">*</span>
            </label>
            <input
              id="revenue-operator"
              type="text"
              className="canton-input"
              value={form.operatorId}
              onChange={(e) => updateForm('operatorId', e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="revenue-note" className="mb-2 block text-sm text-canton-dark/70">
              {t('noteLabel')}
            </label>
            <input
              id="revenue-note"
              type="text"
              className="canton-input"
              placeholder={t('revenueNotePlaceholder')}
              value={form.note}
              onChange={(e) => updateForm('note', e.target.value)}
            />
          </div>

          {formError && (
            <p className="text-sm text-canton-red md:col-span-2" role="alert">
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:col-span-2">
            <button
              type="submit"
              disabled={!isFormSubmittable}
              className="w-full rounded-sm bg-canton-red px-8 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {isEditing ? t('revenueUpdateEntry') : t('revenueAddEntry')}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-full rounded-sm border border-canton-dark/20 px-6 py-3.5 text-sm text-canton-dark/60 transition-colors hover:border-canton-red/30 hover:text-canton-red sm:w-auto"
              >
                {t('revenueCancelEdit')}
              </button>
            )}
          </div>
        </form>
      </section>

      {/* 底部：待核銷帳務清單 */}
      <section className="max-w-full overflow-hidden rounded-sm border border-canton-dark/8 bg-white p-4 shadow-canton sm:p-6 md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold text-canton-dark">{t('revenuePendingList')}</h2>
          {pendingRevenues.length > 0 && (
            <span className="font-mono text-xs text-canton-dark/38 tabular-nums">
              {t('revenueLockedCount', {
                locked: revenues.length - pendingRevenues.length,
                total: revenues.length,
              })}
            </span>
          )}
        </div>

        <div className="mt-4 sm:mt-6">
          <RevenueTable
            items={pendingRevenues}
            editingId={editingId}
            onEdit={handleStartEdit}
            onDelete={handleRequestDelete}
            onLock={handleLockItem}
          />
        </div>
      </section>

      {/* 新增 / 更新確認 */}
      <RevenueConfirmModal
        open={confirmMode === 'create' || confirmMode === 'update'}
        title={
          confirmMode === 'update'
            ? t('revenueConfirmUpdateTitle')
            : t('revenueConfirmTitle')
        }
        confirmLabel={
          confirmMode === 'update' ? t('revenueConfirmUpdate') : t('revenueSubmit')
        }
        onConfirm={handleConfirmSave}
        onCancel={closeConfirmModal}
      >
        <p>
          {confirmMode === 'update'
            ? t('revenueConfirmUpdatePrompt')
            : t('revenueConfirmCreatePrompt')}
          <br />
          <span className="mt-2 inline-block font-medium text-canton-dark">
            {form.dateInput} · {getRevenuePeriodLabel(lang, form.period)}
          </span>
          <br />
          <span className="mt-3 inline-block font-mono text-2xl tabular-nums text-canton-red">
            {t('revenueConfirmTotal', {
              amount:
                amountValidation.parsedValue !== null
                  ? formatMoneyDisplay(amountValidation.parsedValue)
                  : '—',
              currency: t('unitCurrency'),
            })}
          </span>
          <br />
          <span className="mt-2 inline-block text-sm text-canton-dark/55">
            {t('revenueConfirmOk')}
          </span>
        </p>
      </RevenueConfirmModal>

      {/* 刪除確認 */}
      <RevenueConfirmModal
        open={confirmMode === 'delete'}
        title={t('revenueConfirmDeleteTitle')}
        confirmLabel={t('revenueConfirmDelete')}
        tone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={closeConfirmModal}
      >
        <p>
          {t('revenueDeletePrompt')}
          <br />
          {pendingDeleteItem && (
            <>
              <span className="mt-3 inline-block font-medium text-canton-dark">
                {pendingDeleteItem.date} ·{' '}
                {getRevenuePeriodLabel(lang, pendingDeleteItem.period)}
              </span>
              <br />
              <span className="mt-2 inline-block font-mono text-xl tabular-nums text-canton-red">
                ${formatMoneyDisplay(pendingDeleteItem.amount)}
              </span>
            </>
          )}
        </p>
      </RevenueConfirmModal>
    </div>
  );
}
