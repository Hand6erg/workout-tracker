import { useState } from 'react';
import { exerciseKind, exerciseProgress, formatKg, type ProgressMetric, type ProgressRange } from '../lib/logic';
import { useStore } from '../lib/store';
import { LineChart } from './LineChart';

const RANGES: { id: ProgressRange; label: string }[] = [
  { id: '3m', label: '3 mdr.' },
  { id: '1y', label: '1 år' },
  { id: 'all', label: 'Alt' },
];

const METRICS: { id: ProgressMetric; label: string }[] = [
  { id: '1rm', label: 'Est. 1RM' },
  { id: 'heaviest', label: 'Tungeste sæt' },
  { id: 'volume', label: 'Volumen' },
];

/** Styrkegraf på øvelsessiden (#214): udvikling pr. træning med valg af måling og interval */
export function StrengthChart({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const kind = exerciseKind(state, exerciseId);
  const [metric, setMetric] = useState<ProgressMetric>('1rm');
  const [range, setRange] = useState<ProgressRange>('all');
  const points = exerciseProgress(state, exerciseId, kind === 'reps' ? metric : '1rm', range, Date.now());

  const metricName =
    kind === 'time' ? 'Længste hold' : kind === 'distance' ? 'Længste distance' : METRICS.find((m) => m.id === metric)!.label;
  const format = (n: number) =>
    kind === 'time' ? `${Math.round(n)} sek.` : kind === 'distance' ? `${String(Math.round(n * 10) / 10).replace('.', ',')} m` : formatKg(n);
  // Aksen viser kun tal, så de kan være i venstre margen
  const axis = (n: number) => (n >= 10000 ? `${String(Math.round(n / 100) / 10).replace('.', ',')}k` : String(Math.round(n)));
  const newest = points[points.length - 1];

  return (
    <section className="strength-chart" aria-label="Styrkegraf">
      <h3 className="section">📈 Udvikling</h3>
      {kind === 'reps' ? (
        <div className="seg" role="group" aria-label="Måling">
          {METRICS.map((m) => (
            <button key={m.id} aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="seg" role="group" aria-label="Måling">
          <button aria-pressed>{metricName}</button>
        </div>
      )}
      <div className="seg" role="group" aria-label="Periode">
        {RANGES.map((r) => (
          <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {points.length < 2 ? (
        <p className="muted chart-empty">Log øvelsen mindst to gange for at se en graf</p>
      ) : (
        <LineChart
          points={points.map((p) => ({ t: p.date, value: p.value }))}
          label={`${metricName}: ${format(newest.value)} senest, ${points.length} træninger`}
          format={axis}
        />
      )}
    </section>
  );
}
