import { useState } from 'react';
import { STORAGE_KEY, muscleRecovery, type MuscleRecovery, type RecoveryStatus } from '../lib/logic';
import type { AppState } from '../lib/types';

/** Om kortet er klappet sammen – huskes kun på denne enhed (#287) */
const HIDDEN_KEY = `${STORAGE_KEY}-recovery-hidden`;

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export const RECOVERY_TEXT: Record<RecoveryStatus, string> = {
  rested: 'Klar',
  recent: 'Trænet for nylig',
  hard: 'Hårdt trænet',
};

export function daysSinceText(days: number | null): string {
  if (days === null) return 'ikke trænet endnu';
  if (days === 0) return 'i dag';
  if (days === 1) return 'i går';
  return `for ${days} dage siden`;
}

export function recoveryLabel(r: MuscleRecovery): string {
  return `${r.muscle}: ${RECOVERY_TEXT[r.status]}, ${daysSinceText(r.daysSince)}, ${r.hardSets7d} sæt de sidste 7 dage`;
}

export function RecoveryCard({
  state,
  onOpenWorkout,
}: {
  state: Pick<AppState, 'history' | 'exercises'>;
  /** Åbn den seneste træning for en muskel (#288) */
  onOpenWorkout?: (workoutId: string) => void;
}) {
  const [hidden, setHidden] = useState(readHidden);
  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, next ? '1' : '0');
    } catch {
      /* ingen lagring – valget gælder kun nu */
    }
  };
  const rows = muscleRecovery(state, Date.now());

  return (
    <section className="card recovery" aria-label="Restitution">
      <header>
        <h2>Restitution</h2>
        <button className="btn-ghost small" aria-expanded={!hidden} onClick={toggle}>
          {hidden ? 'Vis' : 'Skjul'}
        </button>
      </header>
      {!hidden && (
        <ul className="recovery-list">
          {rows.map((r) => (
            <li key={r.muscle} className="recovery-row" aria-label={recoveryLabel(r)}>
              {r.lastWorkoutId && onOpenWorkout ? (
                <button
                  className="recovery-open"
                  aria-label={`Vis seneste træning for ${r.muscle}`}
                  onClick={() => onOpenWorkout(r.lastWorkoutId!)}
                >
                  <RecoveryRowContent r={r} />
                  <span className="recovery-chevron" aria-hidden="true">›</span>
                </button>
              ) : (
                <RecoveryRowContent r={r} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecoveryRowContent({ r }: { r: MuscleRecovery }) {
  return (
    <>
      <span className={`dot dot-${r.status}`} aria-hidden="true" />
      <span className="recovery-name">
        <strong>{r.muscle}</strong>
        <small className={`recovery-status st-${r.status}`}>{RECOVERY_TEXT[r.status]}</small>
      </span>
      <span className="recovery-meta muted">
        <span>{daysSinceText(r.daysSince)}</span>
        <small>{r.hardSets7d} sæt / 7 dage</small>
      </span>
    </>
  );
}
