import { formatDuration, MAX_REST, restInfo, roundRestTo15, typicalRest, type RestSource } from '../lib/logic';
import { useStore } from '../lib/store';
import { Modal } from './ui';

/** Pausetid som "2:00" (0 = "Ingen") */
export function formatRest(seconds: number): string {
  return seconds > 0 ? formatDuration(seconds * 1000) : 'Ingen';
}

const SOURCE_TEXT: Record<RestSource, string> = {
  own: 'Egen tid for øvelsen',
  suggested: 'Forslag til denne type øvelse',
  global: 'Standard fra Profil',
};

const QUICK = [60, 90, 120, 180];

/** Knapper til at vælge pausetid for én øvelse. Gemmes på øvelsen, så den bruges næste gang. */
export function RestControls({ exerciseId }: { exerciseId: string }) {
  const { state, dispatch } = useStore();
  const { seconds, source } = restInfo(state, exerciseId);
  const typical = typicalRest(state, exerciseId);
  const set = (s: number) => dispatch({ type: 'SET_EXERCISE_REST', exerciseId, seconds: Math.max(0, Math.min(MAX_REST, s)) });
  return (
    <>
      <div className="rest-picker-value">
        <button className="btn-ghost" aria-label="15 sekunder kortere" onClick={() => set(seconds - 15)} disabled={seconds <= 0}>
          −15
        </button>
        <output aria-label="Pausetid" aria-live="polite">
          {formatRest(seconds)}
        </output>
        <button className="btn-ghost" aria-label="15 sekunder længere" onClick={() => set(seconds + 15)} disabled={seconds >= MAX_REST}>
          +15
        </button>
      </div>
      <p className="muted rest-picker-source">{SOURCE_TEXT[source]}</p>
      {typical !== null && (
        <p className="rest-typical">
          <span>
            Du hviler typisk <strong>{formatRest(typical)}</strong>
          </span>
          {roundRestTo15(typical) !== seconds && (
            <button className="chip on" onClick={() => set(roundRestTo15(typical))}>
              Brug {formatRest(roundRestTo15(typical))}
            </button>
          )}
        </p>
      )}
      <div className="chips rest-picker-quick" role="group" aria-label="Hurtige valg">
        {QUICK.map((q) => (
          <button key={q} className={`chip ${source === 'own' && seconds === q ? 'on' : ''}`} onClick={() => set(q)}>
            {formatRest(q)}
          </button>
        ))}
      </div>
      <button
        className="btn-secondary"
        disabled={source !== 'own'}
        onClick={() => dispatch({ type: 'SET_EXERCISE_REST', exerciseId })}
      >
        Brug standard ({formatRest(restInfoWithout(state, exerciseId))})
      </button>
    </>
  );
}

/** Vælg pausetid for én øvelse fra træningen (#120) */
export function RestPicker({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const { exerciseById } = useStore();
  const name = exerciseById(exerciseId)?.name ?? 'øvelsen';
  return (
    <Modal title={`Pause: ${name}`} onClose={onClose}>
      <div className="rest-picker">
        <RestControls exerciseId={exerciseId} />
        <button className="btn-primary" onClick={onClose}>
          Færdig
        </button>
      </div>
    </Modal>
  );
}

/** Hvad pausen ville være uden en egen tid */
function restInfoWithout(state: Parameters<typeof restInfo>[0], exerciseId: string): number {
  const exercises = state.exercises.map((e) => {
    if (e.id !== exerciseId) return e;
    const { restSeconds: _r, ...rest } = e;
    return rest;
  });
  return restInfo({ ...state, exercises }, exerciseId).seconds;
}
