import { useMemo, useState } from 'react';
import { pickerGroups } from '../lib/logic';
import { useStore } from '../lib/store';
import { MUSCLES, type Exercise, type Muscle } from '../lib/types';
import { Chips, Empty, Modal } from './ui';

export function ExercisePicker({ onClose, onPick }: { onClose: () => void; onPick: (ids: string[]) => void }) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.exercises
      .filter((e) => (!muscle || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [state.exercises, query, muscle]);

  // Favoritter og senest brugte øverst (#192) – skjules under søgning
  const groups = useMemo(() => {
    if (query.trim()) return [];
    const byId = new Map(state.exercises.map((e) => [e.id, e]));
    const pick = (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter((e): e is Exercise => !!e && (!muscle || e.muscle === muscle));
    const g = pickerGroups(state);
    return [
      { title: 'Favoritter', items: pick(g.favorites) },
      { title: 'Senest brugt', items: pick(g.recent) },
    ].filter((x) => x.items.length);
  }, [state, query, muscle]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button className={`list-row ${picked.includes(e.id) ? 'picked' : ''}`} onClick={() => toggle(e.id)}>
        <span>
          <strong>{e.name}</strong>
          <small>
            {e.muscle} · {e.equipment}
          </small>
        </span>
        <span className="check">{picked.includes(e.id) ? '✓' : ''}</span>
      </button>
    </li>
  );

  return (
    <Modal
      title="Tilføj øvelser"
      onClose={onClose}
      footer={
        <button className="btn-primary wide" disabled={!picked.length} onClick={() => onPick(picked)}>
          Tilføj {picked.length ? `(${picked.length})` : ''}
        </button>
      }
    >
      <input
        className="search"
        type="search"
        placeholder="Søg efter øvelse"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <Chips options={MUSCLES} value={muscle} onChange={setMuscle} />
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="picker-group">
          <h3 className="section">{g.title}</h3>
          <ul className="list">{g.items.map(row)}</ul>
        </section>
      ))}
      {groups.length > 0 && <h3 className="section">Alle øvelser</h3>}
      <ul className="list" aria-label="Alle øvelser">
        {list.map(row)}
      </ul>
      {!list.length && <Empty>Ingen øvelser fundet. Opret egne øvelser under fanen Øvelser.</Empty>}
    </Modal>
  );
}
