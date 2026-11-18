import { createContext, Fragment, useContext, useState, type ReactNode } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestPicker, formatRest } from '../components/RestPicker';
import { SwapPicker } from '../components/SwapPicker';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import {
  canSwapInTemplate,
  doneSetCount,
  exerciseKind,
  isSetFilled,
  formatClock,
  formatDuration,
  parseClock,
  stopwatchSeconds,
  lastExerciseNote,
  NOTE_MAX,
  num,
  previousSetsFor,
  progressionHint,
  restFor,
  recordsBrokenBy,
  supersetGroups,
  uncheckedFilledCount,
  warmupBaseWeight,
  workoutDuration,
  workoutTimingError,
  type Action,
  type ProgressionHint,
  type RecordKind,
  type WorkoutChange,
} from '../lib/logic';
import { useNow, useStore } from '../lib/store';
import type { AppState, ExerciseKind, SetEntry, Workout, WorkoutExercise } from '../lib/types';

/**
 * Den træning, der vises i editoren: enten den aktive træning eller en kladde af en afsluttet træning (#92).
 * `base` er tilstanden, som "forrige", rekorder og opvarmning beregnes ud fra (ved en kladde: træningerne før den).
 */
interface WorkoutCtxValue {
  w: Workout;
  base: AppState;
  edit: boolean;
  send: (a: WorkoutChange) => void;
}
const WorkoutCtx = createContext<WorkoutCtxValue | null>(null);
const useWorkout = () => useContext(WorkoutCtx)!;

export function ActiveWorkout({ onMinimize }: { onMinimize: () => void }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [finishing, setFinishing] = useState(false);
  const w = state.active;
  if (!w) return null;

  const done = doneSetCount(w);
  const unchecked = uncheckedFilledCount(w, state);
  const finish = (includeUnchecked: boolean) => dispatch({ type: 'FINISH_WORKOUT', now: Date.now(), includeUnchecked });

  return (
    <WorkoutCtx.Provider value={{ w, base: state, edit: false, send: dispatch }}>
    <section className="workout" aria-label="Aktiv træning">
      <header className="workout-head">
        <button className="btn-ghost" onClick={onMinimize} aria-label="Minimér">
          ⌄
        </button>
        <span className={`timer ${w.pausedAt ? 'paused' : ''}`} data-testid="elapsed">
          {formatDuration(workoutDuration(w, now))}
        </span>
        <button
          className="btn-ghost small"
          aria-pressed={!!w.pausedAt}
          onClick={() => dispatch({ type: w.pausedAt ? 'RESUME_WORKOUT' : 'PAUSE_WORKOUT', now: Date.now() })}
        >
          {w.pausedAt ? '▶ Fortsæt' : '⏸ Pause'}
        </button>
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

      {w.pausedAt && (
        <p className="paused-banner" role="status">
          Træningen er sat på pause – uret står stille.
        </p>
      )}
      <WorkoutBody>
        <ConfirmButton className="btn-danger wide" onConfirm={() => dispatch({ type: 'CANCEL_WORKOUT' })}>
          Annullér træning
        </ConfirmButton>
      </WorkoutBody>

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
    </section>
    </WorkoutCtx.Provider>
  );
}

