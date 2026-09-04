/**
 * 純 SVG 甜甜圈圖元件
 *
 * 依傳入的 segments 自動計算弧度與百分比，
 * 圖例附帶數值與百分比，支援最多 8 個色段。
 * emphasis：股東報表用 — 更大字級、更深圖例文字、緊湊排版減少留白。
 */

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface SvgDonutChartProps {
  segments: Segment[];
  size?: number;
  /** 加強可讀性（更大字級、更深顏色） */
  emphasis?: boolean;
  emptyText?: string;
  totalLabel?: string;
}

function polarPoint(cx: number, cy: number, r: number, angle: number): string {
  const x = cx + r * Math.cos(angle - Math.PI / 2);
  const y = cy + r * Math.sin(angle - Math.PI / 2);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function segmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  const p1 = polarPoint(cx, cy, outerR, startAngle);
  const p2 = polarPoint(cx, cy, outerR, endAngle);
  const p3 = polarPoint(cx, cy, innerR, endAngle);
  const p4 = polarPoint(cx, cy, innerR, startAngle);
  return [
    `M ${p1}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${p2}`,
    `L ${p3}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${p4}`,
    'Z',
  ].join(' ');
}

function formatMoney(v: number): string {
  return v.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function SvgDonutChart({
  segments,
  size = 180,
  emphasis = false,
  emptyText = '暫無資料',
  totalLabel = '合計',
}: SvgDonutChartProps) {
  const nonZero = segments.filter((s) => s.value > 0);

  if (nonZero.length === 0) {
    return (
      <div
        className={`flex h-32 items-center justify-center ${
          emphasis ? 'text-base text-canton-dark/55' : 'text-sm text-canton-dark/35'
        }`}
      >
        {emptyText}
      </div>
    );
  }

  const total = nonZero.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  // 放大環帶占比，減少圓外與中心留白
  const outerR = size * (emphasis ? 0.49 : 0.46);
  const innerR = size * (emphasis ? 0.24 : 0.27);

  let currentAngle = 0;

  const legend = (
    <div className={`w-full min-w-0 ${emphasis ? 'space-y-1.5' : 'space-y-1.5'}`}>
      {nonZero.map((seg) => {
        const pct = ((seg.value / total) * 100).toFixed(1);
        return (
          <div key={seg.label} className={`flex items-center ${emphasis ? 'gap-2' : 'gap-2'}`}>
            <span
              className={`shrink-0 rounded-sm ${emphasis ? 'h-3 w-3' : 'h-2.5 w-2.5'}`}
              style={{ backgroundColor: seg.color }}
            />
            <span
              className={`min-w-0 flex-1 truncate ${
                emphasis
                  ? 'text-sm font-semibold text-canton-dark'
                  : 'text-xs text-canton-dark/65'
              }`}
            >
              {seg.label}
            </span>
            <span
              className={`shrink-0 font-mono tabular-nums ${
                emphasis
                  ? 'text-sm font-semibold text-canton-dark'
                  : 'text-xs text-canton-dark/50'
              }`}
            >
              {pct}%
            </span>
            <span
              className={`shrink-0 font-mono tabular-nums ${
                emphasis
                  ? 'text-sm font-semibold text-canton-dark'
                  : 'text-xs text-canton-dark/65'
              }`}
            >
              ${formatMoney(seg.value)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={
        emphasis
          ? 'flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4'
          : 'flex flex-col items-center gap-3'
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto w-full shrink-0"
        style={{ maxWidth: size }}
        aria-label="甜甜圈圖"
        role="img"
      >
        {nonZero.map((seg) => {
          const angle = (seg.value / total) * Math.PI * 2;
          const startA = currentAngle;
          const endA = currentAngle + angle - 0.01;
          currentAngle += angle;

          return (
            <path
              key={seg.label}
              d={segmentPath(cx, cy, outerR, innerR, startA, endA)}
              fill={seg.color}
              opacity="1"
              stroke={emphasis ? '#FDFBF7' : undefined}
              strokeWidth={emphasis ? 1.5 : undefined}
            />
          );
        })}

        <text
          x={cx}
          y={cy - (emphasis ? 7 : 5)}
          textAnchor="middle"
          fontSize={emphasis ? 13 : 10}
          fontWeight={emphasis ? 600 : 400}
          fill={emphasis ? 'rgb(28 25 23 / 0.72)' : 'rgb(44 44 44 / 0.40)'}
        >
          {totalLabel}
        </text>
        <text
          x={cx}
          y={cy + (emphasis ? 11 : 9)}
          textAnchor="middle"
          fontSize={emphasis ? 15 : 11}
          fontWeight="700"
          fill={emphasis ? 'rgb(28 25 23 / 0.92)' : 'rgb(44 44 44 / 0.75)'}
          fontFamily="JetBrains Mono, monospace"
        >
          {total >= 1_000_000
            ? `${(total / 1_000_000).toFixed(2)}M`
            : `${Math.round(total / 1000)}K`}
        </text>
      </svg>

      {legend}
    </div>
  );
}
