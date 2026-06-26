/**
 * 支出流水帳表格 — 動態待審核 Queue 模式
 */

import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { AUDIT_STATUS } from '../../types';
import type { ExpenseItem } from '../../types';
import {
  getAuditStatusLabel,
  getExpenseCategoryLabel,
} from '../../utils/lang';
import { formatMoneyDisplay } from '../../utils/revenue-form';

const PAGE_SIZE = 5;

interface ExpenseTableProps {
  items: ExpenseItem[];
  editingId: string | null;
  onEdit: (item: ExpenseItem) => void;
  onDelete: (id: string) => void;
  onLock: (id: string) => void;
}

export default function ExpenseTable({
  items,
  editingId,
  onEdit,
  onDelete,
  onLock,
}: ExpenseTableProps) {
  const { t, lang } = useLanguage();
  const [page, setPage] = useState(1);

  const draftItems = items.filter((item) => item.auditStatus === AUDIT_STATUS.DRAFT);
  const totalPages = Math.max(1, Math.ceil(draftItems.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [draftItems.length, page, totalPages]);

  const pageItems = draftItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (draftItems.length === 0) {
    return (
      <div className="mt-8 rounded-sm border border-dashed border-slate-200 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">{t('expensePendingEmpty')}</p>
        <p className="mt-1 text-xs text-slate-300">{t('expensePendingEmptyDesc')}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-canton-red text-[10px] font-bold text-white">
            {draftItems.length}
          </span>
          <span className="text-xs text-slate-600">
            {t('expensePendingQueueHint')}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {t('expensePageOf', { page, totalPages })}
        </span>
      </div>

      <div className="w-full overflow-x-auto rounded-sm border border-slate-100">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs sm:text-[11px] text-slate-500">
              <th className="px-4 py-3 font-medium">{t('colFinancialDate')}</th>
              <th className="px-4 py-3 font-medium">{t('colExpenseCategory')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colAmount')}</th>
              <th className="px-4 py-3 font-medium">{t('colMerchant')}</th>
              <th className="px-4 py-3 font-medium">{t('colNote')}</th>
              <th className="px-4 py-3 font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-slate-50 transition-colors last:border-0 ${
                    isEditing ? 'bg-canton-red/[0.02]' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="px-4 py-4 font-mono text-slate-800">{item.date}</td>
                  <td className="px-4 py-4 text-slate-600">
                    {getExpenseCategoryLabel(lang, item.category)}
                  </td>
                  <td className="px-4 py-4 text-right font-mono tabular-nums text-slate-800">
                    ${formatMoneyDisplay(item.amount)}
                  </td>
                  <td className="px-4 py-4 text-slate-600">{item.merchant}</td>
                  <td className="px-4 py-4 text-slate-500">{item.note ?? '—'}</td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-500">
                      {getAuditStatusLabel(lang, item.auditStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="min-h-[2.25rem] px-1 text-sm sm:text-xs font-medium text-canton-red transition-opacity hover:opacity-70"
                      >
                        {t('actionEdit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="min-h-[2.25rem] px-1 text-sm sm:text-xs text-slate-400 transition-colors hover:text-canton-red"
                      >
                        {t('actionDelete')}
                      </button>
                      <span className="hidden text-slate-200 sm:inline">|</span>
                      <button
                        type="button"
                        onClick={() => onLock(item.id)}
                        className="min-h-[2.25rem] rounded-sm border border-canton-red/30 px-3 py-1.5 text-sm sm:text-xs sm:px-2.5 sm:py-1 text-canton-red transition-colors hover:bg-canton-red hover:text-white"
                      >
                        {t('revenueLockConfirm')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {t('expensePageRange', {
              start: (page - 1) * PAGE_SIZE + 1,
              end: Math.min(page * PAGE_SIZE, draftItems.length),
              total: draftItems.length,
            })}
          </p>
          <div className="flex items-center gap-1">
            <PaginationButton
              onClick={() => setPage(1)}
              disabled={page === 1}
              label="«"
              title={t('firstPage')}
            />
            <PaginationButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              label="‹"
              title={t('prevPage')}
            />
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`flex h-8 min-w-[2rem] items-center justify-center rounded-sm px-2 text-xs font-medium transition-colors ${
                  p === page
                    ? 'bg-canton-red text-white'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
            <PaginationButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              label="›"
              title={t('nextPage')}
            />
            <PaginationButton
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              label="»"
              title={t('lastPage')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface PaginationButtonProps {
  onClick: () => void;
  disabled: boolean;
  label: string;
  title: string;
}

function PaginationButton({ onClick, disabled, label, title }: PaginationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-xs text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}
