export interface Point {
  t: number;
  value: number;
}

/** Simpel linjegraf i ren SVG (punkter sorteret efter tid) */
export function LineChart({ points, label, format }: { points: Point[]; label: string; format: (n: number) => string }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: 12, b: 20 };
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
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });

  return (
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
      {points.map((p) => (
        <circle key={p.t} cx={x(p.t)} cy={y(p.value)} r={3} className="dot" />
      ))}
      <text x={pad.l} y={H - 4} className="xlbl start">
        {dateFmt.format(t0)}
      </text>
      <text x={W - pad.r} y={H - 4} className="xlbl end">
        {dateFmt.format(t1)}
      </text>
    </svg>
  );
}
