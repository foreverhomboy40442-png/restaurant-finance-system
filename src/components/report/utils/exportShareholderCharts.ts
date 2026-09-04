/**
 * 股東報表 Excel 用圖表 — 產生 SVG 並轉成 PNG（瀏覽器 Canvas）
 * 字級加大、配色加深，利於紙本列印。
 */

export interface LineChartExportInput {
  title: string;
  xLabels: string[];
  values: number[];
  seriesLabel: string;
  yUnit: string;
}

export interface DonutSegmentExport {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartExportInput {
  title: string;
  segments: DonutSegmentExport[];
  totalLabel: string;
}

const REVENUE_COLOR = '#5C1010';
const AXIS_COLOR = '#1C1917';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAxisVal(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

function formatMoney(v: number): string {
  return v.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖表圖片載入失敗'));
    img.src = url;
  });
}

/** SVG 字串 → PNG bytes（白底，適合嵌入 Excel） */
export async function svgToPngBytes(
  svg: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法建立 Canvas');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG 轉檔失敗'))),
        'image/png',
      );
    });
    return new Uint8Array(await pngBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function buildRevenueTrendSvg(input: LineChartExportInput): string {
  const W = 720;
  const H = 360;
  const PAD_L = 88;
  const PAD_R = 28;
  const PAD_T = 56;
  const PAD_B = 56;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = input.xLabels.length;
  const values = input.values;

  const rawMax = values.length ? Math.max(...values) : 0;
  const rawMin = values.length ? Math.min(0, ...values) : 0;
  const pad = (rawMax - rawMin) * 0.12 || 1;
  const maxVal = rawMax + pad;
  const minVal = rawMin;
  const range = maxVal - minVal || 1;

  const xPos = (i: number) =>
    n <= 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW;
  const yPos = (v: number) =>
    PAD_T + innerH - ((v - minVal) / range) * innerH;

  const yTicks = Array.from({ length: 5 }, (_, i) =>
    minVal + (i / 4) * (maxVal - minVal),
  );

  const grid = yTicks
    .map((val) => {
      const y = yPos(val);
      return [
        `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="${AXIS_COLOR}" stroke-opacity="0.14" stroke-width="1"/>`,
        `<text x="${PAD_L - 10}" y="${y + 5}" text-anchor="end" font-size="14" font-weight="700" fill="${AXIS_COLOR}" fill-opacity="0.82" font-family="Arial, sans-serif">${formatAxisVal(val)}</text>`,
      ].join('');
    })
    .join('');

  const xLabels = input.xLabels
    .map((label, i) => {
      return `<text x="${xPos(i)}" y="${H - 16}" text-anchor="middle" font-size="14" font-weight="700" fill="${AXIS_COLOR}" fill-opacity="0.88" font-family="Arial, sans-serif">${escapeXml(label)}</text>`;
    })
    .join('');

  const points = values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  const dots = values
    .map((v, i) => {
      return `<circle cx="${xPos(i)}" cy="${yPos(v)}" r="5.5" fill="${REVENUE_COLOR}" stroke="#FFFFFF" stroke-width="2"/>`;
    })
    .join('');

  const polyline =
    n === 0
      ? ''
      : `<polyline points="${points}" fill="none" stroke="${REVENUE_COLOR}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="24" y="30" font-size="18" font-weight="800" fill="${AXIS_COLOR}" font-family="Arial, sans-serif">${escapeXml(input.title)}</text>
  <text x="24" y="48" font-size="13" font-weight="600" fill="${AXIS_COLOR}" fill-opacity="0.65" font-family="Arial, sans-serif">${escapeXml(input.seriesLabel)}（${escapeXml(input.yUnit)}）</text>
  ${grid}
  <line x1="${PAD_L}" y1="${PAD_T + innerH}" x2="${W - PAD_R}" y2="${PAD_T + innerH}" stroke="${AXIS_COLOR}" stroke-opacity="0.4" stroke-width="1.5"/>
  ${xLabels}
  ${polyline}
  ${dots}
</svg>`;
}

export function buildExpenseDonutSvg(input: DonutChartExportInput): string {
  const W = 520;
  const H = 420;
  const size = 220;
  const cx = 130;
  const cy = 200;
  const outerR = size * 0.45;
  const innerR = size * 0.26;
  const nonZero = input.segments.filter((s) => s.value > 0);
  const total = nonZero.reduce((s, seg) => s + seg.value, 0);

  function polar(r: number, angle: number): [number, number] {
    return [
      cx + r * Math.cos(angle - Math.PI / 2),
      cy + r * Math.sin(angle - Math.PI / 2),
    ];
  }

  function arcPath(start: number, end: number): string {
    const large = end - start > Math.PI ? 1 : 0;
    const [x1, y1] = polar(outerR, start);
    const [x2, y2] = polar(outerR, end);
    const [x3, y3] = polar(innerR, end);
    const [x4, y4] = polar(innerR, start);
    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  let angle = 0;
  const slices =
    total <= 0
      ? `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#E7E5E4"/>`
      : nonZero
          .map((seg) => {
            const sweep = (seg.value / total) * Math.PI * 2;
            const start = angle;
            const end = angle + sweep - 0.01;
            angle += sweep;
            return `<path d="${arcPath(start, end)}" fill="${seg.color}" stroke="#FFFFFF" stroke-width="2"/>`;
          })
          .join('');

  const centerTotal =
    total >= 1_000_000
      ? `${(total / 1_000_000).toFixed(2)}M`
      : `${Math.round(total / 1000)}K`;

  const legend = nonZero
    .map((seg, i) => {
      const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0';
      const y = 88 + i * 36;
      return `
        <rect x="280" y="${y - 12}" width="16" height="16" rx="2" fill="${seg.color}"/>
        <text x="304" y="${y}" font-size="14" font-weight="700" fill="${AXIS_COLOR}" font-family="Arial, sans-serif">${escapeXml(seg.label)}</text>
        <text x="304" y="${y + 16}" font-size="13" font-weight="700" fill="${AXIS_COLOR}" fill-opacity="0.75" font-family="Arial, sans-serif">${pct}%　$${formatMoney(seg.value)}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="24" y="30" font-size="18" font-weight="800" fill="${AXIS_COLOR}" font-family="Arial, sans-serif">${escapeXml(input.title)}</text>
  ${slices}
  <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="${AXIS_COLOR}" fill-opacity="0.72" font-family="Arial, sans-serif">${escapeXml(input.totalLabel)}</text>
  <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="16" font-weight="800" fill="${AXIS_COLOR}" font-family="Arial, sans-serif">${centerTotal}</text>
  ${legend}
</svg>`;
}

export async function renderShareholderChartPngs(input: {
  line: LineChartExportInput;
  donut: DonutChartExportInput;
}): Promise<{ linePng: Uint8Array; donutPng: Uint8Array }> {
  const lineSvg = buildRevenueTrendSvg(input.line);
  const donutSvg = buildExpenseDonutSvg(input.donut);
  const [linePng, donutPng] = await Promise.all([
    svgToPngBytes(lineSvg, 720, 360),
    svgToPngBytes(donutSvg, 520, 420),
  ]);
  return { linePng, donutPng };
}
