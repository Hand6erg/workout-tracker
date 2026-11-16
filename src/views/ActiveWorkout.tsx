import { Fragment, useState } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { PlateDialog } from '../components/PlateDialog';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import {
  doneSetCount,
  formatDuration,
  lastExerciseNote,
  NOTE_MAX,
  num,
  previousSets,
  progressionHint,
  recordsBrokenBy,
  supersetGroups,
  uncheckedFilledCount,
  type ProgressionHint,
  type RecordKind,
} from '../lib/logic';
import { useNow, useStore } from '../lib/store';
import type { WorkoutExercise } from '../lib/types';

export function ActiveWorkout({ onMinimize }: { onMinimize: () => void }) {
  const { state, dispatch, exerciseById } = useStore();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const w = state.active;
  if (!w) return null;

  const done = doneSetCount(w);
  const unchecked = uncheckedFilledCount(w);
  const finish = (includeUnchecked: boolean) => dispatch({ type: 'FINISH_WORKOUT', now: Date.now(), includeUnchecked });

  return (
    <section className="workout" aria-label="Aktiv træning">
      <header className="workout-head">
        <button className="btn-ghost" onClick={onMinimize} aria-label="Minimér">
          ⌄
        </button>
        <span className="timer" data-testid="elapsed">
          {formatDuration(now - w.startedAt)}
        </span>
        {unchecked > 0 ? (
          <button className="btn-primary" onClick={() => setFinishing(true)}>
            Afslut
          </button>
        ) : (
          <ConfirmButton
            className="btn-primary"
            confirmText={done ? 'Bekræft' : 'Intet udfyldt – kassér?'}
            onConfirm={() => finish(false)}
          >
            Afslut
          </ConfirmButton>
        )}
      </header>

      <div className="workout-body">
        <input
          className="title-input"
          aria-label="Navn på træning"
          value={w.name}
          onChange={(e) => dispatch({ type: 'RENAME_WORKOUT', name: e.target.value })}
        />

        {!w.exercises.length && <Empty>Tilføj din første øvelse for at komme i gang.</Empty>}

        {supersetGroups(w.exercises).map((g) =>
          g.length > 1 ? (
            <div
              key={g[0].supersetId}
              className="superset"
              role="group"
              aria-label={`Supersæt: ${g.map((e) => exerciseById(e.exerciseId)?.name ?? '').join(' + ')}`}
            >
              <span className="superset-tag">Supersæt</span>
              {g.map((we) => (
                <ExerciseBlock key={we.id} we={we} />
              ))}
            </div>
          ) : (
            <ExerciseBlock key={g[0].id} we={g[0]} />
          ),
        )}

        <button className="btn-secondary wide" onClick={() => setPicking(true)}>
          + Tilføj øvelser
        </button>
        <ConfirmButton className="btn-danger wide" onConfirm={() => dispatch({ type: 'CANCEL_WORKOUT' })}>
          Annullér træning
        </ConfirmButton>
      </div>

      <RestBar />

      {finishing && (
        <Modal title="Afslut træning" onClose={() => setFinishing(false)}>
          <div className="stack">
            <p>
              {unchecked === 1 ? '1 sæt er udfyldt' : `${unchecked} sæt er udfyldt`}, men ikke krydset af. Skal de gemmes
              med?
            </p>
            <button className="btn-primary wide" onClick={() => finish(true)}>
              Gem alle udfyldte sæt
            </button>
            {done > 0 && (
              <button className="btn-secondary wide" onClick={() => finish(false)}>
                Gem kun afkrydsede sæt ({done})
              </button>
            )}
            <button className="btn-secondary wide" onClick={() => setFinishing(false)}>
              Fortsæt træningen
            </button>
          </div>
        </Modal>
      )}
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

function recordText(kinds: RecordKind[], weight: string): string {
  const names = kinds.map((k) =>
    k === 'heaviest' ? 'tungeste vægt' : k === '1rm' ? 'estimeret 1RM' : `flest reps på ${num(weight) || 0} kg`,
  );
  return `Ny rekord: ${names.join(', ')}`;
}

const kgText = (n: number) => String(n).replace('.', ',');

function HintButton({ weId, hint }: { weId: string; hint: ProgressionHint }) {
  const { dispatch } = useStore();
  const { last, next } = hint;
  const same = last.repsList.every((r) => r === last.reps);
  const repsText = same ? `${last.sets} × ${last.reps}` : `${last.repsList.join(', ')} reps`;
  const lastText = `${repsText}${last.weight ? ` @ ${kgText(last.weight)} kg` : ''}`;
  const nextText = next.weight && next.weight !== last.weight ? `${kgText(next.weight)} kg` : `${next.reps} reps`;
  return (
    <button
      className="hint"
      aria-label={`Sidst: ${lastText}. Prøv ${hint.increase ? nextText : 'det samme igen'}. Tryk for at udfylde.`}
      onClick={() => dispatch({ type: 'APPLY_HINT', weId, weight: next.weight, reps: next.reps })}
    >
      Sidst: {lastText} → {hint.increase ? <strong>prøv {nextText}</strong> : 'prøv det samme igen'}
    </button>
  );
}

function ExerciseBlock({ we }: { we: WorkoutExercise }) {
  const { state, dispatch, exerciseById } = useStore();
  const ex = exerciseById(we.exerciseId);
  const prev = previousSets(state.history, we.exerciseId);
  const hint = state.showHints ? progressionHint(state, we.exerciseId) : null;
  const [plates, setPlates] = useState(false);
  const isBarbell = ex?.equipment === 'Stang';
  const all = state.active?.exercises ?? [];
  const pos = all.findIndex((e) => e.id === we.id);
  const next = all[pos + 1];
  const canLink = !!next && !(we.supersetId && we.supersetId === next.supersetId);
  const lastWeight = [...we.sets].reverse().find((s) => s.weight)?.weight ?? '';
  const lastNote = lastExerciseNote(state.history, we.exerciseId);
  const [noteOpen, setNoteOpen] = useState(!!we.note);
  const [noteDraft, setNoteDraft] = useState(we.note ?? '');
  const name = ex?.name ?? 'Ukendt øvelse';

  return (
    <article className="ex-block" aria-label={ex?.name}>
      <header>
        <h3>{name}</h3>
        <button
          className="btn-ghost small"
          aria-expanded={noteOpen}
          aria-label={`Note til ${name}`}
          onClick={() => setNoteOpen((o) => !o)}
        >
          Note
        </button>
        {isBarbell && (
          <button className="btn-ghost small" onClick={() => setPlates(true)}>
            Skiver
          </button>
        )}
        <ConfirmButton className="btn-ghost small" confirmText="Fjern?" onConfirm={() => dispatch({ type: 'REMOVE_EXERCISE', weId: we.id })}>
          Fjern
        </ConfirmButton>
      </header>
      {hint && <HintButton weId={we.id} hint={hint} />}
      {lastNote && <p className="last-note">📝 Sidst: {lastNote.note}</p>}
      {noteOpen && (
        <textarea
          className="note-input"
          aria-label={`Skriv note til ${name}`}
          placeholder="Fx sædehøjde 4"
          maxLength={NOTE_MAX}
          rows={2}
          value={noteDraft}
          onChange={(e) => {
            setNoteDraft(e.target.value);
            dispatch({ type: 'SET_EXERCISE_NOTE', weId: we.id, note: e.target.value });
          }}
        />
      )}
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
          {we.sets.map((s, idx) => {
            // Opvarmningssæt nummereres for sig ("O"), så arbejdssæt beholder 1, 2, 3 …
            const before = we.sets.slice(0, idx);
            const i = before.filter((x) => x.warmup === s.warmup).length;
            const what = s.warmup ? 'opvarmning' : 'sæt';
            const p = s.warmup ? undefined : prev[i];
            const records = s.done ? recordsBrokenBy(state, we.exerciseId, s) : [];
            return (
              <Fragment key={s.id}>
              <tr className={`${s.done ? 'done' : ''} ${s.warmup ? 'warmup' : ''}`}>
                <td>
                  <button
                    className="set-no"
                    title="Slet sæt"
                    aria-label={`Slet ${what} ${i + 1}`}
                    onClick={() => dispatch({ type: 'REMOVE_SET', weId: we.id, setId: s.id })}
                  >
                    {s.warmup ? 'O' : i + 1}
                  </button>
                </td>
                <td className="prev">{p ? `${p.weight || 0}×${p.reps}` : '–'}</td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`Vægt ${what} ${i + 1}`}
                    placeholder={p?.weight || ''}
                    value={s.weight}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { weight: e.target.value } })}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label={`Reps ${what} ${i + 1}`}
                    placeholder={p?.reps || ''}
                    value={s.reps}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { reps: e.target.value } })}
                  />
                </td>
                <td>
                  <input
                    inputMode="decimal"
                    aria-label={`RPE ${what} ${i + 1}`}
                    className="rpe"
                    value={s.rpe}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { rpe: e.target.value } })}
                  />
                </td>
                <td>
                  <button
                    className={`tick ${s.done ? 'on' : ''}`}
                    aria-label={`Udført ${what} ${i + 1}`}
                    aria-pressed={s.done}
                    onClick={() => dispatch({ type: 'TOGGLE_SET', weId: we.id, setId: s.id, now: Date.now() })}
                  >
                    ✓
                  </button>
                </td>
              </tr>
              {records.length > 0 && (
                <tr className="pr-row">
                  <td colSpan={6}>
                    <span role="img" aria-label={recordText(records, s.weight)}>
                      🏆
                    </span>{' '}
                    {recordText(records, s.weight)}
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <button className="btn-secondary wide small" onClick={() => dispatch({ type: 'ADD_SET', weId: we.id })}>
        + Tilføj sæt
      </button>
      <div className="ex-actions">
        {canLink && (
          <button className="btn-ghost small" onClick={() => dispatch({ type: 'LINK_SUPERSET', weId: we.id })}>
            Supersæt med næste
          </button>
        )}
        {we.supersetId && (
          <button className="btn-ghost small" onClick={() => dispatch({ type: 'UNLINK_SUPERSET', weId: we.id })}>
            Fjern fra supersæt
          </button>
        )}
      {isBarbell && (
        <button
          className="btn-ghost small"
          disabled={!we.sets.some((x) => !x.warmup && num(x.weight) > 0)}
          onClick={() => dispatch({ type: 'ADD_WARMUP_SETS', weId: we.id })}
        >
          {we.sets.some((x) => x.warmup) ? 'Beregn opvarmning igen' : 'Tilføj opvarmning'}
        </button>
      )}
      </div>
      {plates && (
        <PlateDialog
          initialWeight={lastWeight}
          barWeight={state.barWeight}
          plates={state.plates}
          onClose={() => setPlates(false)}
        />
      )}
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
