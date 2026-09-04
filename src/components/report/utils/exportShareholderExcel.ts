/**
 * 股東財務損益報表 — Excel 匯出工具（月份矩陣版）
 *
 * 結構：A欄項目名稱 | B欄月1 | C欄月2 | ... | 最末欄合計
 *
 * 財務美學：白底黑字 · 極淡灰細格線 · 無色塊 · 無 Emoji
 * 關鍵小計（稅前淨利 / 最終可分配盈餘）用 medium border 上下雙線
 * 合計欄全欄加粗 + medium 左側分隔線
 * A4 直向（≤6 月）/ 橫向（>6 月），fit-to-page 自動縮放
 */

import XLSX from 'xlsx-js-style';
import type { ExpenseItem, RevenueItem } from '../../../types';
import {
  calcPnl,
  filterByMonths,
  getReportCategoryBreakdown,
  getReportCategoryItemBreakdown,
  monthToLabel,
  sumExpenses,
  sumRevenues,
  type ReportCategoryKey,
} from './reportCalc';

// ── 公開介面 ──────────────────────────────────────────────────────────────────

export interface ExportShareholderParams {
  selectedMonths: string[];
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
  yearEndMonthly: number;
  repairFundMonthly: number;
  taxRate: number;
  employeeBonusPct: number;
  reserveRate: number;
}

// ── 逐月計算結果 ──────────────────────────────────────────────────────────────

interface MonthData {
  grossRevenue:      number;
  operatingExpenses: number;
  ingredients:       number;
  labor:             number;
  utilities:         number;
  repair:            number;
  operatingMisc:     number;
  yearEndBonus:      number;
  repairFund:        number;
  netBeforeTax:      number;
  taxAmount:         number;
  employeeBonus:     number;
  reservedSurplus:   number;
  finalDistributable:number;
}

// ── 樣式常數 ──────────────────────────────────────────────────────────────────

const WHITE    = 'FFFFFF';
const HDR_FILL = 'EBEBEB';   // 表頭列底色（極淡灰）
const BLACK    = '000000';
const GRAY_BD  = 'C8C8C8';   // 一般細格線
const DARK_BD  = '1A1A1A';   // 小計雙線

type BorderSide = { style: string; color: { rgb: string } };
type BorderObj  = { top?: BorderSide; bottom?: BorderSide; left?: BorderSide; right?: BorderSide };

const thin: BorderSide = { style: 'thin',   color: { rgb: GRAY_BD } };
const med:  BorderSide = { style: 'medium', color: { rgb: DARK_BD } };

const bdAll:  BorderObj = { top: thin, bottom: thin, left: thin, right: thin };
const bdBoth: BorderObj = { ...bdAll, top: med, bottom: med };

// 合計欄：medium 左側分隔線
const bdTotal:      BorderObj = { ...bdAll, left: med };
const bdTotalBoth:  BorderObj = { ...bdBoth, left: med };

/** Excel 金額格式：$5,125,000 / -$5,125,000 */
const MONEY_FMT = '"$"#,##0;\\-"$"#,##0';

// ── Cell 工廠 ─────────────────────────────────────────────────────────────────

