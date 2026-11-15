import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { MUSCLES, type Muscle } from '../lib/types';
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

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

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
      <ul className="list">
        {list.map((e) => (
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
        ))}
      </ul>
      {!list.length && <Empty>Ingen øvelser fundet. Opret egne øvelser under fanen Øvelser.</Empty>}
    </Modal>
  );
}
