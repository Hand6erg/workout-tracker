import { useState } from 'react';
import { formatDuration, formatKg, RECORD_NAMES, shareCardLines, volumeChangeText, workoutSummary } from '../lib/logic';
import { shareSummaryImage } from '../lib/shareImage';
import { useStore } from '../lib/store';

/** Opsummering lige efter "Afslut" (#143) */
export function SummaryView({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const [sharing, setSharing] = useState(false);
  const s = state.lastFinishedId ? workoutSummary(state, state.lastFinishedId) : null;
  if (!s) return null;
  const pct = s.volumeChangePct;

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
