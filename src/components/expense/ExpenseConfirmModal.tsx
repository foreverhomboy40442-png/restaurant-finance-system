import type { ReactNode } from 'react';

interface ExpenseConfirmModalProps {
  open: boolean;
  title: string;
  confirmLabel?: string;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: 'default' | 'danger';
}

/**
 * 支出操作二次確認 Modal（新增 / 更新 / 刪除共用）。
 */
export default function ExpenseConfirmModal({
  open,
  title,
  confirmLabel = '確定',
  children,
  onConfirm,
  onCancel,
  tone = 'default',
}: ExpenseConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-canton-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-confirm-title"
    >
      <div className="w-full max-w-md rounded-sm border border-canton-dark/10 bg-white p-5 shadow-canton-md sm:p-8">
        <h2
          id="expense-confirm-title"
          className="text-lg font-semibold text-canton-dark"
        >
          {title}
        </h2>
        <div className="mt-6 text-center text-base leading-relaxed text-canton-dark/80">
          {children}
        </div>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-sm border border-canton-dark/20 py-3 text-sm text-canton-dark/70 transition-colors hover:bg-canton-bg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-sm py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 ${
              tone === 'danger' ? 'bg-canton-red' : 'bg-canton-red'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
