import { daysAgoText, exerciseKind, formatTons, lifetimeStats } from '../lib/logic';
import { useStore } from '../lib/store';

const longDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Gennem tiden" på øvelsessiden (#273): første gang, træninger, sæt, reps og samlet løftet vægt */
export function LifetimeCard({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const stats = lifetimeStats(state.history, exerciseId, state);
  if (!stats) return null;
  const reps = exerciseKind(state, exerciseId) === 'reps';
  const cells: [string, string][] = [
    ['Træninger', String(stats.workouts)],
    ['Sæt', stats.sets.toLocaleString('da-DK')],
    ...(reps
      ? ([
          ['Reps', stats.reps.toLocaleString('da-DK')],
          ['Løftet i alt', formatTons(stats.volumeKg)],
        ] as [string, string][])
      : []),
  ];
  return (
    <section className="card lifetime" aria-label="Gennem tiden">
      <h3 className="section">🏋️ Gennem tiden</h3>
      <p className="muted">Første gang {longDate.format(stats.firstDate)}</p>
      <dl className="lifetime-grid">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="lifetime-last">Sidst lavet: {daysAgoText(stats.lastDate, Date.now())}</p>
    </section>
  );
}
