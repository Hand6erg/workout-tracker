import { useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { ConfirmButton, Empty } from '../components/ui';
import { doneSetCount, formatDuration, previousSets } from '../lib/logic';
import { useNow, useStore } from '../lib/store';
import type { WorkoutExercise } from '../lib/types';

export function ActiveWorkout({ onMinimize }: { onMinimize: () => void }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const w = state.active;
  if (!w) return null;

  const done = doneSetCount(w);

  return (
    <section className="workout" aria-label="Aktiv træning">
      <header className="workout-head">
        <button className="btn-ghost" onClick={onMinimize} aria-label="Minimér">
          ⌄
        </button>
        <span className="timer" data-testid="elapsed">
          {formatDuration(now - w.startedAt)}
        </span>
        <ConfirmButton
          className="btn-primary"
          confirmText={done ? 'Bekræft' : 'Ingen sæt – kassér?'}
          onConfirm={() => dispatch({ type: 'FINISH_WORKOUT', now: Date.now() })}
        >
          Afslut
        </ConfirmButton>
      </header>

      <div className="workout-body">
        <input
          className="title-input"
          aria-label="Navn på træning"
          value={w.name}
          onChange={(e) => dispatch({ type: 'RENAME_WORKOUT', name: e.target.value })}
        />

        {!w.exercises.length && <Empty>Tilføj din første øvelse for at komme i gang.</Empty>}

        {w.exercises.map((we) => (
          <ExerciseBlock key={we.id} we={we} />
        ))}

        <button className="btn-secondary wide" onClick={() => setPicking(true)}>
          + Tilføj øvelser
        </button>
        <ConfirmButton className="btn-danger wide" onConfirm={() => dispatch({ type: 'CANCEL_WORKOUT' })}>
          Annullér træning
        </ConfirmButton>
      </div>

      <RestBar />

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            dispatch({ type: 'ADD_EXERCISES', exerciseIds: ids });
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}

function ExerciseBlock({ we }: { we: WorkoutExercise }) {
  const { state, dispatch, exerciseById } = useStore();
  const ex = exerciseById(we.exerciseId);
  const prev = previousSets(state.history, we.exerciseId);

  return (
    <article className="ex-block" aria-label={ex?.name}>
      <header>
        <h3>{ex?.name ?? 'Ukendt øvelse'}</h3>
        <ConfirmButton className="btn-ghost small" confirmText="Fjern?" onConfirm={() => dispatch({ type: 'REMOVE_EXERCISE', weId: we.id })}>
          Fjern
        </ConfirmButton>
      </header>
      <table className="sets">
        <thead>
          <tr>
            <th>Sæt</th>
            <th>Forrige</th>
            <th>kg</th>
            <th>Reps</th>
            <th>RPE</th>
            <th aria-label="Udført">✓</th>
          </tr>
        </thead>
        <tbody>
          {we.sets.map((s, i) => {
            const p = prev[i];
            return (
              <tr key={s.id} className={s.done ? 'done' : ''}>
                <td>
                  <button
                    className="set-no"
                    title="Slet sæt"
                    onClick={() => dispatch({ type: 'REMOVE_SET', weId: we.id, setId: s.id })}
                  >
                    {i + 1}
                  </button>
                </td>
                <td className="prev">{p ? `${p.weight || 0}×${p.reps}` : '–'}</td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`Vægt sæt ${i + 1}`}
                    placeholder={p?.weight || ''}
                    value={s.weight}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { weight: e.target.value } })}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label={`Reps sæt ${i + 1}`}
                    placeholder={p?.reps || ''}
                    value={s.reps}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { reps: e.target.value } })}
                  />
                </td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`RPE sæt ${i + 1}`}
                    className="rpe"
                    value={s.rpe}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { rpe: e.target.value } })}
                  />
                </td>
                <td>
                  <button
                    className={`tick ${s.done ? 'on' : ''}`}
                    aria-label={`Udført sæt ${i + 1}`}
                    aria-pressed={s.done}
                    onClick={() => dispatch({ type: 'TOGGLE_SET', weId: we.id, setId: s.id, now: Date.now() })}
                  >
                    ✓
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="btn-secondary wide small" onClick={() => dispatch({ type: 'ADD_SET', weId: we.id })}>
        + Tilføj sæt
      </button>
    </article>
  );
}

function RestBar() {
  const { state, dispatch } = useStore();
  const now = useNow(!!state.rest);
  if (!state.rest) return null;
  const left = state.rest.endsAt - now;
  if (left <= 0) {
    return (
      <div className="rest done" role="status">
        <span>Pausen er slut 💪</span>
        <button className="btn-ghost small" onClick={() => dispatch({ type: 'SKIP_REST' })}>
          OK
        </button>
      </div>
    );
  }
  const pct = Math.min(100, (left / (state.rest.total * 1000)) * 100);
  return (
    <div className="rest" role="status" aria-label="Pausetimer">
      <div className="rest-fill" style={{ width: `${pct}%` }} />
      <button className="btn-ghost small" onClick={() => dispatch({ type: 'ADJUST_REST', delta: -15 })}>
        −15
      </button>
      <span className="rest-time">{formatDuration(left + 999)}</span>
      <button className="btn-ghost small" onClick={() => dispatch({ type: 'ADJUST_REST', delta: 15 })}>
        +15
      </button>
      <button className="btn-ghost small" onClick={() => dispatch({ type: 'SKIP_REST' })}>
        Spring over
      </button>
    </div>
  );
}
