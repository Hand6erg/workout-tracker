import { useState } from 'react';
import { etaText, formatKg, goalEta, goalOnTrack, goalProgress, uid } from '../lib/logic';
import { useStore } from '../lib/store';
import type { LiftGoal } from '../lib/types';
import { ConfirmButton } from './ui';

const longDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

/** "100 kg × 1" */
export function goalLabel(g: Pick<LiftGoal, 'weight' | 'reps'>): string {
  return `${formatKg(g.weight)} × ${g.reps}`;
}

/** Løftemål på øvelsessiden (#199): sæt et mål, se fremskridt og tempo */
export function GoalsSection({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  const goals = (state.goals ?? []).filter((g) => g.exerciseId === exerciseId);
  const open = goals.filter((g) => !g.achievedAt);
  const reached = goals.filter((g) => g.achievedAt).sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0));

  return (
    <section aria-label="Mål" className="goals">
      <div className="row-between">
        <h3 className="section">🎯 Mål</h3>
        {!adding && (
          <button className="btn-secondary small" onClick={() => setAdding(true)}>
            + Sæt mål
          </button>
        )}
      </div>
      {adding && <GoalForm exerciseId={exerciseId} onDone={() => setAdding(false)} />}
      {!open.length && !reached.length && !adding && <p className="muted goal-empty">Sæt et mål, fx 100 kg × 1, og følg hvor tæt du er.</p>}
      {open.length > 0 && (
        <ul className="goal-list">
          {open.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </ul>
      )}
      {reached.length > 0 && (
        <>
          <h4 className="goal-sub">Nået</h4>
          <ul className="goal-list">
            {reached.map((g) => (
              <GoalRow key={g.id} goal={g} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function GoalRow({ goal }: { goal: LiftGoal }) {
  const { state, dispatch } = useStore();
  const now = Date.now();
  const p = goalProgress(state, goal.id);
  if (!p) return null;
  const label = goalLabel(goal);
  const eta = goal.achievedAt ? null : goalEta(state, goal.id, now);
  const onTrack = goal.achievedAt ? null : goalOnTrack(state, goal.id, now);
  return (
    <li className={`goal-row${goal.achievedAt ? ' reached' : ''}`} aria-label={`Mål ${label}`}>
      <div className="row-between">
        <strong>{label}</strong>
        <span className="muted">{p.pct} %</span>
      </div>
      <div className="goal-bar" role="progressbar" aria-label={`Fremskridt mod ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.pct}>
        <span style={{ width: `${p.pct}%` }} />
      </div>
      {goal.achievedAt ? (
        <small className="goal-ok">✓ Nået {longDate.format(goal.achievedAt)}</small>
      ) : (
        <small className="muted">
          Nu: {formatKg(Math.round(p.current * 10) / 10)} e1RM
          {eta !== null && <> · I dette tempo: {etaText(eta, now)}</>}
          {goal.targetDate ? <> · Mål: {longDate.format(goal.targetDate)}</> : null}
        </small>
      )}
      {onTrack !== null && <small className={onTrack ? 'goal-ok' : 'goal-behind'}>{onTrack ? 'På sporet ✓' : 'Bagud'}</small>}
      <div className="goal-actions">
        <ConfirmButton className="btn-ghost small" confirmText="Tryk igen for at slette" onConfirm={() => dispatch({ type: 'DELETE_GOAL', goalId: goal.id })}>
          Slet mål
        </ConfirmButton>
      </div>
    </li>
  );
}

function GoalForm({ exerciseId, onDone }: { exerciseId: string; onDone: () => void }) {
  const { dispatch } = useStore();
  const [kg, setKg] = useState('');
  const [reps, setReps] = useState('1');
  const [date, setDate] = useState('');
  const weight = Number(kg.replace(',', '.'));
  const r = Number(reps);
  const valid = kg.trim() !== '' && weight > 0 && Number.isInteger(r) && r >= 1;

  const save = () => {
    if (!valid) return;
    const targetDate = date ? new Date(`${date}T12:00:00`).getTime() : undefined;
    dispatch({ type: 'ADD_GOAL', id: uid(), exerciseId, weight, reps: r, targetDate, now: Date.now() });
    onDone();
  };

  return (
    <div className="goal-form">
      <div className="goal-fields">
        <label className="field">
          Mål-vægt (kg)
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="100" autoFocus />
        </label>
        <label className="field">
          Reps
          <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
      </div>
      <label className="field">
        Måldato (valgfri)
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="goal-form-actions">
        <button className="btn-secondary" onClick={onDone}>
          Annuller
        </button>
        <button className="btn-primary" disabled={!valid} onClick={save}>
          Gem mål
        </button>
      </div>
    </div>
  );
}
