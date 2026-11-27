import { SetTargetRings } from '../components/SetTargets';
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestPicker, formatRest } from '../components/RestPicker';
import { FinisherList, IntervalBar, IntervalButton } from '../components/IntervalTimer';
import { SwapPicker } from '../components/SwapPicker';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import {
  exerciseCues,
  canSwapInTemplate,
  doneSetCount,
  exerciseKind,
  isSetFilled,
  formatClock,
  actualRests,
  formatDuration,
  timeLeftEstimate,
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
  vsLastTime,
  vsRowCells,
  warmupBaseWeight,
  workoutDuration,
  workoutTimingError,
  type Action,
  type ProgressionHint,
  type RecordKind,
  type VsLastTime,
  type VsStatus,
  type WorkoutChange,
  bodyweightText,
  formatWeight,
  toDisplay,
  weightFromInput,
  weightInputText,
  bodyWeightOn,
  isBodyweightReps,
  formatRpe,
  parseRpe,
  setLabel,
  SET_TAGS,
  formatRepRange,
} from '../lib/logic';
import type { SetTag, WeightUnit } from '../lib/types';
import { useNow, useStore, useUnit } from '../lib/store';
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
  /** Sammenligning med sidst (#176). Kun i den aktive træning. */
  vs?: VsLastTime | null;
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
  const vs = vsLastTime(state, w);
  const timeLeft = state.showTimeLeft !== false ? timeLeftEstimate(state, now) : null;

  return (
    <WorkoutCtx.Provider value={{ w, base: state, edit: false, send: dispatch, vs }}>
    <section className="workout" aria-label="Aktiv træning">
      <header className="workout-head">
        <button className="btn-ghost" onClick={onMinimize} aria-label="Minimér">
          ⌄
        </button>
        <span className="timer-wrap">
          <span className={`timer ${w.pausedAt ? 'paused' : ''}`} data-testid="elapsed">
            {formatDuration(workoutDuration(w, now))}
          </span>
          {timeLeft !== null && <span className="time-left">ca. {timeLeft} min tilbage</span>}
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
            confirmText={done || w.finishers?.length ? 'Bekræft' : 'Intet udfyldt – kassér?'}
            onConfirm={() => finish(false)}
          >
            Afslut
          </ConfirmButton>
        )}
      </header>

      <SetTargetRings compact />

      {w.pausedAt && (
        <p className="paused-banner" role="status">
          Træningen er sat på pause – uret står stille.
        </p>
      )}
      <WorkoutBody top={vs?.started ? <VsLastBar vs={vs} /> : null}>
        <FinisherList finishers={w.finishers} onRemove={(finisherId) => dispatch({ type: 'REMOVE_FINISHER', finisherId })} />
        <IntervalButton />
        <ConfirmButton className="btn-danger wide" onConfirm={() => dispatch({ type: 'CANCEL_WORKOUT' })}>
          Annullér træning
        </ConfirmButton>
      </WorkoutBody>

      <IntervalBar />
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

const VS_MARKS: Record<VsStatus, { icon: string; label: string }> = {
  up: { icon: '▲', label: 'Slog sidst' },
  same: { icon: '●', label: 'Som sidst' },
  down: { icon: '▼', label: 'Under sidst' },
};

/** ▲ ● ▼ ved øvelsens navn, når alle dens sæt er krydset af (#176) */
function VsMark({ status }: { status: VsStatus }) {
  const m = VS_MARKS[status];
  return (
    <span className={`vs-mark ${status}`} role="img" aria-label={m.label} title={m.label}>
      {m.icon}
    </span>
  );
}

/** "+320 kg vs. sidst" – løbende forskel mod sidste gang samme skabelon blev lavet (#176) */
function vsBarText(diffKg: number, unit: WeightUnit = 'kg'): string {
  if (diffKg === 0) return 'Som sidst';
  const sign = diffKg > 0 ? '+' : '−';
  const v = Math.abs(unit === 'lb' ? toDisplay(diffKg, 'lb') : diffKg);
  return `${sign}${v.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ${unit} vs. sidst`;
}

