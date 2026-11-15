import { ConfirmButton, Empty } from '../components/ui';
import { supersetGroups } from '../lib/logic';
import { useStore } from '../lib/store';

export function StartView({ onOpenWorkout }: { onOpenWorkout: () => void }) {
  const { state, dispatch, exerciseById } = useStore();

  const start = (templateId?: string) => {
    dispatch({ type: 'START_WORKOUT', templateId, now: Date.now() });
    onOpenWorkout();
  };

  return (
    <div className="page">
      <h1>Træning</h1>

      {state.active ? (
        <button className="btn-primary wide" onClick={onOpenWorkout}>
          Fortsæt: {state.active.name}
        </button>
      ) : (
        <button className="btn-primary wide" onClick={() => start()}>
          Start tom træning
        </button>
      )}

      <h2 className="section">Skabeloner</h2>
      {!state.templates.length && <Empty>Ingen skabeloner endnu. Gem en træning som skabelon fra Historik.</Empty>}
      <div className="cards">
        {state.templates.map((t) => (
          <article key={t.id} className="card" aria-label={`Skabelon ${t.name}`}>
            <header>
              <h3>{t.name}</h3>
              <ConfirmButton className="btn-ghost small" confirmText="Slet?" onConfirm={() => dispatch({ type: 'DELETE_TEMPLATE', templateId: t.id })}>
                ✕
              </ConfirmButton>
            </header>
            <p className="muted">
              {supersetGroups(t.exercises)
                .map((g) => {
                  const names = g.map((e) => `${e.sets}× ${exerciseById(e.exerciseId)?.name ?? '?'}`);
                  return g.length > 1 ? `Supersæt: ${names.join(' + ')}` : names[0];
                })
                .join(', ')}
            </p>
            <button className="btn-secondary wide small" disabled={!!state.active} onClick={() => start(t.id)}>
              Start {t.name}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
