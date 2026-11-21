import { useMemo, useState } from 'react';
import { MonthCalendar } from '../components/MonthCalendar';
import { MonthRecapCard } from '../components/MonthRecap';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import {
  bestSet,
  formatDuration,
  formatKg,
  formatSet,
  isBodyweightReps,
  recapToShow,
  recordCount,
  supersetGroups,
  workoutRecords,
  withLoads,
  workoutVolume,
  workoutDuration,
} from '../lib/logic';
import { useStore } from '../lib/store';
import type { Workout } from '../lib/types';

const dateFmt = new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function HistoryView({ onOpenWorkout }: { onOpenWorkout?: () => void } = {}) {
  const { state, dispatch, exerciseById } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.history.find((w) => w.id === openId);
  // Rekorder kræver et kig på hele historikken, så de beregnes kun når historikken ændres
  const recordsById = useMemo(
    () => new Map(state.history.map((w) => [w.id, workoutRecords(state, w.id)])),
    [state.history],
  );
  // Sidste måneds opsummering de første dage af en ny måned (#169)
  const recap = useMemo(() => recapToShow(state, Date.now()), [state.history, state.recapDismissed, state.exercises]);

  return (
    <div className="page">
      <h1>Historik</h1>
      {recap && <MonthRecapCard r={recap} onDismiss={() => dispatch({ type: 'DISMISS_RECAP', key: recap.key })} />}
      {state.history.length > 0 && <MonthCalendar onOpen={setOpenId} />}
      {!state.history.length && <Empty>Ingen træninger endnu. Afslut en træning, så dukker den op her.</Empty>}
      <div className="cards">
        {state.history.map((w) => {
          const records = recordsById.get(w.id) ?? {};
          const count = recordCount(records);
          return (
          <button key={w.id} className="card as-button" onClick={() => setOpenId(w.id)} aria-label={`Træning ${w.name}`}>
            <h3>{w.name}</h3>
            <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
            <p className="stats">
              <span>⏱ {formatDuration(workoutDuration(w, w.startedAt))}</span>
              <span>🏋️ {formatKg(workoutVolume(withLoads(state, w)))}</span>
              {count > 0 && (
                <span className="pr-count">🏆 {count === 1 ? '1 rekord' : `${count} rekorder`}</span>
              )}
            </p>
            <table className="mini">
              <tbody>
                {w.exercises.map((e) => {
                  const b = bestSet(e.sets);
                  return (
                    <tr key={e.id}>
                      <td>
                        {e.sets.filter((x) => !x.warmup).length} × {exerciseById(e.exerciseId)?.name}
                        {records[e.exerciseId] && (
                          <span role="img" aria-label="Ny rekord">
                            {' '}
                            🏆
                          </span>
                        )}
                      </td>
                      <td className="muted">{b ? formatSet(b, isBodyweightReps(state, e.exerciseId)) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {supersetGroups(w.exercises)
              .filter((g) => g.length > 1)
              .map((g) => (
                <p key={g[0].supersetId} className="superset-note">
                  Supersæt: {g.map((e) => exerciseById(e.exerciseId)?.name ?? '?').join(' + ')}
                </p>
              ))}
            {w.note && <p className="workout-note-line">📝 {w.note}</p>}
          </button>
          );
        })}
      </div>
      {open && <WorkoutDetail w={open} onClose={() => setOpenId(null)} onOpenWorkout={onOpenWorkout} />}
    </div>
  );
}

function WorkoutDetail({ w, onClose, onOpenWorkout }: { w: Workout; onClose: () => void; onOpenWorkout?: () => void }) {
  const { state, dispatch, exerciseById } = useStore();
  // Gentag træningen (#150): start en ny med samme øvelser og sæt, og vis den dags tal som "Forrige"
  const repeat = () => {
    dispatch({ type: 'REPEAT_WORKOUT', workoutId: w.id, now: Date.now(), replace: true });
    onClose();
    onOpenWorkout?.();
  };
  const [saved, setSaved] = useState(false);

  return (
    <Modal
      title={w.name}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              dispatch({ type: 'EDIT_WORKOUT', workoutId: w.id });
              onClose();
            }}
          >
            Redigér
          </button>
          <button
            className="btn-secondary"
            disabled={saved}
            onClick={() => {
              dispatch({ type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: w.id, name: w.name });
              setSaved(true);
            }}
          >
            {saved ? 'Gemt som skabelon ✓' : 'Gem som skabelon'}
          </button>
          <ConfirmButton
            onConfirm={() => {
              dispatch({ type: 'DELETE_WORKOUT', workoutId: w.id });
              onClose();
            }}
          >
            Slet
          </ConfirmButton>
        </>
      }
    >
      <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
      {state.active ? (
        <ConfirmButton className="btn-primary wide repeat-btn" confirmText="Erstat igangværende træning?" onConfirm={repeat}>
          <span aria-hidden>🔁</span> Gentag
        </ConfirmButton>
      ) : (
        <button className="btn-primary wide repeat-btn" onClick={repeat}>
          <span aria-hidden>🔁</span> Gentag
        </button>
      )}
      {w.note && <p className="workout-note-full">📝 {w.note}</p>}
      {w.exercises.map((e) => (
        <section key={e.id} className="detail-ex">
          <h3>{exerciseById(e.exerciseId)?.name}</h3>
          {e.note && <p className="ex-note">📝 {e.note}</p>}
          <ol>
            {e.sets.map((s) => (
              <li key={s.id}>
                {formatSet(s, isBodyweightReps(state, e.exerciseId))}
                {s.rpe && <span className="muted"> @ RPE {s.rpe}</span>}
                {s.warmup && <span className="muted"> (opvarmning)</span>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Modal>
  );
}
