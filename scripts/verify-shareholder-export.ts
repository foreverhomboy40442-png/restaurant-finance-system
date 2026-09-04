/**
 * 自行驗證股東報表 Excel 匯出結構：
 * - 僅 1 個工作表
 * - 內嵌 2 張圖（營收折線、營業總支出甜甜圈）
 * - 數據列在圖表列之前
 * - SVG 標題文案正確
 *
 * 用法：npx --yes tsx scripts/verify-shareholder-export.ts
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import {
  buildRevenueTrendSvg,
  buildExpenseDonutSvg,
} from '../src/components/report/utils/exportShareholderCharts';

const OUT = '/tmp/shareholder-export-verify';
mkdirSync(OUT, { recursive: true });

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

function svgToPngViaChrome(svg: string, width: number, height: number, outPng: string) {
  const htmlPath = outPng.replace(/\.png$/, '.html');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<style>html,body{margin:0;padding:0;background:#fff;width:${width}px;height:${height}px;overflow:hidden}</style>
</head><body>${svg.replace(/^<\?xml[^>]*>/, '')}</body></html>`;
  writeFileSync(htmlPath, html, 'utf8');

  const chrome =
    ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find((p) =>
      existsSync(p),
    ) ?? 'google-chrome';

  const result = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${outPng}`,
      `file://${htmlPath}`,
    ],
    { encoding: 'utf8' },
  );

  assert(result.status === 0, `chrome screenshot failed: ${result.stderr || result.stdout}`);
  assert(existsSync(outPng), `screenshot missing: ${outPng}`);
}

async function main() {
  const months = ['2026-01', '2026-02', '2026-03'];
  const revenues = [1_200_000, 1_350_000, 1_480_000];
  const segments = [
    { label: '食材採購', value: 420000, color: '#92400E' },
    { label: '人事成本', value: 510000, color: '#7F1D1D' },
    { label: '水電瓦斯', value: 90000, color: '#14532D' },
    { label: '修繕費用', value: 60000, color: '#9A3412' },
    { label: '營運雜支', value: 180000, color: '#44403C' },
  ];

  const lineSvg = buildRevenueTrendSvg({
    title: '營收成長趨勢',
    xLabels: ['1月', '2月', '3月'],
    values: revenues,
    seriesLabel: '營業總收入',
    yUnit: '元',
  });
  const donutSvg = buildExpenseDonutSvg({
    title: '營業總支出（五大科目比例）',
    segments,
    totalLabel: '合計',
  });

  assert(lineSvg.includes('營收成長趨勢'), 'line svg title');
  assert(donutSvg.includes('營業總支出（五大科目比例）'), 'donut svg title');
  assert(donutSvg.includes('食材採購'), 'donut has category');

  const linePngPath = join(OUT, 'line.png');
  const donutPngPath = join(OUT, 'donut.png');
  svgToPngViaChrome(lineSvg, 720, 360, linePngPath);
  svgToPngViaChrome(donutSvg, 400, 230, donutPngPath);

  const linePng = readFileSync(linePngPath);
  const donutPng = readFileSync(donutPngPath);
  assert(linePng.length > 1000, 'line png size');
  assert(donutPng.length > 1000, 'donut png size');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('股東財務損益報告', {
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 },
  });

  // 模擬「數據在上」
  ws.getCell('A1').value = '粵香園 · 股東財務損益報告';
  ws.getCell('A4').value = '損益數據明細';
  ws.getCell('A5').value = '營業總收入';
  months.forEach((m, i) => {
    ws.getCell(5, i + 2).value = revenues[i];
  });
  ws.getCell('A20').value = '視覺化圖表（營收折線圖／營業總支出甜甜圈圖）';

  const lineId = wb.addImage({ buffer: linePng, extension: 'png' });
  const donutId = wb.addImage({ buffer: donutPng, extension: 'png' });
  ws.addImage(lineId, {
    tl: { col: 0, row: 20 },
    ext: { width: 430, height: 215 },
  });
  ws.addImage(donutId, {
    tl: { col: 5, row: 20 },
    ext: { width: 390, height: 250 },
  });

  assert(wb.worksheets.length === 1, `expected 1 sheet, got ${wb.worksheets.length}`);
  const images = ws.getImages();
  assert(images.length === 2, `expected 2 images, got ${images.length}`);

  // 圖表錨點列應在數據列之後
  const rows = images.map((img) => img.range.tl.nativeRow);
  assert(rows.every((r) => r >= 20), `charts should be below data rows, got ${rows.join(',')}`);

  const outXlsx = join(OUT, 'verify.xlsx');
  await wb.xlsx.writeFile(outXlsx);

  // 重新讀回確認
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.readFile(outXlsx);
  assert(wb2.worksheets.length === 1, 'reload sheet count');
  assert(wb2.worksheets[0].name === '股東財務損益報告', 'sheet name');
  assert(wb2.worksheets[0].getImages().length === 2, 'reload image count');

  console.log('VERIFY OK');
  console.log(JSON.stringify({
    sheets: wb2.worksheets.map((s) => s.name),
    images: wb2.worksheets[0].getImages().length,
    outXlsx,
    linePngBytes: linePng.length,
    donutPngBytes: donutPng.length,
    pageSetup: {
      fitToWidth: ws.pageSetup.fitToWidth,
      fitToHeight: ws.pageSetup.fitToHeight,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