function VsLastBar({ vs }: { vs: VsLastTime }) {
  const unit = useStore().state.unit ?? 'kg';
  const [open, setOpen] = useState(false);
  const tone = vs.diffKg > 0 ? 'up' : vs.diffKg < 0 ? 'down' : 'same';
  return (
    <>
      <button
        type="button"
        className={`vs-bar ${tone}`}
        aria-label={`Mod sidst: ${vsBarText(vs.diffKg, unit)}. Vis pr. øvelse`}
        aria-haspopup="dialog"
        data-testid="vs-bar"
        onClick={() => setOpen(true)}
      >
        {vsBarText(vs.diffKg, unit)}
      </button>
      {open && <VsLastSheet vs={vs} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Oversigt pr. øvelse: denne gang / sidst (#177) */
function VsLastSheet({ vs, onClose }: { vs: VsLastTime; onClose: () => void }) {
  const unit = useUnit();
  const date = new Date(vs.previousDate).toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'long' });
  return (
    <Modal title="Mod sidst" onClose={onClose}>
      <p className="muted vs-sheet-date">Sammenlignet med {date}</p>
      <table className="vs-table">
        <thead>
          <tr>
            <th scope="col">Øvelse</th>
            <th scope="col">I dag</th>
            <th scope="col">Sidst</th>
            <th scope="col"><span className="sr-only">Status</span></th>
          </tr>
        </thead>
        <tbody>
          {vs.rows.map((r) => {
            const c = vsRowCells(r, unit);
            return (
              <tr key={r.weId} aria-label={r.name}>
                <th scope="row">{r.name}</th>
                <td>{c.now}</td>
                <td className={r.last === null ? 'vs-new' : undefined}>{c.last}</td>
                <td>{r.status && <VsMark status={r.status} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

/** "Forrige"-kolonnen i samme format som sættet */
function prevText(p: SetEntry, kind: ExerciseKind, bodyweight = false, unit: WeightUnit = 'kg'): string {
  if (bodyweight && kind === 'reps') return `${bodyweightText(p.weight, unit)}×${p.reps}`;
  if (kind === 'time') return p.seconds ? `${num(p.seconds)} sek.` : '–';
  if (kind === 'distance') return p.meters ? `${p.meters.replace('.', ',')} m${p.seconds ? ` · ${formatClock(num(p.seconds))}` : ''}` : '–';
  return `${weightInputText(p.weight, unit) || 0}×${p.reps}`;
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

/**
 * Vægtfelt (#345): sættet gemmer kg, men feltet viser og tager imod den valgte enhed.
 * Mens man skriver, vises teksten som skrevet; ændres vægten udefra (fx et forslag), vises den gemte værdi.
 */
function WeightInput({
  label,
  weight,
  unit,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  weight: string;
  unit: WeightUnit;
  placeholder: string;
  inputMode: 'text' | 'decimal';
  onChange: (kg: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (draft !== null && weightFromInput(draft, unit) !== weight) setDraft(null);
  }, [weight, unit]);
  return (
    <input
      inputMode={inputMode}
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? weightInputText(weight, unit)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(weightFromInput(e.target.value, unit));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function recordText(kinds: RecordKind[], weight: string, bodyweight = false, unit: WeightUnit = 'kg'): string {
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
              : `flest reps på ${bodyweight ? bodyweightText(weight, unit) : formatWeight(num(weight), unit)}`,
  );
  return `Ny rekord: ${names.join(', ')}`;
}

const kgText = (n: number) => String(n).replace('.', ',');

/**
 * RPE-felt (#238): kun gyldige værdier (6–10 i halve trin) gemmes. En ugyldig værdi bliver stående i feltet
 * med rød ramme og "RPE 6–10", men gemmes som tom, så den aldrig påvirker forslag eller historik.
 */
function RpeInput({ label, value, onChange }: { label: string; value: string; onChange: (rpe: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const valid = (t: string) => t.trim() === '' || parseRpe(t) !== null;
  // Ændret udefra (fx Fortryd eller hint): vis den gemte værdi
  useEffect(() => {
    if ((valid(draft) ? draft : '') !== value) setDraft(value);
  }, [value]);
  const invalid = !valid(draft);
  const showError = invalid && !focused;
  return (
    <>
      <input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={showError || undefined}
        className={`rpe ${showError ? 'invalid' : ''}`}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const t = e.target.value;
          setDraft(t);
          const next = valid(t) ? t.trim() : '';
          if (next !== value) onChange(next);
        }}
      />
      {showError && (
        <small className="rpe-error" role="alert">
          RPE 6–10
        </small>
      )}
    </>
  );
}

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
  const unit = useStore().state.unit ?? 'kg';
  const { last, next } = hint;
  const same = last.repsList.every((r) => r === last.reps);
  const repsText = same ? `${last.sets} × ${last.reps}` : `${last.repsList.join(', ')} reps`;
  // Kropsvægtsøvelser (#209): "@ KV +10" og "prøv KV −17,5"
  const w = (n: number) =>
    hint.bodyweight ? bodyweightText(String(n), unit) : unit === 'lb' ? formatWeight(n, 'lb') : `${kgText(n)} kg`;
  // RPE (#238): forklar hvorfor forslaget blev ændret, fx "(RPE 10)"
  const rpeText = hint.rpe !== undefined ? ` (RPE ${formatRpe(String(hint.rpe))})` : '';
  const lastText = `${repsText}${last.weight ? ` @ ${w(last.weight)}` : ''}${rpeText}`;
  const nextText = next.weight !== last.weight ? w(next.weight) : `${next.reps} reps`;
  // Dobbelt progression (#259): "Alle sæt nåede 12 – prøv 62,5 kg × 8" / "Bliv på 60 kg og gå efter 10 reps"
  if (hint.range) {
    const weightText = next.weight ? w(next.weight) : '';
    const advice = hint.range.topReached
      ? `Alle sæt nåede ${hint.range.max} – prøv ${weightText ? `${weightText} × ` : ''}${next.reps}`
      : `${weightText ? `Bliv på ${weightText} og gå` : 'Gå'} efter ${next.reps} reps`;
    return (
      <button
        className="hint"
        aria-label={`Sidst: ${lastText}. ${advice}. Tryk for at udfylde.`}
        onClick={() => dispatch({ type: 'APPLY_HINT', weId, weight: next.weight, reps: next.reps })}
      >
        Sidst: {lastText} → <strong>{advice}</strong>
      </button>
    );
  }
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

const TAG_ORDER: SetTag[] = ['drop', 'failure', 'amrap'];

/** Menu fra sæt-nummeret (#244): opvarmning, drop-sæt, til failure, AMRAP, fjern mærke, tilføj drop-sæt og slet */
function SetMenu({
  title,
  deleteLabel,
  warmup,
  tag,
  onClose,
  onWarmup,
  onTag,
  onAddDrop,
  onDelete,
}: {
  title: string;
  deleteLabel: string;
  warmup: boolean;
  tag: SetTag | undefined;
  onClose: () => void;
  onWarmup: () => void;
  onTag: (tag: SetTag | null) => void;
  onAddDrop: () => void;
  onDelete: () => void;
}) {
  const pick = (fn: () => void) => () => {
    fn();
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <div className="set-menu" role="group" aria-label="Mærke">
        <button className={`set-menu-item ${warmup ? 'on' : ''}`} aria-pressed={warmup} onClick={pick(onWarmup)}>
          <span className="set-menu-letter warmup">O</span> Opvarmning
        </button>
        {TAG_ORDER.map((t) => (
          <button key={t} className={`set-menu-item ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={pick(() => onTag(t))}>
            <span className={`set-menu-letter tag-${t}`}>{SET_TAGS[t].letter}</span> {SET_TAGS[t].name}
          </button>
        ))}
        <button className="set-menu-item" disabled={!warmup && !tag} onClick={pick(() => onTag(null))}>
          <span className="set-menu-letter">–</span> Fjern mærke
        </button>
      </div>
      <div className="set-menu-actions">
        <button className="btn-secondary" onClick={pick(onAddDrop)}>
          + Tilføj drop-sæt
        </button>
        <button className="btn-danger" aria-label={deleteLabel} onClick={pick(onDelete)}>
          Slet sæt
        </button>
      </div>
    </Modal>
  );
}

function ExerciseBlock({ we }: { we: WorkoutExercise }) {
  const { exerciseById } = useStore();
  const { w, base: state, edit, send: dispatch, vs } = useWorkout();
  const ex = exerciseById(we.exerciseId);
  const vsStatus = edit ? null : (vs?.rows.find((r) => r.weId === we.id)?.status ?? null);
  const prev = previousSetsFor(state.history, w, we.exerciseId);
  const kind = exerciseKind(state, we.exerciseId);
  const now = useNow(we.sets.some((x) => !!x.timerStartedAt));
  const hint = state.showHints && !edit ? progressionHint(state, we.exerciseId, we) : null;
  // "Vis RPE-felt" i Profil (#238): slået fra → ingen RPE-kolonne; loggede værdier beholdes
  const showRpe = state.showRpe !== false;
  const [warmupMsg, setWarmupMsg] = useState(false);
  // Sæt-menuen (#244): id for sættet hvis menu er åben
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const isBarbell = ex?.equipment === 'Stang';
  // Kropsvægtsøvelse (#208): vægtfeltet er ekstra vægt (+10) eller assistance (−20)
  const bw = isBodyweightReps(state, we.exerciseId);
  // Enhed (#345): sæt gemmes i kg, men vises og indtastes i kg eller lb
  const unit: WeightUnit = state.unit ?? 'kg';
  const bwMissing = bw && bodyWeightOn(state, w.startedAt) === null;
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
  // Teknik-tips (#339): "?" vises kun når øvelsen har tips
  const cues = exerciseCues(state, we.exerciseId);
  const [cuesOpen, setCuesOpen] = useState(false);
  // Øvelsen fra skabelonen før byttet (#128) – null = ikke byttet, eller valget er truffet
  const [swappedFrom, setSwappedFrom] = useState<string | null>(null);
  const [savedInTemplate, setSavedInTemplate] = useState(false);
  const { state: live, dispatch: liveDispatch } = useStore();
  const askTemplate =
    !edit && !!swappedFrom && swappedFrom !== we.exerciseId && canSwapInTemplate(live, w.templateId, swappedFrom);
  const templateName = live.templates.find((t) => t.id === w.templateId)?.name ?? '';
  const restLabel = formatRest(restFor(live, we.exerciseId));
  // Reel pause før hvert afkrydset sæt (#316)
  const restBefore = new Map(actualRests(w).filter((r) => r.weId === we.id).map((r) => [r.setId, r.seconds]));

  return (
    <article className="ex-block" aria-label={ex?.name}>
      <header>
        <h3>
          {name}
          {vsStatus && <VsMark status={vsStatus} />}
        </h3>
        {cues.length > 0 && (
          <button className="btn-ghost small cues-btn" aria-label={`Teknik for ${name}`} onClick={() => setCuesOpen(true)}>
            ?
          </button>
        )}
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
      {cuesOpen && (
        <Modal title={`Teknik: ${name}`} onClose={() => setCuesOpen(false)}>
          <ul className="cues-list">
            {cues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Modal>
      )}
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
      {bwMissing && <p className="muted bw-hint">Angiv din kropsvægt i Profil for at tælle den med</p>}
      <table className="sets">
        <thead>
          <tr>
            <th>Sæt</th>
            <th>Forrige</th>
            {kind === 'reps' && (
              <>
                <th>{bw ? `+${unit}` : unit}</th>
                <th>Reps</th>
                {showRpe && <th>RPE</th>}
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
            // Opvarmning ("O") og drop-sæt ("D") nummereres for sig, så arbejdssæt beholder 1, 2, 3 … (#244)
            const label = setLabel(we.sets, idx);
            const i = label.no - 1;
            const what = label.kind === 'warmup' ? 'opvarmning' : label.kind === 'drop' ? 'drop-sæt' : 'sæt';
            const p = label.kind === 'work' ? prev[i] : undefined;
            const records = s.done ? recordsBrokenBy(state, we.exerciseId, s) : [];
            return (
              <Fragment key={s.id}>
              <tr className={`${s.done ? 'done' : ''} ${s.warmup ? 'warmup' : ''} ${s.tag ? `tag-${s.tag}` : ''}`}>
                <td>
                  <button
                    className="set-no"
                    title="Mærke eller slet sæt"
                    aria-label={`Valg for ${what} ${i + 1}`}
                    aria-haspopup="dialog"
                    onClick={() => setMenuFor(s.id)}
                  >
                    {label.text}
                  </button>
                  {menuFor === s.id && (
                    <SetMenu
                      title={`${what[0].toUpperCase()}${what.slice(1)} ${i + 1}`}
                      deleteLabel={`Slet ${what} ${i + 1}`}
                      warmup={!!s.warmup}
                      tag={s.tag}
                      onClose={() => setMenuFor(null)}
                      onWarmup={() => dispatch({ type: 'SET_SET_WARMUP', weId: we.id, setId: s.id, warmup: true })}
                      onTag={(tag) => {
                        if (s.warmup) dispatch({ type: 'SET_SET_WARMUP', weId: we.id, setId: s.id, warmup: false });
                        dispatch({ type: 'SET_SET_TAG', weId: we.id, setId: s.id, tag });
                      }}
                      onAddDrop={() => dispatch({ type: 'ADD_DROP_SET', weId: we.id, setId: s.id })}
                      onDelete={() => dispatch({ type: 'REMOVE_SET', weId: we.id, setId: s.id })}
                    />
                  )}
                </td>
                <td className="prev">{p ? prevText(p, kind, bw, unit) : '–'}</td>
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
                  <WeightInput
                    inputMode={bw ? 'text' : 'decimal'}
                    label={`${bw ? 'Ekstra vægt' : 'Vægt'} ${what} ${i + 1}`}
                    unit={unit}
                    placeholder={(p && weightInputText(p.weight, unit)) || (bw ? 'KV' : '')}
                    weight={s.weight}
                    onChange={(weight) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { weight } })}
                  />
                </td>
                <td>
                  <input
                    inputMode="numeric"
                    aria-label={`Reps ${what} ${i + 1}`}
                    placeholder={p?.reps || formatRepRange(we) || ''}
                    value={s.reps}
                    onChange={(e) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { reps: e.target.value } })}
                  />
                </td>
                {showRpe && (
                  <td>
                    <RpeInput
                      label={`RPE ${what} ${i + 1}`}
                      value={s.rpe}
                      onChange={(rpe) => dispatch({ type: 'UPDATE_SET', weId: we.id, setId: s.id, patch: { rpe } })}
                    />
                  </td>
                )}
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
              {s.done && restBefore.has(s.id) && (
                <tr className="rest-row">
                  <td colSpan={showRpe && kind === 'reps' ? 6 : 5}>hvilede {formatClock(restBefore.get(s.id)!)}</td>
                </tr>
              )}
              {records.length > 0 && (
                <tr className="pr-row">
                  <td colSpan={showRpe && kind === 'reps' ? 6 : 5}>
                    <span role="img" aria-label={recordText(records, s.weight, bw, unit)}>
                      🏆
                    </span>{' '}
                    {recordText(records, s.weight, bw, unit)}
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
