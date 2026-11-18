import { useMemo, useState } from 'react';
import { RestControls } from '../components/RestPicker';
import { Chips, Empty, Modal } from '../components/ui';
import {
  exerciseHistory,
  exerciseKind,
  formatClock,
  formatKg,
  formatSet,
  num,
  personalRecords,
  uid,
  type PersonalRecords,
} from '../lib/logic';
import { useStore } from '../lib/store';
import { EQUIPMENT, MUSCLES, type Equipment, type Exercise, type ExerciseKind, type Muscle } from '../lib/types';

const KIND_LABEL: Record<ExerciseKind, string> = { reps: 'Vægt × reps', time: 'Tid', distance: 'Distance' };

const shortDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });

export function ExercisesView() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.exercises
      .filter((e) => (!muscle || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [state.exercises, query, muscle]);

  const open = state.exercises.find((e) => e.id === openId);

  return (
    <div className="page">
      <div className="row-between">
        <h1>Øvelser</h1>
        <button className="btn-secondary small" onClick={() => setCreating(true)}>
          + Ny
        </button>
      </div>
      <input className="search" type="search" placeholder="Søg" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Chips options={MUSCLES} value={muscle} onChange={setMuscle} />
      <ul className="list">
        {list.map((e) => (
          <li key={e.id}>
            <button className="list-row" onClick={() => setOpenId(e.id)}>
              <span>
                <strong>{e.name}</strong>
                <small>
                  {e.muscle} · {e.equipment}
                  {e.custom ? ' · egen' : ''}
                  {e.kind === 'time' || e.kind === 'distance' ? <b className="kind-tag">{KIND_LABEL[e.kind]}</b> : null}
                </small>
              </span>
              <span className="muted">›</span>
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <Empty>Ingen øvelser matcher.</Empty>}
      {creating && <NewExercise onClose={() => setCreating(false)} />}
      {open && <ExerciseDetail ex={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function NewExercise({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<Muscle>('Bryst');
  const [equipment, setEquipment] = useState<Equipment>('Stang');
  const [kind, setKind] = useState<ExerciseKind>('reps');

  const save = () => {
    if (!name.trim()) return;
    dispatch({ type: 'ADD_CUSTOM_EXERCISE', id: uid(), name, muscle, equipment, kind });
    onClose();
  };

  return (
    <Modal
      title="Ny øvelse"
      onClose={onClose}
      footer={
        <button className="btn-primary wide" disabled={!name.trim()} onClick={save}>
          Gem øvelse
        </button>
      }
    >
      <label className="field">
        Navn
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Fx Hip thrust" />
      </label>
      <label className="field">
        Muskelgruppe
        <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
          {MUSCLES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Udstyr
        <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
          {EQUIPMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
          {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}

function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { state } = useStore();
  const hist = exerciseHistory(state.history, ex.id);
  const best = Math.max(0, ...hist.map((h) => h.best1RM));
  const kind = exerciseKind(state, ex.id);
  // Tids- og distanceøvelser måles i sekunder/meter i stedet for 1RM (#136)
  const field = kind === 'time' ? 'seconds' : 'meters';
  const bestOf = (h: (typeof hist)[number]) => Math.max(0, ...h.sets.map((s) => num(s[field] ?? '')));
  const fmt = (n: number) => (kind === 'time' ? `${n} sek.` : `${String(n).replace('.', ',')} m`);

  return (
    <Modal title={ex.name} onClose={onClose}>
      <p className="muted">
        {ex.muscle} · {ex.equipment}
      </p>
      <section className="rest-picker exercise-rest" aria-label="Pause mellem sæt">
        <h3 className="section">⏱ Pause mellem sæt</h3>
        <RestControls exerciseId={ex.id} />
      </section>
      {!hist.length ? (
        <>
          <Empty>Du har ikke lavet denne øvelse endnu.</Empty>
          <Records records={personalRecords(state, ex.id)} />
        </>
      ) : (
        <>
          <div className="kpis">
            {kind === 'reps' ? (
              <div>
                <small>Est. 1RM</small>
                <strong data-testid="best-1rm">{formatKg(best)}</strong>
              </div>
            ) : (
              <div>
                <small>{kind === 'time' ? 'Længste hold' : 'Længste distance'}</small>
                <strong>{fmt(Math.max(0, ...hist.map(bestOf)))}</strong>
              </div>
            )}
            <div>
              <small>Træninger</small>
              <strong>{hist.length}</strong>
            </div>
          </div>
          <Sparkline
            values={[...hist].reverse().map((h) => (kind === 'reps' ? h.best1RM : bestOf(h)))}
            label={kind === 'reps' ? 'Udvikling i estimeret 1RM' : kind === 'time' ? 'Udvikling i længste hold' : 'Udvikling i længste distance'}
          />
          <Records records={personalRecords(state, ex.id)} />
          <h3 className="section">Historik</h3>
          <ul className="list">
            {hist.map((h) => (
              <li key={h.workoutId} className="list-row static">
                <span>
                  <strong>{shortDate.format(h.date)}</strong>
                  <small>{h.sets.map(formatSet).join(' · ')}</small>
                </span>
                <span className="muted">{kind === 'reps' ? formatKg(h.best1RM) : fmt(bestOf(h))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function Records({ records }: { records: PersonalRecords }) {
  const reps = Object.entries(records.repsAtWeight)
    .map(([w, r]) => ({ weight: Number(w), ...r }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  const kg = (n: number) => (n > 0 ? formatKg(n) : 'Kropsvægt');
  return (
    <section aria-label="Rekorder">
      <h3 className="section">🏆 Rekorder</h3>
      {!records.heaviest && !records.best1RM && !reps.length && !records.longestHold && !records.longestDistance ? (
        <Empty>Ingen rekorder endnu</Empty>
      ) : (
        <ul className="list">
          {records.longestHold && (
            <li className="list-row static">
              <span>
                <strong>Længste hold</strong>
                <small>{shortDate.format(records.longestHold.date)}</small>
              </span>
              <span>{records.longestHold.seconds} sek.</span>
            </li>
          )}
          {records.longestDistance && (
            <li className="list-row static">
              <span>
                <strong>Længste distance</strong>
                <small>{shortDate.format(records.longestDistance.date)}</small>
              </span>
              <span>{String(records.longestDistance.meters).replace('.', ',')} m</span>
            </li>
          )}
          {records.fastest && (
            <li className="list-row static">
              <span>
                <strong>Hurtigste tid</strong>
                <small>
                  {formatClock(records.fastest.pace * 500)} pr. 500 m · {shortDate.format(records.fastest.date)}
                </small>
              </span>
              <span>
                {String(records.fastest.meters).replace('.', ',')} m · {formatClock(records.fastest.seconds)}
              </span>
            </li>
          )}
          {records.heaviest && (
            <li className="list-row static">
              <span>
                <strong>Tungeste vægt</strong>
                <small>{shortDate.format(records.heaviest.date)}</small>
              </span>
              <span>
                {formatKg(records.heaviest.weight)} × {records.heaviest.reps}
              </span>
            </li>
          )}
          {records.best1RM && (
            <li className="list-row static">
              <span>
                <strong>Bedste est. 1RM</strong>
                <small>
                  {formatKg(records.best1RM.weight)} × {records.best1RM.reps} · {shortDate.format(records.best1RM.date)}
                </small>
              </span>
              <span>{formatKg(records.best1RM.value)}</span>
            </li>
          )}
          {reps.map((r) => (
            <li key={r.weight} className="list-row static">
              <span>
                <strong>Flest reps på {kg(r.weight)}</strong>
                <small>{shortDate.format(r.date)}</small>
              </span>
              <span>{r.reps} reps</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const w = 300;
  const h = 80;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 16)]);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="currentColor" />
      ))}
    </svg>
  );
}
