import { useMemo, useState } from 'react';
import { MonthCalendar } from '../components/MonthCalendar';
import { MonthRecapCard } from '../components/MonthRecap';
import { YearReviewSection } from '../components/YearReview';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import { FinisherList } from '../components/IntervalTimer';
import {
  bestSet,
  formatDuration,
  formatWeight,
  formatSet,
  setTagSuffix,
  historyTemplates,
  isBodyweightReps,
  recapToShow,
  recordCount,
  repMaxLine,
  workoutRepMaxes,
  searchHistory,
  supersetGroups,
  workoutRecords,
  withLoads,
  workoutVolume,
  workoutDuration,
  formatRpe,
  actualRests,
  formatClock,
  finisherLabel,
} from '../lib/logic';
import { useStore, useUnit } from '../lib/store';
import type { Workout } from '../lib/types';

/** Statuslinje under søgning/filter, fx "2 træninger med \"squat\" fra Ben" */
function statusText(n: number, q: string, template?: string): string {
  const parts = [q && `med "${q}"`, template && `fra ${template}`].filter(Boolean).join(' ');
  if (!n) return q ? `Ingen træninger matcher "${q}"${template ? ` fra ${template}` : ''}` : `Ingen træninger ${parts}`;
  return `${n} ${n === 1 ? 'træning' : 'træninger'} ${parts}`;
}

