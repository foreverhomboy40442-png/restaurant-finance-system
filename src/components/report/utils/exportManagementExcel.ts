/**
 * 營運綜合分析 — Excel 細項匯出（月欄 × 大科／子科）
 *
 * 供老闆查看細項：食材（貨款／現金）、人事（PT／正職）、
 * 營運支出（水電瓦斯、營業稅、房租…）。不含股東分配線。
 */

import ExcelJS from 'exceljs';
import type { ExpenseItem, RevenueItem } from '../../../types';
import {
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

export interface ExportManagementParams {
  /** YYYY-MM 列表（已排序） */
  months: string[];
  revenues: RevenueItem[];
  expenses: ExpenseItem[];
  /** 顯示用區間文字，如 2026/05/01 - 2026/08/31 */
  periodLabel: string;
}

interface MonthDetail {
  grossRevenue: number;
  operatingExpenses: number;
  ingredients: number;
  labor: number;
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
}

const MONEY_FMT = '"$"#,##0;\\-"$"#,##0';
const THIN = 'FFC8C8C8';
const MED = 'FF1A1A1A';
const BLACK = 'FF000000';
const HDR = 'FFEBEBEB';
const WHITE = 'FFFFFFFF';

const FONT = {
  title: 18,
  section: 16,
  header: 14,
  data: 13,
  dataBold: 14,
  sub: 12,
  meta: 11,
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

function totalLeftBorder(): Partial<ExcelJS.Borders> {
  const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: THIN } };
  const med: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: MED } };
  return { top: thin, bottom: thin, left: med, right: thin };
}

function styleLabelCell(
  cell: ExcelJS.Cell,
  opts: { bold?: boolean; italic?: boolean; size?: number } = {},
) {
  cell.font = {
    name: 'Arial',
    size: opts.size ?? FONT.data,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: BLACK },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  cell.border = thinBorder() as ExcelJS.Borders;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
}

function styleMoneyCell(
  cell: ExcelJS.Cell,
  value: number,
  opts: { bold?: boolean; totalCol?: boolean; size?: number } = {},
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
    opts.totalCol ? totalLeftBorder() : thinBorder()
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

function buildMonthDetail(
  month: string,
  revenues: RevenueItem[],
  expenses: ExpenseItem[],
): MonthDetail {
  const { revenues: mRev, expenses: mExp } = filterByMonths(
    revenues,
    expenses,
    [month],
  );
  const cat = getReportCategoryBreakdown(mExp);
  const ing = getIngredientsSubBreakdown(mExp);
  const lab = getLaborSubBreakdown(mExp);
  const misc = getOperatingMiscSubBreakdown(mExp);
  return {
    grossRevenue: sumRevenues(mRev),
    operatingExpenses: sumOperatingExpenses(mExp),
    ingredients: cat.ingredients,
    labor: cat.labor,
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
  };
}

export async function exportManagementExcel(
  p: ExportManagementParams,
): Promise<void> {
  const sorted = [...p.months].sort();
  const nMonths = sorted.length;
  if (nMonths === 0) return;

  const numCols = nMonths + 2;
  const monthly = sorted.map((month) =>
    buildMonthDetail(month, p.revenues, p.expenses),
  );
  const sumKey = (key: keyof MonthDetail) =>
    monthly.reduce((s, m) => s + m[key], 0);
  const totals = (Object.keys(monthly[0]) as (keyof MonthDetail)[]).reduce(
    (acc, key) => {
      acc[key] = sumKey(key);
      return acc;
    },
    { ...monthly[0] },
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = '粵香園財務管理系統';
  const ws = wb.addWorksheet('營運綜合分析明細', {
    pageSetup: {
      paperSize: 9,
      orientation: nMonths > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
    },
    properties: { defaultRowHeight: 24 },
  });

  ws.columns = [
    { width: 36 },
    ...sorted.map(() => ({ width: 14 })),
    { width: 16 },
  ];

  // 標題
  ws.mergeCells(1, 1, 1, numCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = '粵香園 · 營運綜合分析明細';
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
  ws.getRow(1).height = 32;

  ws.mergeCells(2, 1, 2, numCols);
  const periodCell = ws.getCell(2, 1);
  periodCell.value = `統計區間：${p.periodLabel}（共 ${nMonths} 個月・含細項）`;
  periodCell.font = {
    name: 'Arial',
    size: FONT.meta,
    italic: true,
    color: { argb: BLACK },
  };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  let row = 4;
  ws.mergeCells(row, 1, row, numCols);
  const sectionCell = ws.getCell(row, 1);
  sectionCell.value = '損益／支出細項明細';
  sectionCell.font = {
    name: 'Arial',
    size: FONT.section,
    bold: true,
    color: { argb: BLACK },
  };
  sectionCell.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(row).height = 26;
  row += 1;

  // 表頭
  const header = ws.getRow(row);
  header.height = 26;
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
    opts: { bold?: boolean; size?: number; rowHeight?: number } = {},
  ) => {
    const r = ws.getRow(row);
    r.height = opts.rowHeight ?? 24;
    const fontSize =
      opts.size ?? (opts.bold ? FONT.dataBold : FONT.data);
    const labelCell = r.getCell(1);
    labelCell.value = label;
    styleLabelCell(labelCell, { bold: opts.bold ?? false, size: fontSize });
    vals.forEach((v, i) => {
      styleMoneyCell(r.getCell(i + 2), v, {
        bold: opts.bold,
        size: fontSize,
      });
    });
    styleMoneyCell(r.getCell(numCols), total, {
      bold: true,
      totalCol: true,
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

  const majorCats: {
    label: string;
    key: keyof MonthDetail;
    subs: { label: string; key: keyof MonthDetail }[];
  }[] = [
    {
      label: '  └ 食材採購',
      key: 'ingredients',
      subs: INGREDIENTS_SUB_ORDER.map((k) => ({
        label: `      · ${INGREDIENTS_SUB_LABEL[k]}`,
        key: (k === 'payment'
          ? 'ingredientsPayment'
          : 'ingredientsCash') as keyof MonthDetail,
      })),
    },
    {
      label: '  └ 人事成本',
      key: 'labor',
      subs: LABOR_SUB_ORDER.map((k) => ({
        label: `      · ${LABOR_SUB_LABEL[k]}`,
        key: (k === 'pt' ? 'laborPt' : 'laborFullTime') as keyof MonthDetail,
      })),
    },
    {
      label: '  └ 營運支出',
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
        }[k]) as keyof MonthDetail,
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
      // 細項：即使單月為 0，只要合計 > 0 就列出（方便對帳）
      if (totals[sub.key] <= 0) continue;
      writeDataRow(
        sub.label,
        monthly.map((m) => -(m[sub.key] as number)),
        -(totals[sub.key] as number),
        { size: FONT.sub },
      );
    }
  }

  row += 1;
  ws.mergeCells(row, 1, row, numCols);
  const noteCell = ws.getCell(row, 1);
  noteCell.value =
    '說明：本表含支出細項，供營運對帳；股東損益分配請使用「股東報表」匯出。營業稅依入帳日期歸屬。';
  styleLabelCell(noteCell, { italic: true, size: FONT.meta });

  row += 2;
  ws.mergeCells(row, 1, row, numCols);
  const now = new Date();
  const ts = `報告產生時間：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const tsCell = ws.getCell(row, 1);
  tsCell.value = ts;
  styleLabelCell(tsCell, { italic: true, size: 10 });

  const fileTs = p.periodLabel.replace(/[\s~/]/g, '-').replace(/-+/g, '-');
  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(buffer, `粵香園_營運綜合分析明細_${fileTs}.xlsx`);
}
