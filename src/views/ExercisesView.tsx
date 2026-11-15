import { useMemo, useState } from 'react';
import { Chips, Empty, Modal } from '../components/ui';
import { exerciseHistory, formatKg, formatSet, uid } from '../lib/logic';
import { useStore } from '../lib/store';
import { EQUIPMENT, MUSCLES, type Equipment, type Exercise, type Muscle } from '../lib/types';

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

  const save = () => {
    if (!name.trim()) return;
    dispatch({ type: 'ADD_CUSTOM_EXERCISE', id: uid(), name, muscle, equipment });
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
    </Modal>
  );
}

function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { state } = useStore();
  const hist = exerciseHistory(state.history, ex.id);
  const best = Math.max(0, ...hist.map((h) => h.best1RM));

  return (
    <Modal title={ex.name} onClose={onClose}>
      <p className="muted">
        {ex.muscle} · {ex.equipment}
      </p>
      {!hist.length ? (
        <Empty>Du har ikke lavet denne øvelse endnu.</Empty>
      ) : (
        <>
          <div className="kpis">
            <div>
              <small>Est. 1RM</small>
              <strong data-testid="best-1rm">{formatKg(best)}</strong>
            </div>
            <div>
              <small>Træninger</small>
              <strong>{hist.length}</strong>
            </div>
          </div>
          <Sparkline values={[...hist].reverse().map((h) => h.best1RM)} />
          <ul className="list">
            {hist.map((h) => (
              <li key={h.workoutId} className="list-row static">
                <span>
                  <strong>{shortDate.format(h.date)}</strong>
                  <small>{h.sets.map(formatSet).join(' · ')}</small>
                </span>
                <span className="muted">{formatKg(h.best1RM)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 300;
  const h = 80;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 16)]);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Udvikling i estimeret 1RM">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="currentColor" />
      ))}
    </svg>
  );
}
