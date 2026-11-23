import { RecoveryCard } from '../components/RecoveryCard';
import { ConfirmButton, Empty } from '../components/ui';
import { formatTemplateLine, nextInProgram, supersetGroups, templateReady } from '../lib/logic';
import { RepRangeSheet } from '../components/RepRangeSheet';
import { useState } from 'react';
import { WorkoutDetail } from './HistoryView';
import type { Template } from '../lib/types';
import { useStore } from '../lib/store';

export function StartView({ onOpenWorkout }: { onOpenWorkout: () => void }) {
  const { state, dispatch, exerciseById } = useStore();

  const start = (templateId?: string) => {
    dispatch({ type: 'START_WORKOUT', templateId, now: Date.now() });
    onOpenWorkout();
  };

  const next = state.active ? null : nextInProgram(state);
  const [openId, setOpenId] = useState<string | null>(null);
  const [repsFor, setRepsFor] = useState<string | null>(null);
  const repsTemplate = state.templates.find((t) => t.id === repsFor);
  const openWorkout = state.history.find((w) => w.id === openId);
  // "Klar"-mærket vises kun når der er historik at regne på (#288)
  const hasHistory = state.history.some((w) => w.finishedAt);
  const now = Date.now();
  const summary = (t: Template) =>
    supersetGroups(t.exercises)
      .map((g) => {
        const names = g.map((e) => formatTemplateLine(exerciseById(e.exerciseId), e));
        return g.length > 1 ? `Supersæt: ${names.join(' + ')}` : names[0];
      })
      .join(', ');

  return (
    <div className="page">
      <h1>Træning</h1>

      {next && (
        <section className="card next-up" aria-label="Næste i programmet">
          <header>
            <h2>Næste: {next.name}</h2>
            <button className="btn-ghost small" onClick={() => dispatch({ type: 'SKIP_PROGRAM' })}>
              Spring over
            </button>
          </header>
          <p className="muted">{summary(next)}</p>
          <button className="btn-primary wide" onClick={() => start(next.id)}>
            Start {next.name}
          </button>
        </section>
      )}

      {state.active ? (
        <button className="btn-primary wide" onClick={onOpenWorkout}>
          Fortsæt: {state.active.name}
        </button>
      ) : (
        <button className={next ? 'btn-secondary wide' : 'btn-primary wide'} onClick={() => start()}>
          Start tom træning
        </button>
      )}

      <h2 className="section">Skabeloner</h2>
      {!state.templates.length && <Empty>Ingen skabeloner endnu. Gem en træning som skabelon fra Historik.</Empty>}
      <div className="cards">
        {state.templates.map((t) => (
          <article key={t.id} className="card" aria-label={`Skabelon ${t.name}`}>
            <header>
              <h3>
                {t.name}
                {hasHistory && templateReady(state, t.id, now) && (
                  <span className="ready-badge" role="img" aria-label="Klar – trænes mest muskler, der er hvilede">
                    Klar
                  </span>
                )}
              </h3>
              <ConfirmButton className="btn-ghost small" confirmText="Slet?" onConfirm={() => dispatch({ type: 'DELETE_TEMPLATE', templateId: t.id })}>
                ✕
              </ConfirmButton>
            </header>
            <p className="muted">{summary(t)}</p>
            <div className="tpl-actions">
              <button className="btn-secondary small" disabled={!!state.active} onClick={() => start(t.id)}>
                Start {t.name}
              </button>
              <button className="btn-ghost small" aria-label={`Rediger reps i ${t.name}`} onClick={() => setRepsFor(t.id)}>
                Rediger reps
              </button>
            </div>
          </article>
        ))}
      </div>

      {!state.active && hasHistory && <RecoveryCard state={state} onOpenWorkout={setOpenId} />}
      {repsTemplate && <RepRangeSheet template={repsTemplate} onClose={() => setRepsFor(null)} />}
      {openWorkout && <WorkoutDetail w={openWorkout} onClose={() => setOpenId(null)} onOpenWorkout={onOpenWorkout} />}
    </div>
  );
}
