import { StrengthChart } from '../components/StrengthChart';
import { useMemo, useState } from 'react';
import { GoalsSection } from '../components/GoalsSection';
import { PercentTable } from '../components/PercentTable';
import { RestControls } from '../components/RestPicker';
import { Chips, Empty, Modal } from '../components/ui';
import {
  exerciseHistory,
  formatRpe,
  exerciseKind,
  formatClock,
  formatKg,
  formatSet,
  setTagSuffix,
  isBodyweightReps,
  num,
  personalRecords,
  uid,
  type PersonalRecords,
} from '../lib/logic';
import { useStore } from '../lib/store';
import { EQUIPMENT, MUSCLES, type Equipment, type Exercise, type ExerciseKind, type Muscle } from '../lib/types';

const KIND_LABEL: Record<ExerciseKind, string> = { reps: 'Vægt × reps', time: 'Tid', distance: 'Distance' };

const FAVORITES = 'Favoritter';
type Filter = Muscle | typeof FAVORITES;

const shortDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });

export function ExercisesView() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const favs = new Set(state.favorites ?? []);
    const match = (e: Exercise) => (filter === FAVORITES ? favs.has(e.id) : !filter || e.muscle === filter);
    return state.exercises
      .filter((e) => match(e) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [state.exercises, state.favorites, query, filter]);

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
      <Chips<Filter> options={[FAVORITES, ...MUSCLES]} value={filter} onChange={setFilter} label="Filtrer øvelser" />
      <ul className="list">
        {list.map((e) => (
          <li key={e.id} className="fav-row">
            <FavoriteButton exerciseId={e.id} name={e.name} />
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
      {!list.length && (
        <Empty>{filter === FAVORITES && !query.trim() ? 'Ingen favoritter endnu – tryk ☆ ved en øvelse.' : 'Ingen øvelser matcher.'}</Empty>
      )}
      {creating && <NewExercise onClose={() => setCreating(false)} />}
      {open && <ExerciseDetail ex={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** ☆/★ – marker en øvelse som favorit (#191). `name` gives med i listen, så hver knap har sit eget navn. */
export function FavoriteButton({ exerciseId, name, big }: { exerciseId: string; name?: string; big?: boolean }) {
  const { state, dispatch } = useStore();
  const on = (state.favorites ?? []).includes(exerciseId);
  const label = (on ? 'Fjern favorit' : 'Favorit') + (name ? ` ${name}` : '');
  return (
    <button
      className={`fav-btn ${on ? 'on' : ''} ${big ? 'big' : ''}`}
      aria-label={label}
      aria-pressed={on}
      onClick={() => dispatch({ type: 'TOGGLE_FAVORITE', exerciseId })}
    >
      {on ? '★' : '☆'}
      {big && <span>{on ? ' Favorit' : ' Gør til favorit'}</span>}
    </button>
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

/** Øvelsens side med rekorder og graf – bruges også fra "Rekorder" i Profil (#164) */
export function ExerciseDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const { state } = useStore();
  const hist = exerciseHistory(state.history, ex.id, state);
  const best = Math.max(0, ...hist.map((h) => h.best1RM));
  const kind = exerciseKind(state, ex.id);
  // Tids- og distanceøvelser måles i sekunder/meter i stedet for 1RM (#136)
  const field = kind === 'time' ? 'seconds' : 'meters';
  const bestOf = (h: (typeof hist)[number]) => Math.max(0, ...h.sets.map((s) => num(s[field] ?? '')));
  const fmt = (n: number) => (kind === 'time' ? `${n} sek.` : `${String(n).replace('.', ',')} m`);

  return (
    <Modal title={ex.name} onClose={onClose}>
      <div className="row-between">
        <p className="muted">
          {ex.muscle} · {ex.equipment}
          {isBodyweightReps(state, ex.id) && (
            <>
              <br />
              <small>Kropsvægt + ekstra vægt</small>
            </>
          )}
        </p>
        <FavoriteButton exerciseId={ex.id} big />
      </div>
      <section className="rest-picker exercise-rest" aria-label="Pause mellem sæt">
        <h3 className="section">⏱ Pause mellem sæt</h3>
        <RestControls exerciseId={ex.id} />
      </section>
      {kind === 'reps' && <GoalsSection exerciseId={ex.id} />}
      <PercentTable exerciseId={ex.id} />
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
          <StrengthChart exerciseId={ex.id} />
          <Records records={personalRecords(state, ex.id)} />
          <h3 className="section">Historik</h3>
          <ul className="list">
            {hist.map((h) => (
              <li key={h.workoutId} className="list-row static">
                <span>
                  <strong>{shortDate.format(h.date)}</strong>
                  <small>
                    {h.sets
                      .map((s) => formatSet(s, isBodyweightReps(state, ex.id)) + (formatRpe(s.rpe) ? ` @ RPE ${formatRpe(s.rpe)}` : '') + setTagSuffix(s))
                      .join(' · ')}
                  </small>
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
