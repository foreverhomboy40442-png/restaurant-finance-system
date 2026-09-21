/**
 * 驗證股東 Excel「損益數據明細」結構與字級（不依賴瀏覽器／圖表）。
 * 用法：npx --yes tsx scripts/verify-shareholder-excel-structure.ts
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { createFinancialDate, createMoney } from '../src/types/core';
import type { ExpenseItem, RevenueItem } from '../src/types';
import {
  filterByMonths,
  getIngredientsSubBreakdown,
  getLaborSubBreakdown,
  getOperatingMiscSubBreakdown,
  getReportCategoryBreakdown,
  sumOperatingExpenses,
  sumRevenues,
} from '../src/components/report/utils/reportCalc';

const OUT = '/opt/cursor/artifacts';
mkdirSync(OUT, { recursive: true });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

const revenues: RevenueItem[] = [
  {
    id: 'r1',
    date: createFinancialDate('2025-05-15'),
    period: 'all_day',
    amount: createMoney(1_200_000),
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-15T00:00:00Z',
  },
];

const expenses: ExpenseItem[] = [
  {
    id: 'e1',
    date: createFinancialDate('2025-05-10'),
    category: 'ingredients',
    amount: createMoney(200_000),
    merchant: '阿隆蔬菜',
    operatorId: 'test',
    auditStatus: 'audited',
    note: '支付貨款',
    createdAt: '2025-05-10T00:00:00Z',
  },
  {
    id: 'e2',
    date: createFinancialDate('2025-05-11'),
    category: 'ingredients',
    amount: createMoney(30_000),
    merchant: '市場現金',
    operatorId: 'test',
    auditStatus: 'audited',
    note: '現金採購',
    createdAt: '2025-05-11T00:00:00Z',
  },
  {
    id: 'e3',
    date: createFinancialDate('2025-05-12'),
    category: 'labor',
    amount: createMoney(80_000),
    merchant: 'PT',
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-12T00:00:00Z',
  },
  {
    id: 'e4',
    date: createFinancialDate('2025-05-13'),
    category: 'fixed_salary',
    amount: createMoney(120_000),
    merchant: '正職',
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-13T00:00:00Z',
  },
  {
    id: 'e5',
    date: createFinancialDate('2025-05-14'),
    category: 'utilities',
    amount: createMoney(25_000),
    merchant: '台電',
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-14T00:00:00Z',
  },
  {
    id: 'e6',
    date: createFinancialDate('2025-05-15'),
    category: 'rent',
    amount: createMoney(40_000),
    merchant: '房租',
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-15T00:00:00Z',
  },
  {
    id: 'e7',
    date: createFinancialDate('2025-05-16'),
    category: 'repair',
    amount: createMoney(15_000),
    merchant: '修繕',
    operatorId: 'test',
    auditStatus: 'audited',
    createdAt: '2025-05-16T00:00:00Z',
  },
];

async function main() {
  const { expenses: mExp, revenues: mRev } = filterByMonths(
    revenues,
    expenses,
    ['2025-05'],
  );
  const cat = getReportCategoryBreakdown(mExp);
  const ing = getIngredientsSubBreakdown(mExp);
  const lab = getLaborSubBreakdown(mExp);
  const misc = getOperatingMiscSubBreakdown(mExp);
  const opex = sumOperatingExpenses(mExp);
  const rev = sumRevenues(mRev);

  assert(cat.utilities === 0, 'utilities major must be 0 (merged into misc)');
  assert(cat.operating_misc === 25_000 + 40_000, 'misc = utilities + rent');
  assert(cat.repair === 15_000, 'repair tracked separately');
  assert(opex === 200_000 + 30_000 + 80_000 + 120_000 + 25_000 + 40_000, 'opex excludes repair');
  assert(ing.payment === 200_000 && ing.cash === 30_000, 'ingredients subs');
  assert(lab.pt === 80_000 && lab.full_time === 120_000, 'labor subs');
  assert(misc.utilities === 25_000 && misc.rent === 40_000, 'misc subs');

  // 從來源確認 FONT 常數
  const src = readFileSync(
    'src/components/report/utils/exportShareholderExcel.ts',
    'utf8',
  );
  assert(/title:\s*20/.test(src), 'FONT.title=20');
  assert(/section:\s*18/.test(src), 'FONT.section=18');
  assert(/data:\s*14/.test(src), 'FONT.data=14');
  assert(/sub:\s*13/.test(src), 'FONT.sub=13');
  assert(src.includes("label: '  └ 食材採購'"), 'excel major ingredients');
  assert(src.includes("label: '  └ 人事成本'"), 'excel major labor');
  assert(src.includes("label: '  └ 營運雜支'"), 'excel major misc');
  assert(src.includes("utilities: '水電瓦斯'"), 'utilities as misc sub label');
  assert(src.includes('修繕金動支（紀錄／不計損益）'), 'repair draw row');
  assert(!src.includes("label: '  └ 水電瓦斯'"), 'no utilities major row');

  const FONT = { title: 20, section: 18, header: 15, data: 14, sub: 13 } as const;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('股東財務損益報告');
  ws.getCell('A1').value = '粵香園 · 股東財務損益報告';
  ws.getCell('A1').font = { size: FONT.title, bold: true };
  ws.getCell('A4').value = '損益數據明細';
  ws.getCell('A4').font = { size: FONT.section, bold: true };

  const rows: { label: string; value: number; size: number; bold?: boolean }[] = [
    { label: '營業總收入', value: rev, size: FONT.data, bold: true },
    { label: '營業總支出', value: -opex, size: FONT.data, bold: true },
    { label: '  └ 食材採購', value: -cat.ingredients, size: FONT.data, bold: true },
    { label: '      · 貨款', value: -ing.payment, size: FONT.sub },
    { label: '      · 現金支出', value: -ing.cash, size: FONT.sub },
    { label: '  └ 人事成本', value: -cat.labor, size: FONT.data, bold: true },
    { label: '      · PT', value: -lab.pt, size: FONT.sub },
    { label: '      · 正職', value: -lab.full_time, size: FONT.sub },
    { label: '  └ 營運雜支', value: -cat.operating_misc, size: FONT.data, bold: true },
    { label: '      · 水電瓦斯', value: -misc.utilities, size: FONT.sub },
    { label: '      · 房租', value: -misc.rent, size: FONT.sub },
    { label: '修繕金動支（紀錄／不計損益）', value: cat.repair, size: FONT.data },
  ];

  rows.forEach((r, i) => {
    const row = 6 + i;
    ws.getCell(row, 1).value = r.label;
    ws.getCell(row, 1).font = { size: r.size, bold: r.bold ?? false };
    ws.getCell(row, 2).value = r.value;
    ws.getCell(row, 2).font = { size: r.size, bold: r.bold ?? false };
    ws.getCell(row, 2).numFmt = '"$"#,##0';
  });

  const outPath = join(OUT, 'shareholder-pnl-structure-sample.xlsx');
  await wb.xlsx.writeFile(outPath);

  const summary = {
    outPath,
    fonts: FONT,
    breakdown: { cat, ing, lab, misc, opex, rev },
    labels: rows.map((r) => r.label),
  };
  writeFileSync(join(OUT, 'shareholder-excel-verify.json'), JSON.stringify(summary, null, 2));
  console.log('VERIFY OK');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
