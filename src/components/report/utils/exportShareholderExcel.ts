/**
 * 股東財務損益報表 — Excel 匯出（單工作表・含真實圖表圖檔）
 *
 * 紙本列印友善：同一張工作表內依序為
 *   標題 → 營收折線圖 → 支出甜甜圈圖 → 損益數據表 → 科目組成說明
 *
 * 圖表以 PNG 嵌入（折線圖／甜甜圈圖），非另開工作表。
 */

import ExcelJS from 'exceljs';
import type { ExpenseItem, RevenueItem } from '../../../types';
import {
  calcPnl,
  filterByMonths,
  getReportCategoryBreakdown,
  monthToLabel,
  sumExpenses,
  sumRevenues,
} from './reportCalc';
import { renderShareholderChartPngs } from './exportShareholderCharts';

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

interface MonthData {
  grossRevenue: number;
  operatingExpenses: number;
  ingredients: number;
  labor: number;
  utilities: number;
  repair: number;
  operatingMisc: number;
  yearEndBonus: number;
  repairFund: number;
  netBeforeTax: number;
  taxAmount: number;
  employeeBonus: number;
  reservedSurplus: number;
  finalDistributable: number;
}

const MONEY_FMT = '"$"#,##0;\\-"$"#,##0';
const THIN = 'FFC8C8C8';
const MED = 'FF1A1A1A';
const BLACK = 'FF000000';
const HDR = 'FFEBEBEB';
const WHITE = 'FFFFFFFF';

const CHART_CATEGORY_COLORS = {
  ingredients: '#92400E',
  labor: '#7F1D1D',
  utilities: '#14532D',
  repair: '#9A3412',
  operating_misc: '#44403C',
} as const;

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: THIN } };
  return { top: side, bottom: side, left: side, right: side };
}

function medVBorder(): Partial<ExcelJS.Borders> {
  const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: THIN } };
  const med: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: MED } };
  return { top: med, bottom: med, left: thin, right: thin };
}

function medVBorderTotal(): Partial<ExcelJS.Borders> {
  const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: THIN } };
  const med: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: MED } };
  return { top: med, bottom: med, left: med, right: thin };
}

function totalLeftBorder(): Partial<ExcelJS.Borders> {
  const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: THIN } };
  const med: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: MED } };
  return { top: thin, bottom: thin, left: med, right: thin };
}

function styleLabelCell(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; italic?: boolean; size?: number; center?: boolean } = {},
) {
  cell.font = {
    name: 'Arial',
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: BLACK },
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: opts.center ? 'center' : 'left',
  };
  cell.border = thinBorder() as ExcelJS.Borders;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
}

