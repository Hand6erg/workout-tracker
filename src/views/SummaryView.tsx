import { useState } from 'react';
import { formatDuration, formatKg, milestonesUnlockedBy, RECORD_NAMES, restSummary, shareCardLines, volumeChangeText, workoutSummary } from '../lib/logic';
import { shareSummaryImage } from '../lib/shareImage';
import { useStore } from '../lib/store';
import { formatRest } from '../components/RestPicker';
import { FinisherList } from '../components/IntervalTimer';

/** Opsummering lige efter "Afslut" (#143) */
export function SummaryView({ onClose, onOpenMilestones }: { onClose: () => void; onOpenMilestones: () => void }) {
  const { state, exerciseById } = useStore();
  const [sharing, setSharing] = useState(false);
  const s = state.lastFinishedId ? workoutSummary(state, state.lastFinishedId) : null;
  if (!s) return null;
  const pct = s.volumeChangePct;
  const newBadges = milestonesUnlockedBy(state, s.workoutId);
  const w = state.history.find((h) => h.id === s.workoutId);
  const rest = w ? restSummary(w, state) : null;

  return (
    <section className="page summary" aria-label="Opsummering">
      <h1>Godt gået! 💪</h1>
      <p className="muted">{s.name}</p>

      <div className="summary-grid">
        <div className="summary-stat">
          <span className="muted">Tid</span>
          <strong>{formatDuration(s.durationMs)}</strong>
        </div>
        <div className="summary-stat">
          <span className="muted">Volumen</span>
          <strong>{formatKg(s.volume)}</strong>
        </div>
        <div className="summary-stat">
          <span className="muted">Sæt</span>
          <strong>{s.sets} sæt</strong>
        </div>
        <div className="summary-stat">
          <span className="muted">Rekorder</span>
          <strong>🏆 {s.recordCount}</strong>
        </div>
      </div>

      {pct !== null && (
        <p className={`summary-change ${pct > 0 ? 'up' : pct < 0 ? 'down' : ''}`} role="status">
          {volumeChangeText(pct)}
        </p>
      )}

      {rest && rest.count >= 2 && (
        <p className="card summary-rest" aria-label="Pauser">
          <span>
            ⏱ Gns. pause <strong>{formatRest(rest.average)}</strong> <span className="muted">(planlagt {formatRest(rest.planned)})</span>
          </span>
          <small className="muted">
            Længst pause: {exerciseById(rest.longest.exerciseId)?.name ?? 'Ukendt øvelse'} ({formatRest(rest.longest.seconds)})
          </small>
        </p>
      )}

      {!!w?.finishers?.length && (
        <section className="card summary-finishers" aria-label="Finisher">
          <h2>⏱ Finisher</h2>
          <FinisherList finishers={w.finishers} />
        </section>
      )}

      {newBadges.length > 0 && (
        <section className="card summary-badges" aria-label="Nye milepæle">
          {newBadges.map((m) => (
            <button key={m.id} className="summary-badge" onClick={onOpenMilestones} aria-label={`Ny milepæl: ${m.label} – se alle milepæle`}>
              <span className="ms-icon" aria-hidden>
                {m.icon}
              </span>
              <span>
                <strong>Ny milepæl: {m.label} 🎉</strong>
                <small className="muted">Se alle milepæle ›</small>
              </span>
            </button>
          ))}
        </section>
      )}

      {s.goals.length > 0 && (
        <section className="card summary-goals" aria-label="Mål nået">
          <h2>🎯 Mål nået!</h2>
          <ul className="summary-records">
            {s.goals.map((g) => (
              <li key={g.goalId}>
                <strong>{g.name}</strong> <span>{formatKg(g.weight)} × {g.reps}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.records.length > 0 && (
        <section className="card" aria-label="Nye rekorder">
          <h2>🏆 Nye rekorder</h2>
          <ul className="summary-records">
            {s.records.map((r) => (
              <li key={r.exerciseId}>
                <strong>{r.name}</strong> <span className="muted">– {r.kinds.map((k) => RECORD_NAMES[k]).join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="btn-secondary wide"
        disabled={sharing}
        onClick={async () => {
          setSharing(true);
          try {
            await shareSummaryImage(shareCardLines(s));
          } finally {
            setSharing(false);
          }
        }}
      >
        <span aria-hidden>📤</span> Del
      </button>
      <button className="btn-primary wide" onClick={onClose}>
        Luk
      </button>
    </section>
  );
}