/** Retter en afsluttet træning (#92): samme editor som under træningen, men med "Gem" og "Annullér" og uden pausetimer */
export function WorkoutEditor() {
  const { state, dispatch } = useStore();
  const w = state.editing;
  if (!w) return null;
  const base: AppState = {
    ...state,
    history: state.history.filter((x) => x.id !== w.id && x.startedAt < w.startedAt),
    active: null,
    rest: null,
  };
  const send = (a: WorkoutChange) => dispatch({ ...a, edit: true } as Action);
  const hasSets = w.exercises.some((e) => e.sets.some((x) => x.done || isSetFilled(x, exerciseKind(state, e.exerciseId))));
  const [timingError, setTimingError] = useState<string | null>(null);
  const error = w.name.trim() ? timingError : 'Træningen skal have et navn.';
  const canSave = hasSets && !error;

  return (
    <WorkoutCtx.Provider value={{ w, base, edit: true, send }}>
      <section className="workout" aria-label="Redigér træning">
        <header className="workout-head">
          <button className="btn-ghost" onClick={() => dispatch({ type: 'CANCEL_EDIT' })}>
            Annullér
          </button>
          <strong className="edit-title">Redigér træning</strong>
          <button className="btn-primary" disabled={!canSave} onClick={() => dispatch({ type: 'SAVE_EDIT' })}>
            Gem
          </button>
        </header>
        <WorkoutBody top={<WorkoutTiming w={w} onError={setTimingError} />}>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!hasSets && (
            <p className="muted" role="status">
              Udfyld mindst ét sæt for at gemme – vil du fjerne hele træningen, så brug "Slet" i Historik.
            </p>
          )}
        </WorkoutBody>
      </section>
    </WorkoutCtx.Provider>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateValue = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeValue = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Dato, starttid og varighed for en træning, der rettes bagefter (#93) */
function WorkoutTiming({ w, onError }: { w: Workout; onError: (msg: string | null) => void }) {
  const { dispatch } = useStore();
  const [date, setDate] = useState(() => dateValue(w.startedAt));
  const [time, setTime] = useState(() => timeValue(w.startedAt));
  const [minutes, setMinutes] = useState(() => String(Math.max(1, Math.round(workoutDuration(w, w.startedAt) / 60_000))));

  const apply = (d: string, t: string, m: string) => {
    const [y, mo, day] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    const startedAt = d && t ? new Date(y, mo - 1, day, h, mi).getTime() : NaN;
    const durationMin = m.trim() === '' ? NaN : Number(m.replace(',', '.'));
    const now = Date.now();
    const err = workoutTimingError(w.name || '-', startedAt, Number.isNaN(durationMin) ? 0 : durationMin, now);
    onError(err);
    if (!err) dispatch({ type: 'SET_EDIT_TIMING', startedAt, durationMin, now });
  };

  return (
    <div className="timing-grid" role="group" aria-label="Tidspunkt">
      <label className="field">
        Dato
        <input
          type="date"
          value={date}
          max={dateValue(Date.now())}
          onChange={(e) => {
            setDate(e.target.value);
            apply(e.target.value, time, minutes);
          }}
        />
      </label>
      <label className="field">
        Starttid
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            apply(date, e.target.value, minutes);
          }}
        />
      </label>
      <label className="field">
        Varighed (min)
        <input
          inputMode="numeric"
          value={minutes}
          onChange={(e) => {
            setMinutes(e.target.value);
            apply(date, time, e.target.value);
          }}
        />
      </label>
    </div>
  );
}