interface CS {
  bold?:   boolean;
  italic?: boolean;
  sz?:     number;
  align?:  'left' | 'center' | 'right';
  fmt?:    string;
  border?: BorderObj;
  fill?:   string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mk(value: string | number, s: CS = {}): Record<string, any> {
  const isNum = typeof value === 'number';
  return {
    v: value,
    t: isNum ? 'n' : 's',
    ...(s.fmt ? { z: s.fmt } : {}),
    s: {
      font: {
        name:   'Arial',
        sz:     s.sz   ?? 10,
        bold:   s.bold ?? false,
        italic: s.italic ?? false,
        color:  { rgb: BLACK },
      },
      fill:      { fgColor: { rgb: s.fill ?? WHITE } },
      border:    s.border ?? bdAll,
      alignment: {
        horizontal: s.align ?? (isNum ? 'right' : 'left'),
        vertical:   'center',
      },
    },
  };
}

function empty(fill = WHITE) {
  return mk('', { fill, border: bdAll });
}

// ── 主匯出函式 ────────────────────────────────────────────────────────────────

export function exportShareholderExcel(p: ExportShareholderParams): void {
  const sorted  = [...p.selectedMonths].sort();
  const nMonths = sorted.length;

  if (nMonths === 0) return;

  const numCols = nMonths + 2;  // 項目欄 + N月 + 合計欄

  // ── 統計區間文字 ────────────────────────────────────────────────────────────
  const periodStr =
    nMonths === 1
      ? monthToLabel(sorted[0])
      : `${monthToLabel(sorted[0])} ~ ${monthToLabel(sorted[nMonths - 1])}`;

  // ── 逐月計算 ────────────────────────────────────────────────────────────────
  const monthly: MonthData[] = sorted.map((month) => {
    const { revenues: mRev, expenses: mExp } = filterByMonths(
      p.revenues, p.expenses, [month],
    );
    const grossRevenue      = sumRevenues(mRev);
    const operatingExpenses = sumExpenses(mExp);
    const cat               = getReportCategoryBreakdown(mExp);
    const yearEndBonus      = p.yearEndMonthly;
    const repairFund        = p.repairFundMonthly;

    // 使用共用 calcPnl — 正確處理虧損月（不再 Math.max 歸零）
    const pnl = calcPnl({
      grossRevenue,
      operatingExpenses,
      yearEndBonus,
      repairFund,
      taxRate:          p.taxRate,
      employeeBonusPct: p.employeeBonusPct,
      reserveRate:      p.reserveRate,
    });

    return {
      grossRevenue,
      operatingExpenses,
      ingredients:       cat.ingredients,
      labor:             cat.labor,
      utilities:         cat.utilities,
      repair:            cat.repair,
      operatingMisc:     cat.operating_misc,
      yearEndBonus,
      repairFund,
      netBeforeTax:       pnl.netBeforeTax,
      taxAmount:          pnl.taxAmount,
      employeeBonus:      pnl.employeeBonus,
      reservedSurplus:    pnl.reservedSurplus,
      finalDistributable: pnl.finalDistributable,
    };
  });

  // ── 合計（各列逐月加總）──────────────────────────────────────────────────
  function sumKey(key: keyof MonthData): number {
    return monthly.reduce((s, m) => s + m[key], 0);
  }

  const totals: MonthData = {
    grossRevenue:       sumKey('grossRevenue'),
    operatingExpenses:  sumKey('operatingExpenses'),
    ingredients:        sumKey('ingredients'),
    labor:              sumKey('labor'),
    utilities:          sumKey('utilities'),
    repair:             sumKey('repair'),
    operatingMisc:      sumKey('operatingMisc'),
    yearEndBonus:       sumKey('yearEndBonus'),
    repairFund:         sumKey('repairFund'),
    netBeforeTax:       sumKey('netBeforeTax'),
    taxAmount:          sumKey('taxAmount'),
    employeeBonus:      sumKey('employeeBonus'),
    reservedSurplus:    sumKey('reservedSurplus'),
    finalDistributable: sumKey('finalDistributable'),
  };

  // ── 列建構器 ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Row = Record<string, any>[];
  const rows:   Row[]                                                = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  /** 全欄合併列（標題 / 期間） */
  function mergeRow(text: string, s: CS) {
    const r = rows.length;
    const cells: Row = [mk(text, s)];
    for (let i = 1; i < numCols; i++) cells.push(mk('', { fill: s.fill, border: s.border ?? bdAll }));
    merges.push({ s: { r, c: 0 }, e: { r, c: numCols - 1 } });
    rows.push(cells);
  }

  /** 空列 */
  function emptyRow() {
    rows.push(Array.from({ length: numCols }, () => empty()));
  }

  /** 表頭列：項目 | 月1 | 月2 | ... | 合計 */
  function headerRow() {
    const hdrBd: BorderObj = { ...bdAll, bottom: med };
    const cells: Row = [mk('項目', { bold: true, fill: HDR_FILL, border: hdrBd })];
    for (const m of sorted) {
      cells.push(mk(monthToLabel(m), { bold: true, align: 'center', fill: HDR_FILL, border: hdrBd }));
    }
    cells.push(mk('合計', { bold: true, align: 'center', fill: HDR_FILL, border: { ...hdrBd, left: med } }));
    rows.push(cells);
  }

  /**
   * 數據列
   * @param label      - 項目名稱（含縮排前綴）
   * @param vals       - 逐月數值（已含正負號）
   * @param total      - 合計值（已含正負號）
   * @param opts.bold         - label + 月份欄是否粗體
   * @param opts.labelBold    - label 是否單獨粗體（預設同 bold）
   * @param opts.border       - 月份欄 border（預設 bdAll）
   * @param opts.totalBorder  - 合計欄 border（預設 bdTotal）
   */
  function dataRow(
    label:  string,
    vals:   number[],
    total:  number,
    opts: {
      bold?:        boolean;
      labelBold?:   boolean;
      border?:      BorderObj;
      totalBorder?: BorderObj;
    } = {},
  ) {
    const bold = opts.bold ?? false;
    const bd   = opts.border       ?? bdAll;
    const tbd  = opts.totalBorder  ?? bdTotal;
    const cells: Row = [mk(label, { bold: opts.labelBold ?? bold, border: bd })];
    for (const v of vals)  cells.push(mk(v,     { bold, fmt: MONEY_FMT, border: bd }));
    cells.push(             mk(total, { bold: true, fmt: MONEY_FMT, border: tbd }));
    rows.push(cells);
  }

  // ── 組建表格 ────────────────────────────────────────────────────────────────

  // 大標（合併 + 底部 medium 線）
  mergeRow(
    '粵香園 · 股東財務損益報告',
    { bold: true, sz: 14, align: 'center', border: { ...bdAll, bottom: med } },
  );

  // 統計區間（合併）
  mergeRow(
    `統計區間：${periodStr}（共 ${nMonths} 個月）`,
    { italic: true, align: 'center' },
  );

  emptyRow();
  headerRow();

  // ① 營業總收入
  dataRow(
    '營業總收入',
    monthly.map((m) => m.grossRevenue),
    totals.grossRevenue,
    { bold: true, labelBold: true },
  );

  // ② 營業總支出
  dataRow(
    '營業總支出',
    monthly.map((m) => -m.operatingExpenses),
    -totals.operatingExpenses,
    { bold: true, labelBold: true },
  );

  // 五大科目（合計 > 0 才顯示）＋各科目支出項目組成
  const catDefs: { label: string; dataKey: keyof MonthData; reportKey: ReportCategoryKey }[] = [
    { label: '  └ 食材採購', dataKey: 'ingredients',   reportKey: 'ingredients' },
    { label: '  └ 人事成本', dataKey: 'labor',         reportKey: 'labor' },
    { label: '  └ 水電瓦斯', dataKey: 'utilities',     reportKey: 'utilities' },
    { label: '  └ 修繕費用', dataKey: 'repair',        reportKey: 'repair' },
    { label: '  └ 營運雜支', dataKey: 'operatingMisc', reportKey: 'operating_misc' },
  ];

  const { expenses: periodExpenses } = filterByMonths(p.revenues, p.expenses, sorted);
  const periodItemBreakdown = getReportCategoryItemBreakdown(periodExpenses);
  const monthlyItemBreakdown = sorted.map((month) => {
    const { expenses: mExp } = filterByMonths(p.revenues, p.expenses, [month]);
    return getReportCategoryItemBreakdown(mExp);
  });

  for (const cat of catDefs) {
    if (totals[cat.dataKey] <= 0) continue;
    dataRow(
      cat.label,
      monthly.map((m) => -m[cat.dataKey]),
      -totals[cat.dataKey],
    );

    const items = periodItemBreakdown[cat.reportKey] ?? [];
    for (const item of items) {
      const monthlyVals = monthlyItemBreakdown.map((breakdown) => {
        const found = breakdown[cat.reportKey].find((row) => row.label === item.label);
        return found ? -found.amount : 0;
      });
      dataRow(`      · ${item.label}`, monthlyVals, -item.amount);
    }
  }

  // ③ 年終獎金攤提（每月固定 −yearEndMonthly）
  dataRow(
    `預留年終獎金攤提（${p.yearEndMonthly.toLocaleString('zh-TW')}/月）`,
    monthly.map((m) => -m.yearEndBonus),
    -totals.yearEndBonus,
  );

  // ④ 修繕金攤提（每月固定 −repairFundMonthly）
  dataRow(
    `預留修繕金攤提（${p.repairFundMonthly.toLocaleString('zh-TW')}/月）`,
    monthly.map((m) => -m.repairFund),
    -totals.repairFund,
  );

  // ⑤ 稅前淨利（medium 上下雙線）
  dataRow(
    '稅前淨利',
    monthly.map((m) => m.netBeforeTax),
    totals.netBeforeTax,
    { bold: true, labelBold: true, border: bdBoth, totalBorder: bdTotalBoth },
  );

  // ⑥ 利潤分派扣除（各項為 0 則跳過）
  if (totals.taxAmount !== 0) {
    dataRow(
      `  └ 所得稅（${p.taxRate}%）`,
      monthly.map((m) => -m.taxAmount),
      -totals.taxAmount,
    );
  }

  dataRow(
    `  └ 員工紅利（稅後淨利 × ${p.employeeBonusPct}%）`,
    monthly.map((m) => m.employeeBonus),
    totals.employeeBonus,
  );

  if (totals.reservedSurplus !== 0) {
    dataRow(
      `  └ 預留盈餘（${p.reserveRate}%）`,
      monthly.map((m) => -m.reservedSurplus),
      -totals.reservedSurplus,
    );
  }

  // ⑦ 最終可分配盈餘（medium 上下雙線 · 全表核心）
  dataRow(
    '★ 最終可分配盈餘',
    monthly.map((m) => m.finalDistributable),
    totals.finalDistributable,
    { bold: true, labelBold: true, border: bdBoth, totalBorder: bdTotalBoth },
  );

  emptyRow();

  // 頁尾時間戳
  const now = new Date();
  const ts  = `報告產生時間：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tsRow: Row = [mk(ts, { italic: true, sz: 9 })];
  for (let i = 1; i < numCols; i++) tsRow.push(empty());
  merges.push({ s: { r: rows.length, c: 0 }, e: { r: rows.length, c: numCols - 1 } });
  rows.push(tsRow);

  // ── 組建 WorkSheet ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = {};

  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      ws[XLSX.utils.encode_cell({ r, c })] = cell;
    });
  });

  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: numCols - 1 } });
  ws['!merges'] = merges;

  // 欄寬：項目欄 27 · 每月 13 · 合計 15
  ws['!cols'] = [
    { wch: 27 },
    ...sorted.map(() => ({ wch: 13 })),
    { wch: 15 },
  ];

  // 列高：大標 30，其餘 18
  ws['!rows'] = rows.map((_, i) => ({ hpt: i === 0 ? 30 : 18 }));

  // 列印設定（≤6月直向 / >6月橫向，fit-to-page 自動縮放）
  ws['!pageSetup'] = {
    paperSize:   9,
    orientation: nMonths > 6 ? 'landscape' : 'portrait',
    fitToPage:   true,
    fitToWidth:  1,
    fitToHeight: 0,
  };

  ws['!margins'] = {
    left: 0.5, right: 0.5,
    top:  0.75, bottom: 0.75,
    header: 0.3, footer: 0.3,
  };

  // ── 組建 Workbook & 下載 ────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '股東財務損益報告');

  const fileTs = periodStr.replace(/[\s~\/]/g, '-').replace(/-+/g, '-');
  XLSX.writeFile(wb, `粵香園_股東損益報告_${fileTs}.xlsx`);
}
