/**
 * 粵香園帳務系統 — 快捷鍵金額彈窗
 *
 * 點擊快捷鍵後彈出此輕量 Modal，使用者只需填寫：
 * - 金額（自動聚焦，行動端開啟純數字鍵盤）
 * - 備註（選填，支援下拉快選）
 * - 供應商（僅「其他」類快捷鍵需手動填寫）
 *
 * 確認後交由父元件觸發二次確認 Modal，符合 PRD 雙重確認防呆規格。
 */

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getExpenseCategoryLabel } from '../../utils/lang';
import { toFinancialDateFromDate } from '../../types';
import {
  formatMoneyDisplay,
  validateRevenueAmountInput,
} from '../../utils/revenue-form';
import type { QuickKeyItem } from './quick-keys-config';

function getTodayDateInput(): string {
  return toFinancialDateFromDate(new Date()) as string;
}

// ── 供應商下拉選單子元件 ──────────────────────────────────────────────────────

interface MerchantDropdownProps {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}

function MerchantDropdown({ options, value, onChange }: MerchantDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="canton-input flex items-center justify-between text-left"
      >
        <span className={value ? 'text-canton-dark' : 'text-canton-dark/35'}>
          {value || '請選擇員工姓名'}
        </span>
        <span
          className="shrink-0 text-xs text-canton-dark/35 transition-transform duration-150"
          style={{ transform: `rotate(${open ? 180 : 0}deg)` }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open && (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-52 overflow-y-auto rounded-sm border border-canton-dark/10 bg-white shadow-canton-md"
          role="listbox"
        >
          {options.map((name) => (
            <li key={name} role="option" aria-selected={value === name}>
              <button
                type="button"
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-canton-bg ${
                  value === name
                    ? 'font-semibold text-canton-red'
                    : 'text-canton-dark/80'
                }`}
                onClick={() => { onChange(name); setOpen(false); }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AmountInputModalProps {
  open: boolean;
  quickKey: QuickKeyItem | null;
  onConfirm: (amount: string, merchant: string, note: string, date: string) => void;
  onCancel: () => void;
}

export default function AmountInputModal({
  open,
  quickKey,
  onConfirm,
  onCancel,
}: AmountInputModalProps) {
  const { t, lang } = useLanguage();
  const [amount, setAmount] = useState('');
  const [dateInput, setDateInput] = useState(getTodayDateInput);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [noteDropdownOpen, setNoteDropdownOpen] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 每次 Modal 開啟，重置欄位並聚焦金額輸入
  useEffect(() => {
    if (open && quickKey) {
      setAmount('');
      setDateInput(getTodayDateInput());
      setMerchant(quickKey.merchant);
      setNote(quickKey.defaultNote ?? '');
      setNoteDropdownOpen(false);
      // 延遲一幀確保 DOM 已渲染
      requestAnimationFrame(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      });
    }
  }, [open, quickKey]);

  // 點擊外部關閉備註下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setNoteDropdownOpen(false);
      }
    }
    if (noteDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [noteDropdownOpen]);

  if (!open || !quickKey) {
    return null;
  }

  const validation = validateRevenueAmountInput(amount);
  const merchantFilled =
    quickKey.merchant !== '' || merchant.trim() !== '';
  const isConfirmable =
    dateInput.trim() !== '' &&
    validation.valid &&
    validation.parsedValue !== null &&
    validation.parsedValue > 0 &&
    merchantFilled;

  function handleConfirm() {
    if (!isConfirmable || !quickKey) return;
    onConfirm(
      amount.trim(),
      quickKey.merchant.trim() || merchant.trim() || quickKey.label,
      note.trim(),
      dateInput,
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isConfirmable) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  const hasSuggestions =
    quickKey.suggestedNotes && quickKey.suggestedNotes.length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex min-h-screen w-full items-center justify-center bg-canton-dark/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amount-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="mx-auto w-full max-w-md rounded-sm border border-canton-dark/10 bg-white p-5 shadow-canton-md sm:p-6"
        onKeyDown={handleKeyDown}
      >
        {/* 標頭：快捷鍵名稱 + 科目徽章 */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="mb-0.5 text-xs text-canton-dark/40">{t('quickAddExpense')}</p>
            <h2
              id="amount-modal-title"
              className="text-xl font-semibold text-canton-dark"
            >
              {quickKey.label}
            </h2>
          </div>
          <span className="mt-0.5 shrink-0 rounded-sm bg-canton-red/10 px-2.5 py-0.5 text-xs font-medium text-canton-red">
            {getExpenseCategoryLabel(lang, quickKey.category)}
          </span>
        </div>

        {/* 財務歸屬日：預設今天，可自由選取歷史日期補登 */}
        <div className="mb-4 w-full">
          <label
            htmlFor="amount-modal-date"
            className="mb-1.5 block text-sm text-canton-dark/70"
          >
            {t('dateLabel')}
            <span className="ml-0.5 text-canton-red">*</span>
          </label>
          <input
            id="amount-modal-date"
            type="date"
            className="canton-input !w-[80%] max-w-[260px] mx-auto block box-border"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
        </div>

        {/* 供應商：下拉選員工 / 自動帶入（唯讀）/ 手動輸入（其他） */}
        {quickKey.merchantOptions && quickKey.merchantOptions.length > 0 ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm text-canton-dark/70">
              員工姓名
              <span className="ml-0.5 text-canton-red">*</span>
            </label>
            <MerchantDropdown
              options={quickKey.merchantOptions}
              value={merchant}
              onChange={setMerchant}
            />
          </div>
        ) : quickKey.merchant ? (
          <div className="mb-4 flex items-center gap-2 rounded-sm bg-canton-bg px-3 py-2 text-sm">
            <span className="text-canton-dark/45">供應商</span>
            <span className="font-medium text-canton-dark/85">
              {quickKey.merchant}
            </span>
            <span className="ml-auto rounded-sm bg-canton-dark/[0.06] px-1.5 py-0.5 text-xs text-canton-dark/40">
              自動帶入
            </span>
          </div>
        ) : (
          <div className="mb-4">
            <label
              htmlFor="amount-modal-merchant"
              className="mb-1.5 block text-sm text-canton-dark/70"
            >
              供應商 / 店家
              <span className="ml-0.5 text-canton-red">*</span>
            </label>
            <input
              id="amount-modal-merchant"
              type="text"
              className="canton-input"
              placeholder="請輸入供應商名稱"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </div>
        )}

        {/* 金額輸入（主要欄位，行動端純數字鍵盤） */}
        <div className="mb-4">
          <label
            htmlFor="amount-modal-amount"
            className="mb-1.5 block text-sm text-canton-dark/70"
          >
            {t('amountLabel')}
            <span className="ml-0.5 text-canton-red">*</span>
          </label>
          <input
            id="amount-modal-amount"
            ref={amountInputRef}
            type="text"
            inputMode="numeric"
            className="canton-input font-mono text-xl tabular-nums"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          {validation.error && (
            <p className="mt-1 text-xs text-canton-red" role="alert">
              {validation.error}
            </p>
          )}
          {validation.valid &&
            validation.parsedValue !== null &&
            validation.parsedValue > 0 && (
              <p className="mt-1 font-mono text-xs tabular-nums text-canton-dark/40">
                ＝ ${formatMoneyDisplay(validation.parsedValue)} 元
              </p>
            )}
        </div>

        {/* 備註欄（可選）：支援下拉快選 */}
        <div className="mb-6">
          <label
            htmlFor="amount-modal-note"
            className="mb-1.5 block text-sm text-canton-dark/70"
          >
            {t('noteLabel')}
          </label>
          {hasSuggestions ? (
            <div ref={dropdownRef} className="relative">
              <input
                id="amount-modal-note"
                type="text"
                className="canton-input pr-8"
                placeholder="選擇廠商或自行輸入"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onFocus={() => setNoteDropdownOpen(true)}
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label="展開建議清單"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-canton-dark/35 transition-transform duration-150"
                style={{
                  transform: `translateY(-50%) rotate(${noteDropdownOpen ? 180 : 0}deg)`,
                }}
                onClick={() => setNoteDropdownOpen((v) => !v)}
              >
                ▾
              </button>
              {noteDropdownOpen && (
                <ul
                  className="absolute left-0 right-0 top-full z-20 mt-0.5 overflow-hidden rounded-sm border border-canton-dark/10 bg-white shadow-canton"
                  role="listbox"
                >
                  {quickKey.suggestedNotes!.map((suggestion) => (
                    <li key={suggestion} role="option" aria-selected={note === suggestion}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-canton-bg ${
                          note === suggestion
                            ? 'font-medium text-canton-red'
                            : 'text-canton-dark/80'
                        }`}
                        onClick={() => {
                          setNote(suggestion);
                          setNoteDropdownOpen(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <input
              id="amount-modal-note"
              type="text"
              className="canton-input"
              placeholder={quickKey.defaultNote ?? '特殊說明'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-sm border border-canton-dark/20 py-3 text-sm text-canton-dark/65 transition-colors hover:bg-canton-bg"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!isConfirmable}
            onClick={handleConfirm}
            className="flex-1 rounded-sm bg-canton-red py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('confirmAdd')}
          </button>
        </div>
      </div>
    </div>
  );
}
