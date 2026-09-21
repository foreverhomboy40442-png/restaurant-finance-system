/**
 * 股東財務損益報表 — Excel 匯出（單工作表・含真實圖表圖檔）
 *
 * 紙本列印友善：同一張工作表內依序為
 *   標題 → 損益數據表 → 科目組成說明 → 營收折線圖 + 營業總支出甜甜圈圖
 *
 * 圖表以 PNG 嵌入，不上第二個工作表；列印設為 fit 單頁。
 */

import ExcelJS from 'exceljs';
import type { ExpenseItem, RevenueItem } from '../../../types';
import {
  calcPnl,
  filterByMonths,
  getIngredientsSubBreakdown,
  getLaborSubBreakdown,
  getOperatingMiscSubBreakdown,
  getReportCategoryBreakdown,
  INGREDIENTS_SUB_ORDER,
  LABOR_SUB_ORDER,
  OPERATING_MISC_SUB_ORDER,
  monthToLabel,
  sumOperatingExpenses,
  sumRevenues,
  type IngredientsSubKey,
  type LaborSubKey,
  type OperatingMiscSubKey,
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
  repair: number;
  operatingMisc: number;
  ingredientsPayment: number;
  ingredientsCash: number;
  laborPt: number;
  laborFullTime: number;
  miscUtilities: number;
  miscInternet: number;
  miscBusinessTax: number;
  miscRent: number;
  miscSanitation: number;
  miscManagementFee: number;
  miscMarketing: number;
  miscOther: number;
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

/** 損益數據明細：標籤／金額字級（加大利於投影與紙本閱讀） */
const FONT = {
  title: 20,
  section: 18,
  header: 15,
  data: 14,
  dataBold: 15,
  sub: 13,
  defTitle: 14,
  defBody: 12,
  meta: 12,
} as const;

const CHART_CATEGORY_COLORS = {
  ingredients: '#92400E',
  labor: '#7F1D1D',
  operating_misc: '#44403C',
} as const;

const INGREDIENTS_SUB_LABEL: Record<IngredientsSubKey, string> = {
  payment: '貨款',
  cash: '現金支出',
};

const LABOR_SUB_LABEL: Record<LaborSubKey, string> = {
  pt: 'PT',
  full_time: '正職',
};

const MISC_SUB_LABEL: Record<OperatingMiscSubKey, string> = {
  utilities: '水電瓦斯',
  internet: '網路費',
  business_tax: '營業稅',
  rent: '房租',
  sanitation: '環境衛生',
  management_fee: '管理費',
  marketing: '行銷',
  misc: '雜支',
};

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
    size: opts.size ?? FONT.data,
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
  opts: { bold?: boolean; totalCol?: boolean; emphasis?: boolean; size?: number } = {},
) {
  cell.value = value;
  cell.numFmt = MONEY_FMT;
  cell.font = {
    name: 'Arial',
    size: opts.size ?? (opts.bold ? FONT.dataBold : FONT.data),
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

function buildMonthData(
  month: string,
  p: ExportShareholderParams,
): MonthData {
  const { revenues: mRev, expenses: mExp } = filterByMonths(
    p.revenues,
    p.expenses,
    [month],
  );
  const grossRevenue = sumRevenues(mRev);
  const operatingExpenses = sumOperatingExpenses(mExp);
  const cat = getReportCategoryBreakdown(mExp);
  const ing = getIngredientsSubBreakdown(mExp);
  const lab = getLaborSubBreakdown(mExp);
  const misc = getOperatingMiscSubBreakdown(mExp);
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
    repair: cat.repair,
    operatingMisc: cat.operating_misc,
    ingredientsPayment: ing.payment,
    ingredientsCash: ing.cash,
    laborPt: lab.pt,
    laborFullTime: lab.full_time,
    miscUtilities: misc.utilities,
    miscInternet: misc.internet,
    miscBusinessTax: misc.business_tax,
    miscRent: misc.rent,
    miscSanitation: misc.sanitation,
    miscManagementFee: misc.management_fee,
    miscMarketing: misc.marketing,
    miscOther: misc.misc,
    yearEndBonus,
    repairFund,
    netBeforeTax: pnl.netBeforeTax,
    taxAmount: pnl.taxAmount,
    employeeBonus: pnl.employeeBonus,
    reservedSurplus: pnl.reservedSurplus,
    finalDistributable: pnl.finalDistributable,
  };
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

  const monthly: MonthData[] = sorted.map((month) => buildMonthData(month, p));

  const sumKey = (key: keyof MonthData) =>
    monthly.reduce((s, m) => s + m[key], 0);

  const totals = (Object.keys(monthly[0]) as (keyof MonthData)[]).reduce(
    (acc, key) => {
      acc[key] = sumKey(key);
      return acc;
    },
    { ...monthly[0] },
  );

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
      title: '營業總支出（科目比例）',
      segments: expenseSegments,
      totalLabel: '合計',
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = '粵香園財務管理系統';
  const ws = wb.addWorksheet('股東財務損益報告', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: nMonths > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0, // 允許多頁，避免字放大後被壓扁
      horizontalCentered: true,
    },
    properties: { defaultRowHeight: 26 },
  });

  ws.columns = [
    { width: 42 },
    ...sorted.map(() => ({ width: 15 })),
    { width: 17 },
  ];

  // ── 1) 標題區 ─────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = '粵香園 · 股東財務損益報告';
  titleCell.font = {
    name: 'Arial',
    size: FONT.title,
    bold: true,
    color: { argb: BLACK },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = {
    ...thinBorder(),
    bottom: { style: 'medium', color: { argb: MED } },
  } as ExcelJS.Borders;
  ws.getRow(1).height = 36;

  ws.mergeCells(2, 1, 2, numCols);
  const periodCell = ws.getCell(2, 1);
  periodCell.value = `統計區間：${periodStr}（共 ${nMonths} 個月）`;
  periodCell.font = {
    name: 'Arial',
    size: FONT.meta,
    italic: true,
    color: { argb: BLACK },
  };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 24;

  // ── 2) 損益數據表（數據面在上）────────────────────────────────────────────
  let row = 4;

  ws.mergeCells(row, 1, row, numCols);
  const sectionCell = ws.getCell(row, 1);
  sectionCell.value = '損益數據明細';
  sectionCell.font = {
    name: 'Arial',
    size: FONT.section,
    bold: true,
    color: { argb: BLACK },
  };
  sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 30;
  row += 1;

  // 表頭
  const header = ws.getRow(row);
  header.height = 28;
  header.getCell(1).value = '項目';
  sorted.forEach((m, i) => {
    header.getCell(i + 2).value = monthToLabel(m);
  });
  header.getCell(numCols).value = '合計';
  for (let c = 1; c <= numCols; c++) {
    const cell = header.getCell(c);
    cell.font = {
      name: 'Arial',
      size: FONT.header,
      bold: true,
      color: { argb: BLACK },
    };
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
    opts: {
      bold?: boolean;
      emphasis?: boolean;
      size?: number;
      rowHeight?: number;
    } = {},
  ) => {
    const r = ws.getRow(row);
    r.height = opts.rowHeight ?? (opts.emphasis ? 30 : 26);
    const fontSize =
      opts.size ?? (opts.bold || opts.emphasis ? FONT.dataBold : FONT.data);
    const labelCell = r.getCell(1);
    labelCell.value = label;
    styleLabelCell(labelCell, { bold: opts.bold ?? false, size: fontSize });
    if (opts.emphasis) {
      labelCell.border = medVBorder() as ExcelJS.Borders;
    }
    vals.forEach((v, i) => {
      styleMoneyCell(r.getCell(i + 2), v, {
        bold: opts.bold,
        emphasis: opts.emphasis,
        size: fontSize,
      });
    });
    styleMoneyCell(r.getCell(numCols), total, {
      bold: true,
      totalCol: true,
      emphasis: opts.emphasis,
      size: fontSize,
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

  // 大科＋子科
  const majorCats: {
    label: string;
    key: keyof MonthData;
    subs: { label: string; key: keyof MonthData }[];
  }[] = [
    {
      label: '  └ 食材採購',
      key: 'ingredients',
      subs: INGREDIENTS_SUB_ORDER.map((k) => ({
        label: `      · ${INGREDIENTS_SUB_LABEL[k]}`,
        key: (k === 'payment'
          ? 'ingredientsPayment'
          : 'ingredientsCash') as keyof MonthData,
      })),
    },
    {
      label: '  └ 人事成本',
      key: 'labor',
      subs: LABOR_SUB_ORDER.map((k) => ({
        label: `      · ${LABOR_SUB_LABEL[k]}`,
        key: (k === 'pt' ? 'laborPt' : 'laborFullTime') as keyof MonthData,
      })),
    },
    {
      label: '  └ 營運雜支',
      key: 'operatingMisc',
      subs: OPERATING_MISC_SUB_ORDER.map((k) => ({
        label: `      · ${MISC_SUB_LABEL[k]}`,
        key: ({
          utilities: 'miscUtilities',
          internet: 'miscInternet',
          business_tax: 'miscBusinessTax',
          rent: 'miscRent',
          sanitation: 'miscSanitation',
          management_fee: 'miscManagementFee',
          marketing: 'miscMarketing',
          misc: 'miscOther',
        }[k]) as keyof MonthData,
      })),
    },
  ];

  for (const major of majorCats) {
    if (totals[major.key] <= 0) continue;
    writeDataRow(
      major.label,
      monthly.map((m) => -(m[major.key] as number)),
      -(totals[major.key] as number),
      { bold: true, size: FONT.data },
    );
    for (const sub of major.subs) {
      if (totals[sub.key] <= 0) continue;
      writeDataRow(
        sub.label,
        monthly.map((m) => -(m[sub.key] as number)),
        -(totals[sub.key] as number),
        { size: FONT.sub },
      );
    }
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
  // 修繕實支僅作基金動支紀錄，不計入損益
  if (totals.repair > 0) {
    writeDataRow(
      '修繕金動支（紀錄／不計損益）',
      monthly.map((m) => m.repair),
      totals.repair,
    );
  }
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
      { size: FONT.sub },
    );
  }
  writeDataRow(
    `  └ 員工紅利（稅後淨利 × ${p.employeeBonusPct}%）`,
    monthly.map((m) => m.employeeBonus),
    totals.employeeBonus,
    { size: FONT.sub },
  );
  if (totals.reservedSurplus !== 0) {
    writeDataRow(
      `  └ 預留盈餘（${p.reserveRate}%）`,
      monthly.map((m) => -m.reservedSurplus),
      -totals.reservedSurplus,
      { size: FONT.sub },
    );
  }
  writeDataRow(
    '★ 最終可分配盈餘',
    monthly.map((m) => m.finalDistributable),
    totals.finalDistributable,
    { bold: true, emphasis: true, size: 16, rowHeight: 32 },
  );

  row += 1;

  // 科目組成說明
  ws.mergeCells(row, 1, row, numCols);
  const defTitle = ws.getCell(row, 1);
  defTitle.value = '科目組成說明（定義）';
  styleLabelCell(defTitle, { bold: true, size: FONT.defTitle });
  ws.getRow(row).height = 24;
  row += 1;

  const compositionLines = [
    '食材採購：月結貨款與現金支出（子科：貨款／現金支出）',
    '人事成本：PT 與正職薪資（子科：PT／正職）',
    '營運雜支：水電瓦斯、網路費、營業稅、房租、環境衛生、管理費、行銷及其他雜支',
    '修繕金預扣：每月預留修繕金（計入損益）',
    '修繕金動支：實際修繕支出僅紀錄、不重複計入月損益',
  ];
  for (const line of compositionLines) {
    ws.mergeCells(row, 1, row, numCols);
    const cell = ws.getCell(row, 1);
    cell.value = line;
    styleLabelCell(cell, { italic: true, size: FONT.defBody });
    ws.getRow(row).height = 20;
    row += 1;
  }

  row += 1;

  // ── 3) 圖表面（數據下方：營收折線 + 營業總支出甜甜圈，同表並排）──────────
  ws.mergeCells(row, 1, row, numCols);
  const chartSection = ws.getCell(row, 1);
  chartSection.value = '視覺化圖表（營收折線圖／營業總支出甜甜圈圖）';
  chartSection.font = {
    name: 'Arial',
    size: FONT.section,
    bold: true,
    color: { argb: BLACK },
  };
  chartSection.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 26;
  row += 1;

  // 預留並排圖表高度，避免另開工作表
  const chartAnchorRow0 = row - 1; // 0-based for ExcelJS tl.row
  const chartBlockRows = 14;
  for (let i = 0; i < chartBlockRows; i++) {
    ws.getRow(row + i).height = 14;
  }
  row += chartBlockRows;

  const lineImgId = wb.addImage({
    base64: uint8ToBase64(linePng),
    extension: 'png',
  });
  const donutImgId = wb.addImage({
    base64: uint8ToBase64(donutPng),
    extension: 'png',
  });

  // 左：營收折線圖；右：營業總支出甜甜圈圖（同一張工作表）
  ws.addImage(lineImgId, {
    tl: { col: 0, row: chartAnchorRow0 },
    ext: { width: 430, height: 215 },
    editAs: 'oneCell',
  });
  ws.addImage(donutImgId, {
    tl: { col: Math.min(5, Math.max(3, numCols - 1)), row: chartAnchorRow0 },
    ext: { width: 340, height: 195 },
    editAs: 'oneCell',
  });

  row += 1;
  ws.mergeCells(row, 1, row, numCols);
  const now = new Date();
  const ts = `報告產生時間：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tsCell = ws.getCell(row, 1);
  tsCell.value = ts;
  styleLabelCell(tsCell, { italic: true, size: 10 });

  // 保險：只保留單一工作表
  while (wb.worksheets.length > 1) {
    wb.removeWorksheet(wb.worksheets[wb.worksheets.length - 1].id);
  }

  const fileTs = periodStr.replace(/[\s~/]/g, '-').replace(/-+/g, '-');
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, `粵香園_股東損益報告_${fileTs}.xlsx`);
}
