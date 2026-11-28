import { useState } from 'react';
import { formatTons, mostLiftedExercises } from '../lib/logic';
import { useStore, useUnit } from '../lib/store';
import { ExerciseDetail } from '../views/ExercisesView';

/** "Mest løftede øvelser" i Profil (#274): top 3 efter samlet løftet vægt */
export function MostLifted() {
  const unit = useUnit();
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = mostLiftedExercises(state, 3);
  const open = state.exercises.find((e) => e.id === openId);
  if (!rows.length) return null;
  return (
    <section aria-label="Mest løftede øvelser">
      <h2 className="section">🏋️ Mest løftede øvelser</h2>
      <ol className="card most-lifted">
        {rows.map((r, i) => (
          <li key={r.exerciseId}>
            <button className="ml-row" aria-label={`Åbn ${r.name}`} onClick={() => setOpenId(r.exerciseId)}>
              <span className="ml-rank" aria-hidden>
                {i + 1}
              </span>
              <span className="ml-name">
                <strong>{r.name}</strong>
                <small className="muted">{r.workouts === 1 ? '1 træning' : `${r.workouts} træninger`}</small>
              </span>
              <span className="ml-total">{formatTons(r.volumeKg, unit)}</span>
            </button>
          </li>
        ))}
      </ol>
      {open && <ExerciseDetail ex={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