function styleMoneyCell(
  cell: ExcelJS.Cell,
  value: number,
  opts: { bold?: boolean; totalCol?: boolean; emphasis?: boolean } = {},
) {
  cell.value = value;
  cell.numFmt = MONEY_FMT;
  cell.font = {
    name: 'Arial',
    size: 11,
    bold: opts.bold ?? false,
    color: { argb: BLACK },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'right' };
  cell.border = (
    opts.emphasis
      ? opts.totalCol
        ? medVBorderTotal()
        : medVBorder()
      : opts.totalCol
        ? totalLeftBorder()
        : thinBorder()
  ) as ExcelJS.Borders;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function exportShareholderExcel(
  p: ExportShareholderParams,
): Promise<void> {
  const sorted = [...p.selectedMonths].sort();
  const nMonths = sorted.length;
  if (nMonths === 0) return;

  const numCols = nMonths + 2;
  const periodStr =
    nMonths === 1
      ? monthToLabel(sorted[0])
      : `${monthToLabel(sorted[0])} ~ ${monthToLabel(sorted[nMonths - 1])}`;

  const monthly: MonthData[] = sorted.map((month) => {
    const { revenues: mRev, expenses: mExp } = filterByMonths(
      p.revenues,
      p.expenses,
      [month],
    );
    const grossRevenue = sumRevenues(mRev);
    const operatingExpenses = sumExpenses(mExp);
    const cat = getReportCategoryBreakdown(mExp);
    const yearEndBonus = p.yearEndMonthly;
    const repairFund = p.repairFundMonthly;
    const pnl = calcPnl({
      grossRevenue,
      operatingExpenses,
      yearEndBonus,
      repairFund,
      taxRate: p.taxRate,
      employeeBonusPct: p.employeeBonusPct,
      reserveRate: p.reserveRate,
    });

    return {
      grossRevenue,
      operatingExpenses,
      ingredients: cat.ingredients,
      labor: cat.labor,
      utilities: cat.utilities,
      repair: cat.repair,
      operatingMisc: cat.operating_misc,
      yearEndBonus,
      repairFund,
      netBeforeTax: pnl.netBeforeTax,
      taxAmount: pnl.taxAmount,
      employeeBonus: pnl.employeeBonus,
      reservedSurplus: pnl.reservedSurplus,
      finalDistributable: pnl.finalDistributable,
    };
  });

  const sumKey = (key: keyof MonthData) =>
    monthly.reduce((s, m) => s + m[key], 0);

  const totals: MonthData = {
    grossRevenue: sumKey('grossRevenue'),
    operatingExpenses: sumKey('operatingExpenses'),
    ingredients: sumKey('ingredients'),
    labor: sumKey('labor'),
    utilities: sumKey('utilities'),
    repair: sumKey('repair'),
    operatingMisc: sumKey('operatingMisc'),
    yearEndBonus: sumKey('yearEndBonus'),
    repairFund: sumKey('repairFund'),
    netBeforeTax: sumKey('netBeforeTax'),
    taxAmount: sumKey('taxAmount'),
    employeeBonus: sumKey('employeeBonus'),
    reservedSurplus: sumKey('reservedSurplus'),
    finalDistributable: sumKey('finalDistributable'),
  };

  // ── 產生真實折線圖／甜甜圈圖 PNG ──────────────────────────────────────────
  const revenueValues = monthly.map((m) => m.grossRevenue);
  const expenseSegments = [
    {
      label: '食材採購',
      value: totals.ingredients,
      color: CHART_CATEGORY_COLORS.ingredients,
    },
    {
      label: '人事成本',
      value: totals.labor,
      color: CHART_CATEGORY_COLORS.labor,
    },
    {
      label: '水電瓦斯',
      value: totals.utilities,
      color: CHART_CATEGORY_COLORS.utilities,
    },
    {
      label: '修繕費用',
      value: totals.repair,
      color: CHART_CATEGORY_COLORS.repair,
    },
    {
      label: '營運雜支',
      value: totals.operatingMisc,
      color: CHART_CATEGORY_COLORS.operating_misc,
    },
  ].filter((s) => s.value > 0);

  const { linePng, donutPng } = await renderShareholderChartPngs({
    line: {
      title: '營收成長趨勢',
      xLabels: sorted.map((m) => {
        const mm = parseInt(m.split('-')[1], 10);
        return `${mm}月`;
      }),
      values: revenueValues,
      seriesLabel: '營業總收入',
      yUnit: '元',
    },
    donut: {
      title: '支出結構比例（五大科目）',
      segments: expenseSegments,
      totalLabel: '合計',
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = '粵香園財務管理系統';
  const ws = wb.addWorksheet('股東財務損益報告', {
    pageSetup: {
      paperSize: 9,
      orientation: nMonths > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
    properties: { defaultRowHeight: 18 },
  });

  ws.columns = [
    { width: 34 },
    ...sorted.map(() => ({ width: 13 })),
    { width: 15 },
  ];

  // ── 標題區 ────────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = '粵香園 · 股東財務損益報告';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: BLACK } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = {
    ...thinBorder(),
    bottom: { style: 'medium', color: { argb: MED } },
  } as ExcelJS.Borders;
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, numCols);
  const periodCell = ws.getCell(2, 1);
  periodCell.value = `統計區間：${periodStr}（共 ${nMonths} 個月）`;
  periodCell.font = {
    name: 'Arial',
    size: 11,
    italic: true,
    color: { argb: BLACK },
  };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 預留圖表空間（同一張表、便於紙本列印）
  // row 4 起放折線圖；其下再放甜甜圈圖
  const LINE_IMG_ROW = 3; // 0-based for addImage tl.row
  const DONUT_IMG_ROW = 16;
  const TABLE_START_ROW = 30; // 1-based Excel row for P&L header area

  for (let r = 3; r < TABLE_START_ROW; r++) {
    ws.getRow(r).height = 15;
  }

  const lineImgId = wb.addImage({
    base64: uint8ToBase64(linePng),
    extension: 'png',
  });
  const donutImgId = wb.addImage({
    base64: uint8ToBase64(donutPng),
    extension: 'png',
  });

  ws.addImage(lineImgId, {
    tl: { col: 0, row: LINE_IMG_ROW },
    ext: { width: 520, height: 260 },
    editAs: 'oneCell',
  });
  ws.addImage(donutImgId, {
    tl: { col: 0, row: DONUT_IMG_ROW },
    ext: { width: 480, height: 300 },
    editAs: 'oneCell',
  });

  // ── 損益數據表 ────────────────────────────────────────────────────────────
  let row = TABLE_START_ROW;

  // 小標
  ws.mergeCells(row, 1, row, numCols);
  const sectionCell = ws.getCell(row, 1);
  sectionCell.value = '損益數據明細';
  sectionCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: BLACK } };
  sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 22;
  row += 1;

  // 表頭
  const header = ws.getRow(row);
  header.getCell(1).value = '項目';
  sorted.forEach((m, i) => {
    header.getCell(i + 2).value = monthToLabel(m);
  });
  header.getCell(numCols).value = '合計';
  for (let c = 1; c <= numCols; c++) {
    const cell = header.getCell(c);
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: BLACK } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR } };
    cell.alignment = {
      horizontal: c === 1 ? 'left' : 'center',
      vertical: 'middle',
    };
    cell.border = {
      ...thinBorder(),
      bottom: { style: 'medium', color: { argb: MED } },
    } as ExcelJS.Borders;
  }
  row += 1;

  const writeDataRow = (
    label: string,
    vals: number[],
    total: number,
    opts: { bold?: boolean; emphasis?: boolean } = {},
  ) => {
    const r = ws.getRow(row);
    const labelCell = r.getCell(1);
    labelCell.value = label;
    styleLabelCell(labelCell, { bold: opts.bold ?? false });
    if (opts.emphasis) {
      labelCell.border = medVBorder() as ExcelJS.Borders;
    }
    vals.forEach((v, i) => {
      styleMoneyCell(r.getCell(i + 2), v, {
        bold: opts.bold,
        emphasis: opts.emphasis,
      });
    });
    styleMoneyCell(r.getCell(numCols), total, {
      bold: true,
      totalCol: true,
      emphasis: opts.emphasis,
    });
    row += 1;
  };

  writeDataRow(
    '營業總收入',
    monthly.map((m) => m.grossRevenue),
    totals.grossRevenue,
    { bold: true },
  );
  writeDataRow(
    '營業總支出',
    monthly.map((m) => -m.operatingExpenses),
    -totals.operatingExpenses,
    { bold: true },
  );

  const catDefs: [string, keyof MonthData][] = [
    ['  └ 食材採購', 'ingredients'],
    ['  └ 人事成本', 'labor'],
    ['  └ 水電瓦斯', 'utilities'],
    ['  └ 修繕費用', 'repair'],
    ['  └ 營運雜支', 'operatingMisc'],
  ];
  for (const [label, key] of catDefs) {
    if (totals[key] <= 0) continue;
    writeDataRow(
      label,
      monthly.map((m) => -(m[key] as number)),
      -(totals[key] as number),
    );
  }

  writeDataRow(
    `預留年終獎金攤提（${p.yearEndMonthly.toLocaleString('zh-TW')}/月）`,
    monthly.map((m) => -m.yearEndBonus),
    -totals.yearEndBonus,
  );
  writeDataRow(
    `預留修繕金攤提（${p.repairFundMonthly.toLocaleString('zh-TW')}/月）`,
    monthly.map((m) => -m.repairFund),
    -totals.repairFund,
  );
  writeDataRow(
    '稅前淨利',
    monthly.map((m) => m.netBeforeTax),
    totals.netBeforeTax,
    { bold: true, emphasis: true },
  );

  if (totals.taxAmount !== 0) {
    writeDataRow(
      `  └ 所得稅（${p.taxRate}%）`,
      monthly.map((m) => -m.taxAmount),
      -totals.taxAmount,
    );
  }
  writeDataRow(
    `  └ 員工紅利（稅後淨利 × ${p.employeeBonusPct}%）`,
    monthly.map((m) => m.employeeBonus),
    totals.employeeBonus,
  );
  if (totals.reservedSurplus !== 0) {
    writeDataRow(
      `  └ 預留盈餘（${p.reserveRate}%）`,
      monthly.map((m) => -m.reservedSurplus),
      -totals.reservedSurplus,
    );
  }
  writeDataRow(
    '★ 最終可分配盈餘',
    monthly.map((m) => m.finalDistributable),
    totals.finalDistributable,
    { bold: true, emphasis: true },
  );

  row += 1;

  // 科目組成說明
  ws.mergeCells(row, 1, row, numCols);
  const defTitle = ws.getCell(row, 1);
  defTitle.value = '科目組成說明（定義）';
  styleLabelCell(defTitle, { bold: true, size: 11 });
  row += 1;

  const compositionLines = [
    '食材採購：食材、乾貨、酒水與食材貨款',
    '人事成本：PT 薪資、正職薪資',
    '水電瓦斯：電費、瓦斯、水費',
    '修繕費用：裝潢、整/維修、設備維護',
    '營運雜支：房租、雜貨、檯布、行銷及其他雜支',
  ];
  for (const line of compositionLines) {
    ws.mergeCells(row, 1, row, numCols);
    const cell = ws.getCell(row, 1);
    cell.value = line;
    styleLabelCell(cell, { italic: true, size: 10 });
    row += 1;
  }

  row += 1;
  ws.mergeCells(row, 1, row, numCols);
  const now = new Date();
  const ts = `報告產生時間：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tsCell = ws.getCell(row, 1);
  tsCell.value = ts;
  styleLabelCell(tsCell, { italic: true, size: 9 });

  const fileTs = periodStr.replace(/[\s~/]/g, '-').replace(/-+/g, '-');
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, `粵香園_股東損益報告_${fileTs}.xlsx`);
}
