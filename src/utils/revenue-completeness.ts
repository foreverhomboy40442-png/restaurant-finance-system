/**
 * 營收日完整性判定（小日曆用）
 *
 * 完整：有全日，或上午＋下午都有
 * 未齊：完全沒記，或只記上午／只記下午
 * 未來：尚未到的日期
 */

import type { RevenueItem, RevenuePeriod } from '../types';

export type RevenueDayStatus = 'complete' | 'incomplete' | 'future';

/** 依當日已有餐期集合判定狀態（不含未來日判斷） */
export function resolveRevenueDayStatus(
  periods: ReadonlySet<RevenuePeriod>,
): Exclude<RevenueDayStatus, 'future'> {
  if (periods.has('all_day')) return 'complete';
  if (periods.has('lunch') && periods.has('dinner')) return 'complete';
  return 'incomplete';
}

/** 將營收列表聚合成「日期 → 餐期集合」 */
export function buildRevenuePeriodsByDate(
  revenues: readonly RevenueItem[],
): Map<string, Set<RevenuePeriod>> {
  const map = new Map<string, Set<RevenuePeriod>>();
  for (const item of revenues) {
    const date = item.date as string;
    let set = map.get(date);
    if (!set) {
      set = new Set<RevenuePeriod>();
      map.set(date, set);
    }
    set.add(item.period);
  }
  return map;
}

/**
 * 單一日期狀態。
 * @param todayISO 今日 YYYY-MM-DD（未來日以此比較）
 */
export function getRevenueDayStatus(
  dateISO: string,
  periodsByDate: ReadonlyMap<string, ReadonlySet<RevenuePeriod>>,
  todayISO: string,
): RevenueDayStatus {
  if (dateISO > todayISO) return 'future';
  const periods = periodsByDate.get(dateISO);
  return resolveRevenueDayStatus(periods ?? new Set());
}

/** 列出 YYYY-MM 內所有缺記／未齊日期（不含未來日） */
export function listIncompleteRevenueDatesInMonth(
  yearMonth: string,
  periodsByDate: ReadonlyMap<string, ReadonlySet<RevenuePeriod>>,
  todayISO: string,
): string[] {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return [];
  const daysInMonth = new Date(y, m, 0).getDate();
  const result: string[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateISO = `${yearMonth}-${String(day).padStart(2, '0')}`;
    if (getRevenueDayStatus(dateISO, periodsByDate, todayISO) === 'incomplete') {
      result.push(dateISO);
    }
  }
  return result;
}
