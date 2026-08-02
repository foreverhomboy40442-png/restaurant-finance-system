/**
 * 支出結構 — 五層下鑽式甜甜圈圖
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕費用 / 固定支出 佔比
 * 內圈：各分頁底下的實際項目（菜金、油條、雜支…）分別列出金額
 *
 * 分類邏輯與支出入帳分頁一致，見 expenseDrillDown.ts
 */

import { useEffect, useMemo, useState } from 'react';
import {
  buildSubCategoryBuckets,
  classifyExpenseTab,
} from '../../expense/expenseDrillDown';
import type { ExpenseTab } from '../../expense/quick-keys-config';
import { useLanguage } from '../../../context/LanguageContext';
import type { ExpenseItem } from '../../../types';
import { translateDataLabel } from '../../../utils/lang';
import type { TranslationKey } from '../../../utils/lang';

// ─── 型別 ────────────────────────────────────────────────────────────────────

interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface DrillTabConfig {
  id: ExpenseTab;
  btnLabel: string;
  topLabel: string;
  shortLabel: string;
  color: string;
}

interface SegmentDetail {
  segment: ChartSegment;
  total: number;
}

// ─── 靜態設定 ─────────────────────────────────────────────────────────────────

const DRILL_TAB_META: {
  id: ExpenseTab;
  labelKey: TranslationKey;
  shortKey: TranslationKey;
  color: string;
}[] = [
  { id: 'cash',         labelKey: 'expenseTabCash',    shortKey: 'drillShortCash',    color: '#A84B4B' },
  { id: 'pt',           labelKey: 'expenseTabPt',      shortKey: 'expenseTabPt',      color: '#4A6D95' },
  { id: 'payment',      labelKey: 'expenseTabPayment', shortKey: 'drillShortPayment', color: '#3D7260' },
  { id: 'repair',       labelKey: 'expenseTabRepair',  shortKey: 'drillShortRepair',  color: '#956F35' },
  { id: 'fixed_salary', labelKey: 'expenseTabFixed',   shortKey: 'drillShortFixed',   color: '#695788' },
];

const MUTED_PALETTE = [
  '#A84B4B', '#4A6D95', '#3D7260', '#956F35', '#695788',
  '#7A6347', '#3D7A8A', '#8A4A6A', '#6A8A4A', '#3A5A8A',
  '#8A7A3A', '#5A3A8A', '#3A7A6A', '#8A5A3A', '#5A8A3A',
  '#8A3A5A', '#3A688A', '#7A7A3A',
] as const;

// ─── SVG 幾何工具 ────────────────────────────────────────────────────────────

function polarPoint(cx: number, cy: number, r: number, angle: number): string {
  return `${(cx + r * Math.cos(angle - Math.PI / 2)).toFixed(2)} ${(cy + r * Math.sin(angle - Math.PI / 2)).toFixed(2)}`;
}

function segmentPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
): string {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${polarPoint(cx, cy, outerR, startAngle)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${polarPoint(cx, cy, outerR, endAngle)}`,
    `L ${polarPoint(cx, cy, innerR, endAngle)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${polarPoint(cx, cy, innerR, startAngle)}`,
    'Z',
  ].join(' ');
}

function fmt(v: number): string {
  return v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function compactAmount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  return `${Math.round(v / 1000)}K`;
}

function formatPct(value: number, total: number): string {
  return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
}

// ─── 子元件：甜甜圈 SVG ───────────────────────────────────────────────────────

interface DonutSvgProps {
  segments: ChartSegment[];
  size: number;
  innerLabel: string;
  innerValue: string;
}

function DonutSvg({ segments, size, innerLabel, innerValue }: DonutSvgProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.435;
  const innerR = size * 0.27;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let currentAngle = 0;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-auto"
      style={{ maxWidth: size }}
      aria-label="甜甜圈圖"
      role="img"
    >
      {segments.map((seg) => {
        const angle = (seg.value / total) * Math.PI * 2;
        const startA = currentAngle;
        const endA = currentAngle + angle - 0.013;
        currentAngle += angle;
        return (
          <path
            key={seg.label}
            d={segmentPath(cx, cy, outerR, innerR, startA, endA)}
            fill={seg.color}
            opacity="0.92"
          />
        );
      })}
      <text
        x={cx} y={cy - 7}
        textAnchor="middle"
        fontSize="8"
        fill="rgb(44 44 44 / 0.36)"
        fontFamily="PingFang TC, Noto Sans TC, sans-serif"
      >
        {innerLabel}
      </text>
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill="rgb(44 44 44 / 0.70)"
        fontFamily="JetBrains Mono, ui-monospace, monospace"
      >
        {innerValue}
      </text>
    </svg>
  );
}

interface LegendRowsProps {
  segments: ChartSegment[];
  total: number;
  activeLabel?: string;
  onSelect?: (label: string) => void;
  onShowDetail?: (detail: SegmentDetail) => void;
}

function LegendRows({
  segments,
  total,
  activeLabel,
  onSelect,
  onShowDetail,
}: LegendRowsProps) {
  return (
    <div className="space-y-2 md:space-y-1">
      {segments.map((seg) => {
        const pct = formatPct(seg.value, total);
        const isActive = seg.label === activeLabel;
        const isClickable = Boolean(onSelect || onShowDetail);

        function handleActivate() {
          onSelect?.(seg.label);
          onShowDetail?.({ segment: seg, total });
        }

        return (
          <div
            key={seg.label}
            onClick={isClickable ? handleActivate : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleActivate();
                    }
                  }
                : undefined
            }
            className={[
              'rounded-md border px-3 py-2.5 transition-colors md:rounded-sm md:border-transparent md:px-1.5 md:py-[5px]',
              isClickable ? 'cursor-pointer select-none active:bg-slate-50 md:hover:bg-slate-50' : '',
              isActive
                ? 'border-red-200 bg-red-50/60 md:border-transparent md:bg-slate-50 md:ring-1 md:ring-slate-200'
                : 'border-slate-100 bg-white md:border-transparent md:bg-transparent',
            ].join(' ')}
          >
            <div className="flex items-start gap-2.5 md:items-center">
              <span
                className="mt-0.5 h-3 w-3 shrink-0 rounded-[3px] md:mt-0 md:h-2.5 md:w-2.5 md:rounded-[2px]"
                style={{ backgroundColor: seg.color, opacity: 0.92 }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-slate-800 break-words md:text-xs md:font-normal md:text-slate-600">
                  {seg.label}
                </p>
                <div className="mt-1 flex items-center gap-3 md:hidden">
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {pct}%
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-700">
                    ${fmt(seg.value)}
                  </span>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-2 md:flex">
                <span className="w-10 text-right font-mono text-[11px] tabular-nums text-slate-400">
                  {pct}%
                </span>
                <span className="w-16 text-right font-mono text-[11px] tabular-nums text-slate-600">
                  ${fmt(seg.value)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SegmentDetailSheetProps {
  detail: SegmentDetail | null;
  onClose: () => void;
  shareLabel: string;
  amountLabel: string;
  closeLabel: string;
}

function SegmentDetailSheet({
  detail,
  onClose,
  shareLabel,
  amountLabel,
  closeLabel,
}: SegmentDetailSheetProps) {
  useEffect(() => {
    if (!detail) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detail]);

  if (!detail) return null;

  const { segment, total } = detail;
  const pct = formatPct(segment.value, total);

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-100 bg-white px-5 pb-8 pt-4 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <div className="mb-5 flex items-start gap-3">
          <span
            className="mt-1 h-4 w-4 shrink-0 rounded-[4px]"
            style={{ backgroundColor: segment.color, opacity: 0.92 }}
          />
          <h4 className="text-base font-semibold leading-snug text-slate-900 break-words">
            {segment.label}
          </h4>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-md bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {shareLabel}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-800">
              {pct}%
            </p>
          </div>
          <div className="rounded-md bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {amountLabel}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-800">
              ${fmt(segment.value)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-sm bg-slate-900 px-4 py-3 text-sm font-semibold text-white active:opacity-90"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export interface SvgDrillDownChartProps {
  expenses: ExpenseItem[];
}

export default function SvgDrillDownChart({ expenses }: SvgDrillDownChartProps) {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<ExpenseTab>('cash');
  const [detailPopup, setDetailPopup] = useState<SegmentDetail | null>(null);

  const drillTabs = useMemo<DrillTabConfig[]>(
    () =>
      DRILL_TAB_META.map((meta) => ({
        id: meta.id,
        btnLabel: t(meta.labelKey),
        topLabel: t(meta.labelKey),
        shortLabel: t(meta.shortKey),
        color: meta.color,
      })),
    [t],
  );

  const tabTotals = useMemo(() => {
    const totals: Record<ExpenseTab, number> = {
      cash: 0, pt: 0, payment: 0, repair: 0, fixed_salary: 0,
    };
    for (const e of expenses) {
      totals[classifyExpenseTab(e)] += e.amount;
    }
    return totals;
  }, [expenses]);

  const totalAll = Object.values(tabTotals).reduce((s, v) => s + v, 0);

  const outerSegments = useMemo<ChartSegment[]>(
    () =>
      drillTabs
        .map((tab) => ({
          label: tab.topLabel,
          value: tabTotals[tab.id],
          color: tab.color,
        }))
        .filter((s) => s.value > 0),
    [drillTabs, tabTotals],
  );

  const subSegments = useMemo<ChartSegment[]>(() => {
    const buckets = buildSubCategoryBuckets(expenses, activeTab);
    return buckets.map((bucket, index) => ({
      label: translateDataLabel(lang, bucket.label),
      value: bucket.value,
      color: MUTED_PALETTE[index % MUTED_PALETTE.length],
    }));
  }, [expenses, activeTab, lang]);

  const subTotal = tabTotals[activeTab];
  const activeTabConfig = drillTabs.find((tab) => tab.id === activeTab)!;

  function showMobileDetail(detail: SegmentDetail) {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
      return;
    }
    setDetailPopup(detail);
  }

  if (totalAll === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        {t('chartNoRangeData')}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-8">

        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t('chartExpenseCategoryShare')}
          </p>
          <p className="text-xs text-slate-400 md:hidden">{t('chartTapCategoryHint')}</p>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
            <div className="mx-auto shrink-0 md:mx-0" style={{ width: 160 }}>
              <DonutSvg
                segments={outerSegments}
                size={160}
                innerLabel={t('totalLabel')}
                innerValue={compactAmount(totalAll)}
              />
            </div>

            <div className="w-full min-w-0 md:flex-1 md:pt-1">
              <LegendRows
                segments={outerSegments}
                total={totalAll}
                activeLabel={activeTabConfig.topLabel}
                onSelect={(label) => {
                  const found = drillTabs.find((tab) => tab.topLabel === label);
                  if (found) setActiveTab(found.id);
                }}
                onShowDetail={showMobileDetail}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="block border-t border-slate-100 md:hidden" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {t('chartSubCategoryDrill')}
          </p>
          <p className="text-xs text-slate-400 md:hidden">{t('chartTapCategoryHint')}</p>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-5 md:gap-1 md:overflow-visible md:px-0 md:pb-0">
            {drillTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 whitespace-nowrap rounded-sm px-3 py-2 text-xs font-semibold leading-tight tracking-wide transition-all md:rounded-none md:px-3 md:py-1 md:text-[11px] ${
                    isActive
                      ? 'border border-red-200 bg-red-50 text-red-700 md:border-0 md:border-b-2 md:border-red-600 md:bg-transparent md:font-bold md:text-red-600'
                      : 'border border-slate-100 bg-white text-slate-600 hover:text-slate-800 md:border-0 md:border-b-2 md:border-transparent md:bg-transparent md:text-slate-500'
                  }`}
                >
                  {tab.btnLabel}
                </button>
              );
            })}
          </div>

          {subTotal > 0 ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
              <div className="mx-auto shrink-0 md:mx-0" style={{ width: 140 }}>
                <DonutSvg
                  segments={subSegments}
                  size={140}
                  innerLabel={activeTabConfig.shortLabel}
                  innerValue={compactAmount(subTotal)}
                />
              </div>

              <div className="w-full min-w-0 md:max-h-52 md:flex-1 md:overflow-y-auto md:pt-1">
                <LegendRows
                  segments={subSegments}
                  total={subTotal}
                  onShowDetail={showMobileDetail}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-sm bg-slate-50 text-xs text-slate-400">
              {t('chartNoCategoryData')}
            </div>
          )}
        </div>

      </div>

      <SegmentDetailSheet
        detail={detailPopup}
        onClose={() => setDetailPopup(null)}
        shareLabel={t('chartDetailShare')}
        amountLabel={t('chartDetailAmount')}
        closeLabel={t('chartCloseDetail')}
      />
    </>
  );
}
