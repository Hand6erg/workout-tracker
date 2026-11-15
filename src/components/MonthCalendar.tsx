import { useState } from 'react';
import { trainingDays } from '../lib/logic';
import { useStore } from '../lib/store';

const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
const monthFmt = new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long' });

/** Månedskalender: dage med træning er markeret og kan åbnes */
export function MonthCalendar({ onOpen }: { onOpen: (workoutId: string) => void }) {
  const { state } = useStore();
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const days = trainingDays(state, year, month);
  const count = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // mandag først
  const name = (id: string) => state.history.find((w) => w.id === id)?.name ?? 'Træning';
  const isToday = (d: number) => offset === 0 && d === now.getDate();
  const title = monthFmt.format(first);
  const total = Object.values(days).reduce((n, ids) => n + ids.length, 0);

  return (
    <section className="card calendar" aria-label={`Kalender ${title}`}>
      <header>
        <button className="btn-ghost small" aria-label="Forrige måned" onClick={() => setOffset(offset - 1)}>
          ‹
        </button>
        <h3 className="cap">{title}</h3>
        <button className="btn-ghost small" aria-label="Næste måned" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
          ›
        </button>
      </header>
      <div className="cal-grid">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="cal-wd" aria-hidden>
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = i + 1;
          const ids = days[d];
          const cls = `cal-day ${isToday(d) ? 'today' : ''}`;
          return ids ? (
            <button
              key={d}
              className={`${cls} on`}
              aria-label={`${dayFmt.format(new Date(year, month, d))}: ${ids.map(name).join(', ')}`}
              onClick={() => onOpen(ids[0])}
            >
              {d}
            </button>
          ) : (
            <span key={d} className={cls}>
              {d}
            </span>
          );
        })}
      </div>
      <p className="muted cal-count">
        {total === 1 ? '1 træning' : `${total} træninger`} i {title.split(' ')[0]}
      </p>
    </section>
  );
}
