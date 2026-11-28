import { stallText, stalledExercises } from '../lib/logic';
import { useStore } from '../lib/store';

/** "Står stille"-kort på startskærmen (#361): øvelser uden fremgang med forslag om en let uge */
export function StallCard() {
  const { state, dispatch } = useStore();
  const list = stalledExercises(state);
  if (!list.length) return null;
  const unit = state.unit ?? 'kg';
  return (
    <section className="card stall-card" aria-label="Står stille">
      <h2>Tid til en let uge?</h2>
      <ul className="stall-list">
        {list.map((s) => (
          <li key={s.exerciseId}>
            <span>{stallText(s, unit)}</span>
            <button
              className="btn-ghost small"
              aria-label={`Skjul ${s.name}`}
              onClick={() => dispatch({ type: 'DISMISS_STALL', exerciseId: s.exerciseId })}
            >
              Skjul
            </button>
          </li>
        ))}
      </ul>
      <p className="muted">En uge med ca. 10 % mindre vægt giver kroppen ro til at komme videre.</p>
    </section>
  );
}
