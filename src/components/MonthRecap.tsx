import { useUnit } from '../lib/store';
import { formatWeight, formatTotalTime, monthNameDa, recapChangeTexts, type MonthRecap } from '../lib/logic';

/** Tallene i en månedsopsummering (#169) – bruges både i kortet i Historik og i dialogen fra kalenderen */
export function MonthRecapStats({ r }: { r: MonthRecap }) {
  const unit = useUnit();
  const changes = recapChangeTexts(r);
  const stats: [string, string][] = [
    ['Træninger', String(r.workouts)],
    ['Tid', formatTotalTime(r.durationMs)],
    ['Volumen', formatWeight(r.volume, unit)],
    ['Rekorder', `🏆 ${r.records}`],
    ['Muskelgruppe', r.topMuscle ?? '–'],
    ['Længste stime', r.longestStreak === 1 ? '1 dag' : `${r.longestStreak} dage`],
  ];
  return (
    <>
      <dl className="recap-grid">
        {stats.map(([label, value]) => (
          <div key={label} className="recap-stat">
            <dt className="muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {r.favourite && (
        <p className="recap-fav">
          <span className="muted">Favoritøvelse:</span> <strong>{r.favourite.name}</strong>{' '}
          <span className="muted">({r.favourite.sets} sæt)</span>
        </p>
      )}
      {changes.length > 0 && (
        <p className="recap-change" aria-label={`I forhold til ${monthNameDa(r.month - 1)}`}>
          {changes.map((c) => (
            <span key={c} className={c.startsWith('+') ? 'up' : c.startsWith('−') ? 'down' : ''}>
              {c}
            </span>
          ))}
          <span className="muted">vs. {monthNameDa(r.month - 1)}</span>
        </p>
      )}
    </>
  );
}

/** "Din oktober"-kortet øverst i Historik de første dage af en ny måned (#169) */
export function MonthRecapCard({ r, onDismiss }: { r: MonthRecap; onDismiss: () => void }) {
  const title = `Din ${monthNameDa(r.month)}`;
  return (
    <section className="card recap-card" aria-label={title}>
      <header className="recap-head">
        <h2>
          <span aria-hidden>📅</span> {title}
        </h2>
        <button className="btn-ghost small" onClick={onDismiss} aria-label="Luk månedens opsummering">
          Luk
        </button>
      </header>
      <MonthRecapStats r={r} />
    </section>
  );
}
