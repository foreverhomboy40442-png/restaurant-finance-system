/**
 * 支出結構 — 五層下鑽式甜甜圈圖
 *
 * 外圈：現金支出 / PT薪資 / 支付貨款 / 修繕費用 / 固定薪資 佔比
 * 內圈：點選 Tab 後即時渲染該類別的子科目明細
 *
 * 分類優先順序：
 *   1. category === 'repair'       → repair tab
 *   2. category === 'fixed_salary' → fixed_salary tab
 *   3. merchant in PT_SET          → pt tab
 *   4. merchant in PAYMENT_SET     → payment tab
 *   5. 其餘                        → cash tab
 *
 * 純 SVG，無第三方依賴；w-full h-auto viewBox 強韌 RWD 不爆版。
 */

import { useMemo, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import type { ExpenseItem } from '../../../types';
import { translateDataLabel } from '../../../utils/lang';
import type { TranslationKey } from '../../../utils/lang';

// ─── 型別 ────────────────────────────────────────────────────────────────────

type DrillTab = 'cash' | 'pt' | 'payment' | 'repair' | 'fixed_salary';

interface ChartSegment {
  label: string;
  value: number;
  color: string;
}

interface DrillTabConfig {
  id: DrillTab;
  btnLabel: string;
  topLabel: string;
  shortLabel: string;
  color: string;
}

// ─── 靜態設定 ─────────────────────────────────────────────────────────────────

const DRILL_TAB_META: {
  id: DrillTab;
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

// PT 點工商家識別集合（不含電費、瓦斯 — 已移至現金支出）
const PT_MERCHANT_SET = new Set([
  '拖地', '收垃圾', '林安邦', '陳東海', '林進賢', 'Dee', '垃圾（廚餘）', '洗碗',
]);

const PAYMENT_MERCHANT_SET = new Set([
  '檯布', '惠通(一)', '酒', '大友(二)', '惠通(二)',
]);

// 子科目顯示順序
const SUB_ORDER: Record<DrillTab, string[]> = {
  cash: ['菜金', '油條', '雞', '乾貨', '便當盒', '雜貨', '電費', '瓦斯', '其他'],
  pt:   ['拖地', '收垃圾', '林安邦', '陳東海', '林進賢', 'Dee', '垃圾（廚餘）', '洗碗', '其他'],
  payment: ['檯布', '惠通(一)', '酒', '大友(二)', '惠通(二)', '其他'],
  repair: ['修繕', '其他'],
  fixed_salary: [
    '曾美惠', '梁桂蓮', '林美玉', '陳速華', '陳棋瑞',
    '高雲鵬', '黃楚平', '林安邦', '陳世郎', '鍾耀霆',
    'Noel', '吳慧芬', '張綺蓮', '小惠', '吳啟德', '吳大衛', '鍾正綱', '其他',
  ],
};

/**
 * 全站共用低飽和色盤（18 色）
 * 設計原則：冷暖交錯、明度接近、彼此可辨、不刺眼
 */
const MUTED_PALETTE = [
  '#A84B4B', // brick
  '#4A6D95', // steel blue
  '#3D7260', // sage
  '#956F35', // ochre
  '#695788', // dusty violet
  '#7A6347', // warm taupe
  '#3D7A8A', // teal
  '#8A4A6A', // mauve
  '#6A8A4A', // olive
  '#3A5A8A', // navy
  '#8A7A3A', // warm gold
  '#5A3A8A', // deep violet
  '#3A7A6A', // seafoam
  '#8A5A3A', // rust
  '#5A8A3A', // moss
  '#8A3A5A', // plum
  '#3A688A', // slate
  '#7A7A3A', // khaki
] as const;

const SUB_COLORS: Record<DrillTab, Record<string, string>> = {
  cash: {
    '菜金':  MUTED_PALETTE[0],
    '油條':  MUTED_PALETTE[1],
    '雞':    MUTED_PALETTE[2],
    '乾貨':  MUTED_PALETTE[3],
    '便當盒': MUTED_PALETTE[4],
    '雜貨':  MUTED_PALETTE[5],
    '電費':  MUTED_PALETTE[6],
    '瓦斯':  MUTED_PALETTE[7],
    '其他':  MUTED_PALETTE[8],
  },
  pt: {
    '拖地':        MUTED_PALETTE[0],
    '收垃圾':      MUTED_PALETTE[1],
    '林安邦':      MUTED_PALETTE[2],
    '陳東海':      MUTED_PALETTE[3],
    '林進賢':      MUTED_PALETTE[4],
    'Dee':         MUTED_PALETTE[5],
    '垃圾（廚餘）': MUTED_PALETTE[6],
    '洗碗':        MUTED_PALETTE[7],
    '其他':        MUTED_PALETTE[8],
  },
  payment: {
    '檯布':    MUTED_PALETTE[0],
    '惠通(一)': MUTED_PALETTE[1],
    '酒':      MUTED_PALETTE[2],
    '大友(二)': MUTED_PALETTE[3],
    '惠通(二)': MUTED_PALETTE[4],
    '其他':    MUTED_PALETTE[5],
  },
  repair: {
    '修繕': MUTED_PALETTE[3],
    '其他': MUTED_PALETTE[5],
  },
  fixed_salary: {
    '曾美惠': MUTED_PALETTE[0],  '梁桂蓮': MUTED_PALETTE[1],
    '林美玉': MUTED_PALETTE[2],  '陳速華': MUTED_PALETTE[3],
    '陳棋瑞': MUTED_PALETTE[4],  '高雲鵬': MUTED_PALETTE[5],
    '黃楚平': MUTED_PALETTE[6],  '林安邦': MUTED_PALETTE[7],
    '陳世郎': MUTED_PALETTE[8],  '鍾耀霆': MUTED_PALETTE[9],
    'Noel':   MUTED_PALETTE[10], '吳慧芬': MUTED_PALETTE[11],
    '張綺蓮': MUTED_PALETTE[12], '小惠':   MUTED_PALETTE[13],
    '吳啟德': MUTED_PALETTE[14], '吳大衛': MUTED_PALETTE[15],
    '鍾正綱': MUTED_PALETTE[16], '其他':   MUTED_PALETTE[17],
  },
};

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

// ─── 格式化 ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  return v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function compactAmount(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  return `${Math.round(v / 1000)}K`;
}

// ─── 資料分類（類別欄位優先，向下相容舊資料的商家名稱判斷） ───────────────────

function classifyTab(item: ExpenseItem): DrillTab {
  if (item.category === 'repair') return 'repair';
  if (item.category === 'fixed_salary') return 'fixed_salary';
  if (PT_MERCHANT_SET.has(item.merchant)) return 'pt';
  if (PAYMENT_MERCHANT_SET.has(item.merchant)) return 'payment';
  if (typeof item.note === 'string' && item.note.includes('支付貨款')) return 'payment';
  return 'cash';
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

// ─── 子元件：圖例列表 ─────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<DrillTab>('cash');

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

  const tabTotals = useMemo<Record<DrillTab, number>>(() => {
    const totals: Record<DrillTab, number> = {
      cash: 0, pt: 0, payment: 0, repair: 0, fixed_salary: 0,
    };
    for (const e of expenses) {
      totals[classifyTab(e)] += e.amount;
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
    const order = SUB_ORDER[activeTab];
    const colors = SUB_COLORS[activeTab];
    const buckets: Record<string, number> = {};

    for (const e of expenses) {
      if (classifyTab(e) !== activeTab) continue;
      const key = order.includes(e.merchant) ? e.merchant : '其他';
      buckets[key] = (buckets[key] ?? 0) + e.amount;
    }

    return order
      .map((label) => ({
        label: translateDataLabel(lang, label),
        value: buckets[label] ?? 0,
        color: colors[label] ?? '#AAAAAA',
      }))
      .filter((s) => s.value > 0);
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

      {/* ── 左欄：五大類別總覽 ──────────────────────────────────────────── */}
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

      {/* ── 右欄：Tab 切換 + 子科目下鑽 ──────────────────────────────── */}
      <div className="flex flex-col gap-4">

        <div className="block md:hidden border-t border-slate-100 -mx-1" />

        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {t('chartSubCategoryDrill')}
        </p>

        {/* Tab 切換按鈕 — 2 行排列（5 顆較小，避免擠版） */}
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

        {/* 子科目甜甜圈 + 圖例 */}
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
