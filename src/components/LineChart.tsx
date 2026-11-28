export interface Point {
  t: number;
  value: number;
}

interface Taps {
  /** Tekst pr. punkt; når den er sat, kan punkterne trykkes på (#215) */
  pointLabels?: string[];
  /** Punkter der fremhæves med 🏆 (rekorder) */
  marks?: boolean[];
  /** Punkter der tegnes hule og ikke indgår i linjen, fx lette uger (#362) */
  hollow?: boolean[];
  selected?: number;
  onSelect?: (index: number) => void;
}

/** Simpel linjegraf i ren SVG (punkter sorteret efter tid) */
export function LineChart({
  points,
  label,
  format,
  pointLabels,
  marks,
  hollow,
  selected,
  onSelect,
}: { points: Point[]; label: string; format: (n: number) => string } & Taps) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: marks?.some(Boolean) ? 22 : 12, b: 20 };
  const ts = points.map((p) => p.t);
  const vs = points.map((p) => p.value);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1) {
    lo -= 0.5;
    hi += 0.5;
  }
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // Hule punkter (#362) springes over i linjen, så længe der er mindst to andre punkter
  const solid = points.filter((_, i) => !hollow?.[i]);
  const linePoints = solid.length >= 2 ? solid : points;
  const path = linePoints.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });

  const svg = (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[hi, lo].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={pad.l - 4} y={y(v) + 3} className="ylbl">
            {format(v)}
          </text>
        </g>
      ))}
      <path d={path} className="line" />
      {points.map((p, i) => (
        <circle
          key={p.t}
          cx={x(p.t)}
          cy={y(p.value)}
          r={marks?.[i] ? 4.5 : selected === i ? 4.5 : 3}
          className={`dot${marks?.[i] ? ' record' : ''}${hollow?.[i] ? ' hollow' : ''}${selected === i ? ' selected' : ''}`}
        />
      ))}
      {points.map((p, i) =>
        marks?.[i] ? (
          <text key={`m${p.t}`} x={x(p.t)} y={y(p.value) - 7} className="mark">
            🏆
          </text>
        ) : null,
      )}
      <text x={pad.l} y={H - 4} className="xlbl start">
        {dateFmt.format(t0)}
      </text>
      <text x={W - pad.r} y={H - 4} className="xlbl end">
        {dateFmt.format(t1)}
      </text>
    </svg>
  );
  if (!pointLabels || !onSelect) return svg;
  return (
    <div className="line-chart-wrap">
      {svg}
      {points.map((p, i) => (
        <button
          key={p.t}
          type="button"
          className="chart-tap"
          style={{ left: `${(x(p.t) / W) * 100}%`, top: `${(y(p.value) / H) * 100}%` }}
          aria-label={pointLabels[i]}
          aria-pressed={selected === i}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
