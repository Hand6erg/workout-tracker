import { useMemo, useState } from 'react';
import { swapSuggestions } from '../lib/logic';
import { useStore } from '../lib/store';
import type { Exercise, Workout } from '../lib/types';
import { Empty, Modal } from './ui';

/** "Byt øvelse" (#127): forslag øverst, søgning i alle øvelser nedenunder. Et tryk bytter med det samme. */
export function SwapPicker({
  exerciseId,
  workout,
  onClose,
  onPick,
}: {
  exerciseId: string;
  workout: Workout;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const { state, exerciseById } = useStore();
  const [query, setQuery] = useState('');
  const current = exerciseById(exerciseId);
  const suggestions = useMemo(() => swapSuggestions(state, exerciseId, workout), [state, exerciseId, workout]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.exercises
      .filter((e) => e.id !== exerciseId && e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  }, [state.exercises, query, exerciseId]);

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button className="list-row" onClick={() => onPick(e.id)}>
        <span>
          <strong>{e.name}</strong>
          <small>
            {e.muscle} · {e.equipment}
          </small>
        </span>
        <span className="check">⇄</span>
      </button>
    </li>
  );

  return (
    <Modal title="Byt øvelse" onClose={onClose}>
      {current && (
        <p className="muted swap-current">
          Bytter <strong>{current.name}</strong> ud – sæt og noter bliver.
        </p>
      )}
      {!query.trim() && (
        <section aria-label="Forslag">
          <h4 className="swap-head">Forslag</h4>
          {suggestions.length ? (
            <ul className="list">{suggestions.map(row)}</ul>
          ) : (
            <Empty>Ingen forslag til samme muskelgruppe – søg nedenfor.</Empty>
          )}
        </section>
      )}
      <input
        className="search"
        type="search"
        aria-label="Søg i alle øvelser"
        placeholder="Søg i alle øvelser"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <section aria-label="Søgeresultater">
          {results.length ? <ul className="list">{results.map(row)}</ul> : <Empty>Ingen øvelser fundet.</Empty>}
        </section>
      )}
    </Modal>
  );
}
