import { useState } from 'react';
import {
  cleanIntervalConfig,
  formatDuration,
  INTERVAL_DEFAULTS,
  INTERVAL_LIMITS,
  intervalStatus,
  intervalTotalSeconds,
  type IntervalConfig,
  type IntervalMode,
} from '../lib/logic';
import { useNow, useStore } from '../lib/store';
import { Modal } from './ui';

/* Intervaltimer til finishers (#330): EMOM, Tabata og AMRAP med stor nedtælling */

const MODES: { id: IntervalMode; label: string; hint: string }[] = [
  { id: 'emom', label: 'EMOM', hint: 'Start en ny runde hvert minut' },
  { id: 'tabata', label: 'Tabata', hint: 'Korte intervaller med arbejde og pause' },
  { id: 'amrap', label: 'AMRAP', hint: 'Så mange runder som muligt på tiden' },
];

const PHASE_TEXT = { work: 'Arbejde', rest: 'Pause' } as const;

const clock = (seconds: number) => formatDuration(Math.max(0, seconds) * 1000);

type Field = 'minutes' | 'workSeconds' | 'restSeconds' | 'rounds';
const FIELDS: Record<IntervalMode, { key: Field; label: string; limits: readonly [number, number] }[]> = {
  emom: [
    { key: 'minutes', label: 'Minutter', limits: INTERVAL_LIMITS.minutes },
    { key: 'workSeconds', label: 'Arbejde pr. minut (sek.)', limits: INTERVAL_LIMITS.emomWorkSeconds },
  ],
  tabata: [
    { key: 'workSeconds', label: 'Arbejde (sek.)', limits: INTERVAL_LIMITS.workSeconds },
    { key: 'restSeconds', label: 'Pause (sek.)', limits: INTERVAL_LIMITS.restSeconds },
    { key: 'rounds', label: 'Runder', limits: INTERVAL_LIMITS.rounds },
  ],
  amrap: [{ key: 'minutes', label: 'Minutter', limits: INTERVAL_LIMITS.minutes }],
};

type Drafts = Record<IntervalMode, Record<Field, string>>;

function toDraft(c: IntervalConfig): Record<Field, string> {
  return { minutes: String(c.minutes), workSeconds: String(c.workSeconds), restSeconds: String(c.restSeconds), rounds: String(c.rounds) };
}

/** Knap i træningen, der åbner intervaltimeren */
export function IntervalButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary wide" onClick={() => setOpen(true)}>
        ⏱ Intervaltimer
      </button>
      {open && <IntervalSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function IntervalSheet({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  return (
    <Modal title="Intervaltimer" onClose={onClose}>
      {state.interval ? <IntervalRunning onClose={onClose} /> : <IntervalSetup />}
    </Modal>
  );
}

function IntervalSetup() {
  const { state, dispatch } = useStore();
  const saved = cleanIntervalConfig(state.intervalConfig ?? INTERVAL_DEFAULTS.emom);
  const [mode, setMode] = useState<IntervalMode>(saved.mode);
  const [drafts, setDrafts] = useState<Drafts>(() => ({
    emom: toDraft(INTERVAL_DEFAULTS.emom),
    tabata: toDraft(INTERVAL_DEFAULTS.tabata),
    amrap: toDraft(INTERVAL_DEFAULTS.amrap),
    [saved.mode]: toDraft(saved),
  }));
  const draft = drafts[mode];
  const config = cleanIntervalConfig({ mode, ...Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === '' ? undefined : v])) });
  const set = (key: Field, value: string) => setDrafts((d) => ({ ...d, [mode]: { ...d[mode], [key]: value } }));

  return (
    <div className="interval-setup">
      <div className="segmented" role="group" aria-label="Type">
        {MODES.map((m) => (
          <button key={m.id} aria-pressed={mode === m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="muted">{MODES.find((m) => m.id === mode)!.hint}</p>
      <div className="interval-fields">
        {FIELDS[mode].map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input
              type="number"
              inputMode="numeric"
              min={f.limits[0]}
              max={f.limits[1]}
              value={draft[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              onBlur={() => set(f.key, String(config[f.key]))}
            />
          </label>
        ))}
      </div>
      <p className="interval-total">
        I alt <strong>{clock(intervalTotalSeconds(config))}</strong>
      </p>
      <button className="btn-primary wide" onClick={() => dispatch({ type: 'START_INTERVAL', config, now: Date.now() })}>
        Start
      </button>
    </div>
  );
}

function IntervalRunning({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const now = useNow(true);
  const run = state.interval!;
  const s = intervalStatus(run.config, run.startedAt, now);
  const stop = () => {
    dispatch({ type: 'STOP_INTERVAL' });
    onClose();
  };
  const label = run.config.mode === 'amrap' ? 'AMRAP' : `Runde ${s.round}/${s.rounds}`;
  if (s.done) {
    return (
      <div className="interval-run done" role="status" aria-label="Nedtælling">
        <p className="interval-big">Færdig! 💪</p>
        <p className="muted">{clock(intervalTotalSeconds(run.config))} gennemført</p>
        <button className="btn-primary wide" onClick={stop}>
          Luk
        </button>
      </div>
    );
  }
  return (
    <div className={`interval-run ${s.phase}`} role="status" aria-label="Nedtælling">
      <p className="interval-round">{label}</p>
      <p className="interval-phase">{PHASE_TEXT[s.phase]}</p>
      <p className="interval-big" data-testid="interval-left">
        {clock(s.phaseLeft)}
      </p>
      <p className="muted">I alt tilbage {clock(s.totalLeft)}</p>
      <button className="btn-danger wide" onClick={stop}>
        Stop
      </button>
      <button className="btn-ghost wide" onClick={onClose}>
        Skjul
      </button>
    </div>
  );
}

/** Lille bjælke i træningen, mens timeren kører og vinduet er skjult. Tryk åbner den igen. */
export function IntervalBar() {
  const { state } = useStore();
  const now = useNow(!!state.interval);
  const [open, setOpen] = useState(false);
  const run = state.interval;
  if (!run) return null;
  const s = intervalStatus(run.config, run.startedAt, now);
  const text = s.done
    ? 'Intervaltimer færdig 💪'
    : `${run.config.mode === 'amrap' ? 'AMRAP' : `Runde ${s.round}/${s.rounds}`} · ${PHASE_TEXT[s.phase]} · ${clock(s.phaseLeft)}`;
  return (
    <>
      <button className={`interval-bar ${s.done ? 'done' : s.phase}${state.rest ? ' above-rest' : ''}`} onClick={() => setOpen(true)} aria-label={`Vis intervaltimer: ${text}`}>
        ⏱ {text}
      </button>
      {open && <IntervalSheet onClose={() => setOpen(false)} />}
    </>
  );
}
