import { formatWeight, isStrongRepMax, repMaxesBeaten, repMaxTable } from '../lib/logic';
import { useStore, useUnit } from '../lib/store';

const shortDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: '2-digit' });

/** "Rep-maks" på øvelsessiden (#355): bedste vægt for 1, 2, 3, 5, 8, 10 og 12 reps + estimat ud fra e1RM */
export function RepMaxTable({ exerciseId }: { exerciseId: string }) {
  const unit = useUnit();
  const { state } = useStore();
  const rows = repMaxTable(state, exerciseId);
  if (!rows.length || !rows.some((r) => r.best)) return null;
  return (
    <section aria-label="Rep-maks" className="repmax">
      <h3 className="section">Rep-maks</h3>
      <ul className="repmax-list">
        {rows.map((r) => {
          const strong = isStrongRepMax(r);
          // 🏆 når rækken blev slået i den træning, der nu holder rekorden (#356)
          const beaten = !!r.best && repMaxesBeaten(state, r.best.workoutId, exerciseId).includes(r.reps);
          return (
            <li key={r.reps} className="repmax-row" aria-label={`${r.reps} reps: ${r.best ? formatWeight(r.best.weight, unit) : 'intet endnu'}`}>
              <span className="repmax-reps">{r.reps}RM</span>
              <span className="repmax-best">
                <strong>{r.best ? formatWeight(r.best.weight, unit) : '–'}</strong>
                {r.best && (
                  <small className="muted">
                    {beaten && <span role="img" aria-label="Slået rekord">🏆 </span>}
                    {shortDate.format(r.best.date)}
                  </small>
                )}
                {strong && <span className="repmax-strong">stærk</span>}
              </span>
              <span className="muted repmax-est">{r.estimated > 0 ? `est. ${formatWeight(r.estimated, unit)}` : ''}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
