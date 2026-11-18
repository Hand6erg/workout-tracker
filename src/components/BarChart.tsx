export interface Bar {
  label: string;
  value: number;
  highlight?: boolean;
}

/** Kompakt tal til grafer: 950 → "950", 4500 → "4,5k", 12000 → "12k" */
export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${(k < 10 ? Math.round(k * 10) / 10 : Math.round(k)).toString().replace('.', ',')}k`;
}

/** Simpel lodret søjlegraf i ren SVG */
export function BarChart({ bars, label }: { bars: Bar[]; label: string }) {
  const W = 320;
  const H = 150;
  const top = 18;
  const bottom = 22;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = W / Math.max(1, bars.length);
  const bw = Math.min(28, slot * 0.6);

  return (
    <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={0} x2={W} y1={H - bottom} y2={H - bottom} className="axis" />
      {bars.map((b, i) => {
        const h = ((H - top - bottom) * b.value) / max;
        const x = i * slot + (slot - bw) / 2;
        const y = H - bottom - h;
        return (
          <g key={i} className={b.highlight ? 'hl' : ''}>
            {b.value > 0 && <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx={4} />}
            {b.value > 0 && (
              <text x={x + bw / 2} y={y - 5} className="val">
                {compact(b.value)}
              </text>
            )}
            <text x={x + bw / 2} y={H - 6} className="lbl">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
