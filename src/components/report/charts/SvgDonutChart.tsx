/**
 * 純 SVG 甜甜圈圖元件
 *
 * 依傳入的 segments 自動計算弧度與百分比，
 * 圖例附帶數值與百分比，支援最多 8 個色段。
 */

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface SvgDonutChartProps {
  segments: Segment[];
  size?: number;
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

export default function SvgDonutChart({ segments, size = 180 }: SvgDonutChartProps) {
  const nonZero = segments.filter((s) => s.value > 0);

  if (nonZero.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-canton-dark/35">
        暫無資料
      </div>
    );
  }

  const total = nonZero.reduce((s, seg) => s + seg.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.43;
  const innerR = size * 0.27;

  let currentAngle = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG 圓環 */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full"
        style={{ maxWidth: size }}
        aria-label="甜甜圈圖"
        role="img"
      >
        {nonZero.map((seg) => {
          const angle = (seg.value / total) * Math.PI * 2;
          const startA = currentAngle;
          const endA = currentAngle + angle - 0.01; // tiny gap
          currentAngle += angle;

          return (
            <path
              key={seg.label}
              d={segmentPath(cx, cy, outerR, innerR, startA, endA)}
              fill={seg.color}
              opacity="0.88"
            />
          );
        })}

        {/* 中心文字 */}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          fontSize="10"
          fill="rgb(44 44 44 / 0.40)"
        >
          合計
        </text>
        <text
          x={cx}
          y={cy + 9}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="rgb(44 44 44 / 0.75)"
          fontFamily="JetBrains Mono, monospace"
        >
          {total >= 1_000_000
            ? `${(total / 1_000_000).toFixed(2)}M`
            : `${Math.round(total / 1000)}K`}
        </text>
      </svg>

      {/* 圖例 */}
      <div className="w-full space-y-1.5">
        {nonZero.map((seg) => {
          const pct = ((seg.value / total) * 100).toFixed(1);
          return (
            <div key={seg.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: seg.color, opacity: 0.88 }}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-canton-dark/65">
                {seg.label}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-xs text-canton-dark/50">
                {pct}%
              </span>
              <span className="shrink-0 font-mono tabular-nums text-xs text-canton-dark/65">
                ${formatMoney(seg.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
