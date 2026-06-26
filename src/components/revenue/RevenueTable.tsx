/**
 * 待核銷帳務清單（Dynamic Queue with Pagination）
 *
 * 規格：
 * - 僅接收並顯示 draft 帳目（由父層 RevenueManagement 過濾後傳入）
 * - 每頁固定 5 筆，最多顯示 3 頁（上限 15 筆）
 * - 超出 15 筆時顯示積壓警示橫幅
 * - 核帳後帳目立即從父層 revenues 消失，清單即時刷新
 */

import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { RevenueItem } from '../../types';
import { getAuditStatusLabel, getRevenuePeriodLabel } from '../../utils/lang';
import { formatMoneyDisplay } from '../../utils/revenue-form';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RevenueTableProps {
  /** 已由父層過濾為 draft-only，依日期降序排列 */
  items: RevenueItem[];
  editingId: string | null;
  onEdit: (item: RevenueItem) => void;
  onDelete: (id: string) => void;
  onLock: (id: string) => void;
}

// ─── 分頁常數 ─────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 5;
const MAX_PAGES = 3;
const MAX_DISPLAY = ITEMS_PER_PAGE * MAX_PAGES; // 15

// ─── 圖示子元件 ───────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M10.354 3.646a.5.5 0 0 1 0 .708L6.707 8l3.647 3.646a.5.5 0 0 1-.708.708l-4-4a.5.5 0 0 1 0-.708l4-4a.5.5 0 0 1 .708 0z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path fillRule="evenodd" d="M5.646 3.646a.5.5 0 0 0 0 .708L9.293 8 5.646 11.646a.5.5 0 0 0 .708.708l4-4a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708 0z" clipRule="evenodd" />
    </svg>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function RevenueTable({
  items,
  editingId,
  onEdit,
  onDelete,
  onLock,
}: RevenueTableProps) {
  const { t, lang } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);

  // 空態
  if (items.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-2 py-4 text-center">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="h-10 w-10 text-canton-dark/20" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-canton-dark/40">{t('revenueEmptyPending')}</p>
        <p className="text-xs text-canton-dark/30">{t('revenueEmptyPendingDesc')}</p>
      </div>
    );
  }

  // 分頁計算
  const cappedItems = items.slice(0, MAX_DISPLAY);
  const overflowCount = items.length - MAX_DISPLAY;
  const totalPages = Math.max(1, Math.min(MAX_PAGES, Math.ceil(cappedItems.length / ITEMS_PER_PAGE)));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = cappedItems.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">

      {/* ── 積壓警示 ──────────────────────────────────────────────────────── */}
      {overflowCount > 0 && (
        <div className="flex items-start gap-3 rounded-sm border border-canton-red/25 bg-canton-red/5 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-canton-red" aria-hidden="true">⚠</span>
          <p className="text-sm leading-snug text-canton-red">
            {t('revenueOverflowWarning', { count: overflowCount })}
          </p>
        </div>
      )}

      {/* ── 表格 ──────────────────────────────────────────────────────────── */}
      <div className="-mx-1 max-w-full overflow-x-auto rounded-sm shadow-canton sm:mx-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-canton-dark/10 text-canton-dark/50">
              <th className="pb-3 pr-4 font-medium">{t('colFinancialDate')}</th>
              <th className="pb-3 pr-4 font-medium">{t('colMealPeriod')}</th>
              <th className="pb-3 pr-4 font-medium text-right">{t('colAmount')}</th>
              <th className="pb-3 pr-4 font-medium">{t('colOperator')}</th>
              <th className="pb-3 pr-4 font-medium">{t('colNote')}</th>
              <th className="pb-3 pr-4 font-medium">{t('colStatus')}</th>
              <th className="pb-3 font-medium text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-canton-dark/5 transition-colors ${
                    isEditing ? 'bg-canton-red/[0.03]' : 'hover:bg-canton-bg/50'
                  }`}
                >
                  <td className="py-4 pr-4 font-mono text-canton-dark">{item.date}</td>
                  <td className="py-4 pr-4 text-canton-dark/80">
                    {getRevenuePeriodLabel(lang, item.period)}
                  </td>
                  <td className="py-4 pr-4 text-right font-mono tabular-nums text-canton-dark">
                    ${formatMoneyDisplay(item.amount)}
                  </td>
                  <td className="py-4 pr-4 text-canton-dark/80">{item.operatorId}</td>
                  <td className="py-4 pr-4 text-canton-dark/50">{item.note ?? '—'}</td>
                  <td className="py-4 pr-4">
                    <span className="inline-block rounded-sm bg-canton-bg px-2 py-0.5 text-xs text-canton-dark/60">
                      {getAuditStatusLabel(lang, item.auditStatus)}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="min-h-[2rem] px-1 text-xs font-medium text-canton-red transition-opacity hover:opacity-70"
                      >
                        {t('actionEdit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="min-h-[2rem] px-1 text-xs text-canton-dark/40 transition-colors hover:text-canton-red"
                      >
                        {t('actionDelete')}
                      </button>
                      <span className="hidden text-canton-dark/15 sm:inline">|</span>
                      <button
                        type="button"
                        onClick={() => onLock(item.id)}
                        className="min-h-[2rem] rounded-sm border border-canton-red/30 px-3 py-1 text-xs font-medium text-canton-red transition-colors hover:bg-canton-red hover:text-white"
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

      {/* ── 分頁控制列 ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-1">
        {/* 左側：筆數摘要 */}
        <p className="font-mono text-[11px] text-canton-dark/38 tabular-nums">
          {t('revenuePageSummary', {
            page: safePage,
            totalPages,
            count: cappedItems.length,
          })}
        </p>

        {/* 右側：翻頁按鈕 */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {/* 上一頁 */}
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(safePage - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-canton-dark/12 text-canton-dark/50 transition-colors hover:border-canton-red/40 hover:text-canton-red disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t('prevPage')}
            >
              <ChevronLeftIcon />
            </button>

            {/* 頁碼 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`h-7 min-w-[1.75rem] rounded-sm px-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                  page === safePage
                    ? 'bg-canton-red text-white'
                    : 'border border-canton-dark/12 text-canton-dark/55 hover:border-canton-red/40 hover:text-canton-red'
                }`}
                aria-current={page === safePage ? 'page' : undefined}
              >
                {page}
              </button>
            ))}

            {/* 下一頁 */}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(safePage + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-canton-dark/12 text-canton-dark/50 transition-colors hover:border-canton-red/40 hover:text-canton-red disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t('nextPage')}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
