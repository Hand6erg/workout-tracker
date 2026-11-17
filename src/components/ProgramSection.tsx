import { programTemplates } from '../lib/logic';
import { useStore } from '../lib/store';

/** Program i Profil: skabeloner i rækkefølge, så Træning kan vise hvilken der er næste (#107) */
export function ProgramSection() {
  const { state, dispatch } = useStore();
  const list = programTemplates(state);
  const ids = list.map((t) => t.id);
  const rest = state.templates.filter((t) => !ids.includes(t.id));
  const set = (templateIds: string[]) => dispatch({ type: 'SET_PROGRAM', templateIds });
  const move = (i: number, d: number) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };

  return (
    <section aria-label="Program">
      <h2 className="section">Program</h2>
      {!list.length ? (
        <p className="muted">Sæt dine skabeloner i rækkefølge, så viser Træning hvilken der er næste.</p>
      ) : (
        <ol className="card program-list" aria-label="Programmets rækkefølge">
          {list.map((t, i) => (
            <li key={t.id} aria-label={t.name}>
              <span className="program-nr">{i + 1}.</span>
              <span className="program-name">{t.name}</span>
              <button className="btn-ghost small" aria-label="Flyt op" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                className="btn-ghost small"
                aria-label="Flyt ned"
                disabled={i === list.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="btn-ghost small"
                aria-label="Fjern fra program"
                onClick={() => set(ids.filter((id) => id !== t.id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      {rest.length > 0 && (
        <div className="program-add">
          <span className="muted">Tilføj til program:</span>
          {rest.map((t) => (
            <button
              key={t.id}
              className="btn-secondary small"
              aria-label={`Tilføj ${t.name} til program`}
              onClick={() => set([...ids, t.id])}
            >
              + {t.name}
            </button>
          ))}
        </div>
      )}
      {!state.templates.length && <p className="muted">Gem en træning som skabelon fra Historik først.</p>}
    </section>
  );
}
