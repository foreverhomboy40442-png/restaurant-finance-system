/**
 * 支出結構 — 五層下鑽式甜甜圈圖
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕費用 / 固定支出 佔比
 * 內圈：各分頁底下的實際項目（菜金、油條、雜支…）分別列出金額
 *
 * 分類邏輯與支出入帳分頁一致，見 expenseDrillDown.ts
 */

import { useMemo, useState } from 'react';
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
}

function LegendRows({ segments, total, activeLabel, onSelect }: LegendRowsProps) {
  return (
    <div className="space-y-1">
      {segments.map((seg) => {
        const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0';
        const isActive = seg.label === activeLabel;
        return (
          <div
            key={seg.label}
            onClick={() => onSelect?.(seg.label)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={
              onSelect
                ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(seg.label); }
                : undefined
            }
            className={`flex items-center gap-2 rounded-sm px-1.5 py-[5px] text-xs transition-colors ${
              onSelect ? 'cursor-pointer select-none hover:bg-slate-50' : ''
            } ${isActive ? 'bg-slate-50 ring-1 ring-slate-200' : ''}`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: seg.color, opacity: 0.92 }}
            />
            <span className="flex-1 truncate text-slate-600 leading-tight">
              {seg.label}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400 w-10 text-right">
              {pct}%
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-600 w-16 text-right">
              ${fmt(seg.value)}
            </span>
          </div>
        );
      })}
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

  if (totalAll === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        {t('chartNoRangeData')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">

      <div className="flex flex-col gap-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('chartExpenseCategoryShare')}
        </p>

        <div className="flex items-start gap-5">
          <div className="shrink-0" style={{ width: 144 }}>
            <DonutSvg
              segments={outerSegments}
              size={144}
              innerLabel={t('totalLabel')}
              innerValue={compactAmount(totalAll)}
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <LegendRows
              segments={outerSegments}
              total={totalAll}
              activeLabel={activeTabConfig.topLabel}
              onSelect={(label) => {
                const found = drillTabs.find((tab) => tab.topLabel === label);
                if (found) setActiveTab(found.id);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">

        <div className="block md:hidden border-t border-slate-100 -mx-1" />

        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('chartSubCategoryDrill')}
        </p>

        <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
          {drillTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-none px-3 py-1 text-[10px] font-semibold leading-tight tracking-wide transition-all sm:text-[11px] ${
                  isActive
                    ? 'border-b-2 border-red-600 bg-transparent font-bold text-red-600'
                    : 'border-b-2 border-transparent bg-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.btnLabel}
              </button>
            );
          })}
        </div>

        {subTotal > 0 ? (
          <div className="flex items-start gap-5">
            <div className="shrink-0" style={{ width: 120 }}>
              <DonutSvg
                segments={subSegments}
                size={120}
                innerLabel={activeTabConfig.shortLabel}
                innerValue={compactAmount(subTotal)}
              />
            </div>

            <div className="flex-1 min-w-0 pt-1 max-h-52 overflow-y-auto">
              <LegendRows segments={subSegments} total={subTotal} />
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-sm bg-slate-50 text-xs text-slate-400">
            {t('chartNoCategoryData')}
          </div>
        )}
      </div>

    </div>
  );
}
