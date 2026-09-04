/**
 * 純 SVG 折線圖元件
 *
 * 支援多條系列線、格線、X/Y 軸標籤、資料點。
 * 完全無外部依賴，透過 viewBox 實現 RWD 等比縮放。
 * emphasis：股東報表用 — 更大字級、更深軸色、更粗線條。
 */

interface DataSeries {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
}

interface SvgLineChartProps {
  xLabels: string[];
  series: DataSeries[];
  height?: number;
  /** Y 軸單位說明（如 "元"） */
  yUnit?: string;
  /** 無資料時顯示文字 */
  emptyText?: string;
  /** 加強可讀性（更大字級、更深顏色） */
  emphasis?: boolean;
}

const W = 620;
const PAD_L = 80;
const PAD_R = 20;
const PAD_T = 24;
const PAD_B = 48;

function formatAxisVal(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(Math.round(v));
}

export default function SvgLineChart({
  xLabels,
  series,
  height = 260,
  yUnit,
  emptyText = 'No data',
  emphasis = false,
}: SvgLineChartProps) {
  const n = xLabels.length;
  if (n === 0 || series.length === 0) {
    return (
      <div
        className={`flex h-40 items-center justify-center ${
          emphasis ? 'text-base text-canton-dark/55' : 'text-sm text-canton-dark/35'
        }`}
      >
        {emptyText}
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const innerH = height - PAD_T - PAD_B;

  const allVals = series.flatMap((s) => s.values);
  const rawMax = Math.max(...allVals);
  const rawMin = Math.min(0, ...allVals);
  const padding = (rawMax - rawMin) * 0.12 || 1;
  const maxVal = rawMax + padding;
  const minVal = rawMin;
  const range = maxVal - minVal || 1;

  const xPos = (i: number) =>
    n === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (n - 1)) * innerW;

  const yPos = (v: number) =>
    PAD_T + innerH - ((v - minVal) / range) * innerH;

  const Y_TICKS = 5;
  const yTickVals = Array.from({ length: Y_TICKS }, (_, i) =>
    minVal + (i / (Y_TICKS - 1)) * (maxVal - minVal),
  );

  const axisFont = emphasis ? 13 : 10;
  const unitFont = emphasis ? 12 : 9;
  const axisFill = emphasis ? 'rgb(28 25 23 / 0.78)' : 'rgb(44 44 44 / 0.38)';
  const xFill = emphasis ? 'rgb(28 25 23 / 0.82)' : 'rgb(44 44 44 / 0.40)';
  const unitFill = emphasis ? 'rgb(28 25 23 / 0.65)' : 'rgb(44 44 44 / 0.30)';
  const gridStroke = emphasis ? 'rgb(28 25 23 / 0.14)' : 'rgb(44 44 44 / 0.06)';
  const axisStroke = emphasis ? 'rgb(28 25 23 / 0.35)' : 'rgb(44 44 44 / 0.12)';
  const lineWidth = emphasis ? 3.25 : 2;
  const pointR = emphasis ? 4.5 : 3;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        style={{ minWidth: 320 }}
        aria-label="折線趨勢圖"
        role="img"
      >
        {/* Y 格線 & 標籤 */}
        {yTickVals.map((val, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={yPos(val)}
              x2={W - PAD_R}
              y2={yPos(val)}
              stroke={gridStroke}
              strokeWidth="1"
            />
            <text
              x={PAD_L - 8}
              y={yPos(val) + 4}
              textAnchor="end"
              fontSize={axisFont}
              fontWeight={emphasis ? 600 : 400}
              fill={axisFill}
              fontFamily="JetBrains Mono, monospace"
            >
              {formatAxisVal(val)}
            </text>
          </g>
        ))}

        {/* X 軸線 */}
        <line
          x1={PAD_L}
          y1={PAD_T + innerH}
          x2={W - PAD_R}
          y2={PAD_T + innerH}
          stroke={axisStroke}
          strokeWidth={emphasis ? 1.5 : 1}
        />

        {/* X 軸標籤 */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={xPos(i)}
            y={height - 10}
            textAnchor="middle"
            fontSize={axisFont}
            fontWeight={emphasis ? 600 : 400}
            fill={xFill}
          >
            {label}
          </text>
        ))}

        {/* Y 軸單位 */}
        {yUnit && (
          <text
            x={6}
            y={PAD_T + 4}
            fontSize={unitFont}
            fontWeight={emphasis ? 600 : 400}
            fill={unitFill}
          >
            {yUnit}
          </text>
        )}

        {/* 各系列 polyline */}
        {series.map((s) => {
          const points = s.values
            .map((v, i) => `${xPos(i)},${yPos(v)}`)
            .join(' ');
          return (
            <polyline
              key={s.label}
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={lineWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '5 4' : undefined}
              opacity="1"
            />
          );
        })}

        {/* 資料點 */}
        {series.map((s) =>
          s.values.map((v, i) => (
            <circle
              key={`${s.label}-${i}`}
              cx={xPos(i)}
              cy={yPos(v)}
              r={pointR}
              fill={s.color}
              stroke="white"
              strokeWidth={emphasis ? 2 : 1.5}
            />
          )),
        )}
      </svg>

      {/* 圖例 */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {series.map((s) => (
          <span
            key={s.label}
            className={`flex items-center gap-2 ${
              emphasis
                ? 'text-sm font-semibold text-canton-dark'
                : 'text-xs text-canton-dark/55'
            }`}
          >
            <span
              className={`inline-block rounded-full ${emphasis ? 'h-2.5 w-7' : 'h-2 w-5'}`}
              style={{
                backgroundColor: s.dashed ? 'transparent' : s.color,
                borderBottom: s.dashed ? `2px dashed ${s.color}` : undefined,
                borderTop: s.dashed ? `2px dashed ${s.color}` : undefined,
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