const dateFmt = new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function HistoryView({ onOpenWorkout }: { onOpenWorkout?: () => void } = {}) {
  const unit = useUnit();
  const { state, dispatch, exerciseById } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.history.find((w) => w.id === openId);
  // Rekorder kræver et kig på hele historikken, så de beregnes kun når historikken ændres
  const recordsById = useMemo(
    () => new Map(state.history.map((w) => [w.id, workoutRecords(state, w.id)])),
    [state.history],
  );
  // Sidste måneds opsummering de første dage af en ny måned (#169)
  const recap = useMemo(() => recapToShow(state, Date.now()), [state.history, state.recapDismissed, state.exercises]);
  // Søg i historik (#231)
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  // Filterknap pr. skabelon (#232)
  const templateChips = useMemo(() => historyTemplates(state), [state.history, state.templates]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const activeTemplate = templateChips.find((t) => t.id === templateId) ?? null;
  const filtering = searching || !!activeTemplate;
  const matches = useMemo(
    () => searchHistory(state, { query, templateId: activeTemplate?.id ?? null }),
    [state.history, state.exercises, query, activeTemplate],
  );
  const hitsById = useMemo(() => new Map(matches.map((m) => [m.workout.id, new Set(m.matched.map((x) => x.weId))])), [matches]);

  return (
    <div className="page">
      <h1>Historik</h1>
      {state.history.length > 0 && <YearReviewSection now={Date.now()} />}
      {recap && <MonthRecapCard r={recap} onDismiss={() => dispatch({ type: 'DISMISS_RECAP', key: recap.key })} />}
      {state.history.length > 0 && (
        <div className="history-search">
          <div className="search-wrap">
            <input
              className="search"
              type="search"
              aria-label="Søg i historik"
              placeholder="Søg i historik"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <button className="search-clear" aria-label="Ryd søgning" onClick={() => setQuery('')}>
                ✕
              </button>
            )}
          </div>
          {templateChips.length > 0 && (
            <div className="chips template-chips" role="group" aria-label="Filtrér efter skabelon">
              <button className={`chip ${activeTemplate ? '' : 'on'}`} aria-pressed={!activeTemplate} onClick={() => setTemplateId(null)}>
                Alle
              </button>
              {templateChips.map((t) => (
                <button
                  key={t.id}
                  className={`chip ${activeTemplate?.id === t.id ? 'on' : ''}`}
                  aria-pressed={activeTemplate?.id === t.id}
                  onClick={() => setTemplateId(activeTemplate?.id === t.id ? null : t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
          {filtering && (
            <p className="muted search-status" role="status">
              {statusText(matches.length, query.trim(), activeTemplate?.name)}
            </p>
          )}
        </div>
      )}
      {state.history.length > 0 && !filtering && <MonthCalendar onOpen={setOpenId} />}
      {!state.history.length && <Empty>Ingen træninger endnu. Afslut en træning, så dukker den op her.</Empty>}
      <div className="cards">
        {matches.map(({ workout: w }) => {
          const records = recordsById.get(w.id) ?? {};
          const hits = hitsById.get(w.id);
          const count = recordCount(records);
          return (
          <button key={w.id} className="card as-button" onClick={() => setOpenId(w.id)} aria-label={`Træning ${w.name}`}>
            <h3>{w.name}</h3>
            <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
            <p className="stats">
              <span>⏱ {formatDuration(workoutDuration(w, w.startedAt))}</span>
              <span>🏋️ {formatWeight(workoutVolume(withLoads(state, w)), unit)}</span>
              {count > 0 && (
                <span className="pr-count">🏆 {count === 1 ? '1 rekord' : `${count} rekorder`}</span>
              )}
            </p>
            <table className="mini">
              <tbody>
                {w.exercises.map((e) => {
                  const b = bestSet(e.sets);
                  const hit = hits?.has(e.id);
                  const name = exerciseById(e.exerciseId)?.name;
                  return (
                    <tr key={e.id} className={hit ? 'search-hit' : undefined}>
                      <td>
                        {e.sets.filter((x) => !x.warmup).length} × {hit ? <mark>{name}</mark> : name}
                        {records[e.exerciseId] && (
                          <span role="img" aria-label="Ny rekord">
                            {' '}
                            🏆
                          </span>
                        )}
                      </td>
                      <td className="muted">{b ? formatSet(b, isBodyweightReps(state, e.exerciseId), unit) : ''}</td>
                    </tr>
                  );
                })}
                {(w.finishers ?? []).map((f) => (
                  <tr key={f.id} className="finisher-row">
                    <td colSpan={2}>⏱ {finisherLabel(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {supersetGroups(w.exercises)
              .filter((g) => g.length > 1)
              .map((g) => (
                <p key={g[0].supersetId} className="superset-note">
                  Supersæt: {g.map((e) => exerciseById(e.exerciseId)?.name ?? '?').join(' + ')}
                </p>
              ))}
            {w.note && <p className="workout-note-line">📝 {w.note}</p>}
          </button>
          );
        })}
      </div>
      {open && <WorkoutDetail w={open} onClose={() => setOpenId(null)} onOpenWorkout={onOpenWorkout} />}
    </div>
  );
}

export function WorkoutDetail({ w, onClose, onOpenWorkout }: { w: Workout; onClose: () => void; onOpenWorkout?: () => void }) {
  const unit = useUnit();
  const { state, dispatch, exerciseById } = useStore();
  // Reel pause før hvert sæt (#316) – kun træninger med tidsstempler
  const restBefore = new Map(actualRests(w).map((r) => [r.setId, r.seconds]));
  // Gentag træningen (#150): start en ny med samme øvelser og sæt, og vis den dags tal som "Forrige"
  const repeat = () => {
    dispatch({ type: 'REPEAT_WORKOUT', workoutId: w.id, now: Date.now(), replace: true });
    onClose();
    onOpenWorkout?.();
  };
  const [saved, setSaved] = useState(false);
  const repMaxes = workoutRepMaxes(state, w.id);

  return (
    <Modal
      title={w.name}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() => {
              dispatch({ type: 'EDIT_WORKOUT', workoutId: w.id });
              onClose();
            }}
          >
            Redigér
          </button>
          <button
            className="btn-secondary"
            disabled={saved}
            onClick={() => {
              dispatch({ type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: w.id, name: w.name });
              setSaved(true);
            }}
          >
            {saved ? 'Gemt som skabelon ✓' : 'Gem som skabelon'}
          </button>
          <ConfirmButton
            onConfirm={() => {
              dispatch({ type: 'DELETE_WORKOUT', workoutId: w.id });
              onClose();
            }}
          >
            Slet
          </ConfirmButton>
        </>
      }
    >
      <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
      {state.active ? (
        <ConfirmButton className="btn-primary wide repeat-btn" confirmText="Erstat igangværende træning?" onConfirm={repeat}>
          <span aria-hidden>🔁</span> Gentag
        </ConfirmButton>
      ) : (
        <button className="btn-primary wide repeat-btn" onClick={repeat}>
          <span aria-hidden>🔁</span> Gentag
        </button>
      )}
      {w.note && <p className="workout-note-full">📝 {w.note}</p>}
      {repMaxes.length > 0 && (
        <ul className="summary-records repmax-lines" aria-label="Nye rep-maks">
          {repMaxes.map((r) => (
            <li key={r.exerciseId}>{repMaxLine(r, unit)}</li>
          ))}
        </ul>
      )}
      {w.exercises.map((e) => (
        <section key={e.id} className="detail-ex">
          <h3>{exerciseById(e.exerciseId)?.name}</h3>
          {e.note && <p className="ex-note">📝 {e.note}</p>}
          <ol>
            {e.sets.map((s) => (
              <li key={s.id}>
                {formatSet(s, isBodyweightReps(state, e.exerciseId), unit)}
                {formatRpe(s.rpe) && <span className="muted"> @ RPE {formatRpe(s.rpe)}</span>}
                {s.warmup && <span className="muted"> (opvarmning)</span>}
                {setTagSuffix(s) && <span className="set-tag-note"> {setTagSuffix(s).trim()}</span>}
                {restBefore.has(s.id) && <span className="rest-note"> · hvilede {formatClock(restBefore.get(s.id)!)}</span>}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <FinisherList
        finishers={w.finishers}
        onRemove={(finisherId) => dispatch({ type: 'REMOVE_FINISHER', workoutId: w.id, finisherId })}
      />
    </Modal>
  );
}