/** Navn, øvelser, "Tilføj øvelser" og note – fælles for den aktive træning og editoren */
function WorkoutBody({ children, top }: { children?: ReactNode; top?: ReactNode }) {
  const { exerciseById } = useStore();
  const { w, send } = useWorkout();
  const [picking, setPicking] = useState(false);
  return (
    <div className="workout-body">
      <input
        className="title-input"
        aria-label="Navn på træning"
        value={w.name}
        onChange={(e) => send({ type: 'RENAME_WORKOUT', name: e.target.value })}
      />
      {top}

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
      <WorkoutNote />
      {children}
      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            send({ type: 'ADD_EXERCISES', exerciseIds: ids });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/** "Forrige"-kolonnen i samme format som sættet */
function prevText(p: SetEntry, kind: ExerciseKind): string {
  if (kind === 'time') return p.seconds ? `${num(p.seconds)} sek.` : '–';
  if (kind === 'distance') return p.meters ? `${p.meters.replace('.', ',')} m${p.seconds ? ` · ${formatClock(num(p.seconds))}` : ''}` : '–';
  return `${p.weight || 0}×${p.reps}`;
}

/** Felt til en tid som m:ss. Mens man skriver, vises teksten som skrevet; sættet gemmer sekunder. */
function ClockInput({
  label,
  seconds,
  placeholder,
  onChange,
}: {
  label: string;
  seconds: string;
  placeholder: string;
  onChange: (seconds: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (seconds.trim() ? formatClock(num(seconds)) : '');
  return (
    <input
      inputMode="text"
      aria-label={label}
      placeholder={placeholder}
      value={shown}
      onChange={(e) => {
        setDraft(e.target.value);
        const sec = parseClock(e.target.value);
        onChange(sec === null ? '' : String(sec));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function recordText(kinds: RecordKind[], weight: string): string {
  const names = kinds.map((k) =>
    k === 'heaviest'
      ? 'tungeste vægt'
      : k === '1rm'
        ? 'estimeret 1RM'
        : k === 'hold'
          ? 'længste hold'
          : k === 'distance'
            ? 'længste distance'
            : k === 'pace'
              ? 'hurtigste tid'
              : `flest reps på ${num(weight) || 0} kg`,
  );
  return `Ny rekord: ${names.join(', ')}`;
}

const kgText = (n: number) => String(n).replace('.', ',');

function HintButton({ weId, hint }: { weId: string; hint: ProgressionHint }) {
  if (hint.timed) return <TimedHintButton weId={weId} timed={hint.timed} />;
  return <RepsHintButton weId={weId} hint={hint} />;
}

/** Afslutter en tekst med punktum, uden at "sek." får to */
const sentence = (t: string) => (t.endsWith('.') ? t : `${t}.`);

/** Forslag for tids- og distanceøvelser (#136) */
function TimedHintButton({ weId, timed }: { weId: string; timed: NonNullable<ProgressionHint['timed']> }) {
  const { send: dispatch } = useWorkout();
  const { last, next } = timed;
  const lastText = timed.kind === 'time' ? `${last.seconds} sek.` : `${kgText(last.meters)} m på ${formatClock(last.seconds)}`;
  const nextText = timed.kind === 'time' ? `${next.seconds} sek.` : `${kgText(next.meters)} m på ${formatClock(next.seconds)}`;
  return (
    <button
      className="hint"
      aria-label={`Sidst: ${sentence(lastText)} Prøv ${sentence(nextText)} Tryk for at udfylde.`}
      onClick={() =>
        dispatch({ type: 'APPLY_HINT', weId, weight: 0, reps: 0, seconds: next.seconds, meters: next.meters || undefined })
      }
    >
      Sidst: {lastText} → <strong>prøv {nextText}</strong>
    </button>
  );
}

function RepsHintButton({ weId, hint }: { weId: string; hint: ProgressionHint }) {
  const { send: dispatch } = useWorkout();
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
  const { exerciseById } = useStore();
  const { w, base: state, edit, send: dispatch } = useWorkout();
  const ex = exerciseById(we.exerciseId);
  const prev = previousSetsFor(state.history, w, we.exerciseId);
  const kind = exerciseKind(state, we.exerciseId);
  const now = useNow(we.sets.some((x) => !!x.timerStartedAt));
  const hint = state.showHints && !edit ? progressionHint(state, we.exerciseId) : null;
  const [warmupMsg, setWarmupMsg] = useState(false);
  const isBarbell = ex?.equipment === 'Stang';
  const all = w.exercises;
  const pos = all.findIndex((e) => e.id === we.id);
  const next = all[pos + 1];
  const canLink = !!next && !(we.supersetId && we.supersetId === next.supersetId);
  const lastNote = lastExerciseNote(state.history, we.exerciseId);
  const [noteOpen, setNoteOpen] = useState(!!we.note);
  const [noteDraft, setNoteDraft] = useState(we.note ?? '');
  const name = ex?.name ?? 'Ukendt øvelse';
  const [restOpen, setRestOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  // Øvelsen fra skabelonen før byttet (#128) – null = ikke byttet, eller valget er truffet
  const [swappedFrom, setSwappedFrom] = useState<string | null>(null);
  const [savedInTemplate, setSavedInTemplate] = useState(false);
  const { state: live, dispatch: liveDispatch } = useStore();
  const askTemplate =
    !edit && !!swappedFrom && swappedFrom !== we.exerciseId && canSwapInTemplate(live, w.templateId, swappedFrom);
  const templateName = live.templates.find((t) => t.id === w.templateId)?.name ?? '';
  const restLabel = formatRest(restFor(live, we.exerciseId));

  return (
    <article className="ex-block" aria-label={ex?.name}>
      <header>
        <h3>{name}</h3>
        {!edit && ex && (
          <button className="btn-ghost small rest-btn" aria-label={`Pause for ${name}: ${restLabel}`} onClick={() => setRestOpen(true)}>
            ⏱ {restLabel}
          </button>
        )}
        <button
          className="btn-ghost small"
          aria-expanded={noteOpen}
          aria-label={`Note til ${name}`}
          onClick={() => setNoteOpen((o) => !o)}
        >
          Note
        </button>
        <button className="btn-ghost small" aria-label={`Byt ${name}`} onClick={() => setSwapOpen(true)}>
          Byt
        </button>
        <ConfirmButton className="btn-ghost small" confirmText="Fjern?" onConfirm={() => dispatch({ type: 'REMOVE_EXERCISE', weId: we.id })}>
          Fjern
        </ConfirmButton>
      </header>
      {restOpen && <RestPicker exerciseId={we.exerciseId} onClose={() => setRestOpen(false)} />}
      {swapOpen && (
        <SwapPicker
          exerciseId={we.exerciseId}
          workout={w}
          onClose={() => setSwapOpen(false)}
          onPick={(exerciseId) => {
            dispatch({ type: 'SWAP_EXERCISE', weId: we.id, exerciseId });
            setSwappedFrom((f) => f ?? we.exerciseId);
            setSavedInTemplate(false);
            setSwapOpen(false);
          }}
        />
      )}
      {askTemplate && (
        <div className="swap-ask" role="group" aria-label="Gem byttet">
          <span>
            {exerciseById(swappedFrom!)?.name} → {name}. Også i skabelonen "{templateName}"?
          </span>
          <button className="btn-ghost small" onClick={() => setSwappedFrom(null)}>
            Kun i dag
          </button>
          <button
            className="btn-primary small"
            onClick={() => {
              liveDispatch({ type: 'SWAP_IN_TEMPLATE', templateId: w.templateId!, fromExerciseId: swappedFrom!, toExerciseId: we.exerciseId });
              setSwappedFrom(null);
              setSavedInTemplate(true);
            }}
          >
            Gem i skabelonen
          </button>
        </div>
      )}
      {savedInTemplate && (
        <p className="swap-saved" role="status">
          ✓ Gemt i skabelonen "{templateName}"
        </p>
      )}
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
            {kind === 'reps' && (
              <>
                <th>kg</th>
                <th>Reps</th>
                <th>RPE</th>
              </>
            )}
            {kind === 'time' && <th colSpan={2}>Sek.</th>}
            {kind === 'distance' && (
              <>
                <th>Meter</th>
                <th>Tid</th>
              </>
            )}
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
                <td className="prev">{p ? prevText(p, kind) : '–'}</td>
                {kind === 'time' && (
                  <>
                    <td>
                      <input
                        inputMode="numeric"
                        aria-label={`Sekunder ${what} ${i + 1}`}
                        placeholder={p?.seconds || ''}
                        value={s.timerStartedAt ? String(stopwatchSeconds(s, now)) : (s.seconds ?? '')}
                        readOnly={!!s.timerStartedAt}
                        onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { seconds: e.target.value } })}
                      />
                    </td>
                    <td>
                      {!edit && !s.done && (
                        <button
                          className={`stopwatch ${s.timerStartedAt ? 'running' : ''}`}
                          aria-label={`${s.timerStartedAt ? 'Stop' : 'Start'} stopur ${what} ${i + 1}`}
                          onClick={() =>
                            dispatch({
                              type: s.timerStartedAt ? 'STOP_SET_TIMER' : 'START_SET_TIMER',
                              weId: we.id,
                              setId: s.id,
                              now: Date.now(),
                            })
                          }
                        >
                          {s.timerStartedAt ? '■ Stop' : '▶ Start'}
                        </button>
                      )}
                    </td>
                  </>
                )}
                {kind === 'distance' && (
                  <>
                    <td>
                      <input
                        inputMode="decimal"
                        aria-label={`Meter ${what} ${i + 1}`}
                        placeholder={p?.meters || ''}
                        value={s.meters ?? ''}
                        onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { meters: e.target.value } })}
                      />
                    </td>
                    <td>
                      <ClockInput
                        label={`Tid ${what} ${i + 1}`}
                        seconds={s.seconds ?? ''}
                        placeholder={p?.seconds ? formatClock(num(p.seconds)) : 'm:ss'}
                        onChange={(sec) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { seconds: sec } })}
                      />
                    </td>
                  </>
                )}
                {kind === 'reps' && (
                <>
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
                </>
                )}
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
          onClick={() => {
            const base = warmupBaseWeight(state.history, we);
            setWarmupMsg(!base);
            if (base) dispatch({ type: 'ADD_WARMUP_SETS', weId: we.id });
          }}
        >
          {we.sets.some((x) => x.warmup) ? 'Beregn opvarmning igen' : 'Tilføj opvarmning'}
        </button>
      )}
      </div>
      {warmupMsg && !warmupBaseWeight(state.history, we) && (
        <p className="warmup-msg" role="status">
          Skriv vægten i sæt 1 først – så beregnes opvarmningen ud fra den.
        </p>
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

/** Note til hele træningen (fx "sov dårligt") – vises på kortet i Historik */
function WorkoutNote() {
  const { w, send: dispatch } = useWorkout();
  // Lokal kladde, så mellemrum mens man skriver ikke forsvinder (noten renses i reduceren)
  const [draft, setDraft] = useState(w.note ?? '');
  return (
    <label className="workout-note">
      <span>Note til træningen</span>
      <textarea
        className="note-input"
        placeholder="Fx sov dårligt, ny PR-dag …"
        maxLength={NOTE_MAX}
        rows={2}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          dispatch({ type: 'SET_WORKOUT_NOTE', note: e.target.value });
        }}
      />
    </label>
  );
}
