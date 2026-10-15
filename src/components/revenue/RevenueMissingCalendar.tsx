/**
 * 營收缺記小日曆：標示選定月份哪些日子營收未齊。
 * 綠＝完整｜紅＝缺記／未齊｜白＝未來日
 */

import { useMemo, useState } from 'react';
import type { RevenueItem } from '../../types';
import { toFinancialDateFromDate } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import {
  buildRevenuePeriodsByDate,
  getRevenueDayStatus,
  listIncompleteRevenueDatesInMonth,
  type RevenueDayStatus,
} from '../../utils/revenue-completeness';

const WEEKDAY_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;
const WEEKDAY_LABELS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

interface RevenueMissingCalendarProps {
  revenues: RevenueItem[];
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
}

function monthPrefixFromDate(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function statusClass(status: RevenueDayStatus, isSelected: boolean): string {
  const ring = isSelected ? 'ring-2 ring-canton-dark/40 ring-offset-1' : '';
  switch (status) {
    case 'complete':
      return `bg-emerald-100 text-emerald-900 hover:bg-emerald-200 ${ring}`;
    case 'incomplete':
      return `bg-canton-red/15 text-canton-red hover:bg-canton-red/25 ${ring}`;
    case 'future':
      return `bg-white text-canton-dark/45 hover:bg-canton-bg ${ring}`;
    default:
      return ring;
  }
}

export default function RevenueMissingCalendar({
  revenues,
  selectedDate,
  onSelectDate,
}: RevenueMissingCalendarProps) {
  const { t, lang } = useLanguage();
  const todayISO = toFinancialDateFromDate(new Date()) as string;
  const [viewMonth, setViewMonth] = useState(() =>
    monthPrefixFromDate(selectedDate || todayISO),
  );

  const periodsByDate = useMemo(
    () => buildRevenuePeriodsByDate(revenues),
    [revenues],
  );

  const incompleteDates = useMemo(
    () => listIncompleteRevenueDatesInMonth(viewMonth, periodsByDate, todayISO),
    [viewMonth, periodsByDate, todayISO],
  );

  const cells = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const result: Array<{ dateISO: string | null; day: number | null }> = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      result.push({ dateISO: null, day: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateISO = `${viewMonth}-${String(day).padStart(2, '0')}`;
      result.push({ dateISO, day });
    }
    return result;
  }, [viewMonth]);

  const weekdayLabels = lang === 'en' ? WEEKDAY_LABELS_EN : WEEKDAY_LABELS_ZH;
  const [yLabel, mLabel] = viewMonth.split('-');

  return (
    <section className="max-w-full overflow-hidden rounded-sm border border-canton-dark/8 bg-white p-4 shadow-canton sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-canton-dark">
            {t('revenueMissingCalendarTitle')}
          </h2>
          <p className="mt-1 text-xs text-canton-dark/50">
            {t('revenueMissingCalendarHint')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            className="rounded-sm border border-canton-dark/15 px-2.5 py-1.5 text-xs text-canton-dark/60 hover:border-canton-red/30 hover:text-canton-red"
            aria-label={t('revenueCalendarPrevMonth')}
          >
            ‹
          </button>
          <span className="min-w-[5.5rem] text-center font-mono text-sm font-semibold text-canton-dark tabular-nums">
            {lang === 'en' ? `${yLabel}-${mLabel}` : `${yLabel}年${Number(mLabel)}月`}
          </span>
          <button
            type="button"
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            className="rounded-sm border border-canton-dark/15 px-2.5 py-1.5 text-xs text-canton-dark/60 hover:border-canton-red/30 hover:text-canton-red"
            aria-label={t('revenueCalendarNextMonth')}
          >
            ›
          </button>
        </div>
      </div>

      <p className="mt-3 font-mono text-xs text-canton-dark/55 tabular-nums">
        {t('revenueMissingCount', { count: incompleteDates.length })}
      </p>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="py-1 text-[10px] font-medium uppercase tracking-wide text-canton-dark/40"
          >
            {label}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.dateISO || cell.day === null) {
            return <div key={`pad-${index}`} className="aspect-square" />;
          }
          const status = getRevenueDayStatus(
            cell.dateISO,
            periodsByDate,
            todayISO,
          );
          const isSelected = cell.dateISO === selectedDate;
          return (
            <button
              key={cell.dateISO}
              type="button"
              onClick={() => onSelectDate(cell.dateISO!)}
              className={`aspect-square rounded-sm text-sm font-medium tabular-nums transition-colors ${statusClass(status, isSelected)}`}
              title={
                status === 'complete'
                  ? t('revenueDayComplete')
                  : status === 'incomplete'
                    ? t('revenueDayIncomplete')
                    : t('revenueDayFuture')
              }
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-canton-dark/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
          {t('revenueDayComplete')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-canton-red/20 ring-1 ring-canton-red/40" />
          {t('revenueDayIncomplete')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-canton-dark/15" />
          {t('revenueDayFuture')}
        </span>
      </div>
    </section>
  );
}
