import { useEffect, useMemo, useRef, useState } from 'react';
import { heatmapYears, withLoads, yearHeatmap } from '../lib/logic';
import { useStore } from '../lib/store';

const dayFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long' });
const monthShort = new Intl.DateTimeFormat('da-DK', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('da-DK', { month: 'long' });
const WEEKDAYS = ['M', '', 'O', '', 'F', '', 'S'];

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Året": ét felt pr. dag, farvet efter hvor meget du trænede (#265) */
export function YearHeatmap() {
  const { state } = useStore();
  const [now] = useState(() => Date.now());
  const years = useMemo(() => heatmapYears(state.history, now), [state.history, now]);
  const [year, setYear] = useState(new Date(now).getFullYear());
  const idx = Math.max(0, years.indexOf(year));
  const map = useMemo(
    () => yearHeatmap(state.history.map((w) => withLoads(state, w)), year),
    [state, year],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLSpanElement>(null);
  const today = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const el = todayRef.current;
    box.scrollLeft = el ? el.offsetLeft - box.clientWidth / 2 : 0;
  }, [year]);

  if (state.history.length === 0) return null;

  const weeks = map.days.length / 7;
  const monthLabels: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const first = map.days.slice(w * 7, w * 7 + 7).find((d) => d.inYear && new Date(d.date).getDate() === 1);
    if (first) monthLabels.push({ col: w + 1, label: monthShort.format(new Date(first.date)).replace('.', '') });
  }

  return (
    <section className="card year-map" aria-label="Året">
      <header>
        <button
          className="btn-ghost small"
          aria-label="Forrige år"
          disabled={idx >= years.length - 1}
          onClick={() => setYear(years[idx + 1])}
        >
          ‹
        </button>
        <h3>Året {year}</h3>
        <button className="btn-ghost small" aria-label="Næste år" disabled={idx <= 0} onClick={() => setYear(years[idx - 1])}>
          ›
        </button>
      </header>
      <div className="year-body">
        <div className="year-wd" aria-hidden>
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="year-scroll" ref={scrollRef}>
          <div className="year-months" aria-hidden style={{ gridTemplateColumns: `repeat(${weeks}, var(--cell))` }}>
            {monthLabels.map((m) => (
              <span key={m.col} style={{ gridColumn: m.col }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="year-grid" role="list" aria-label={`Træningsdage ${year}`}>
            {map.days.map((d) => {
              if (!d.inYear) return <span key={d.date} className="year-cell out" aria-hidden />;
              const isToday = d.date === today;
              const label = `${dayFmt.format(new Date(d.date))}: ${
                d.workoutIds.length ? plural(d.workSets, 'sæt', 'sæt') : 'ingen træning'
              }${isToday ? ' (i dag)' : ''}`;
              return (
                <span
                  key={d.date}
                  ref={isToday ? todayRef : undefined}
                  role="listitem"
                  aria-label={label}
                  title={label}
                  data-level={d.level}
                  className={`year-cell l${d.level}${isToday ? ' today' : ''}`}
                />
              );
            })}
          </div>
        </div>
      </div>
      <ul className="year-stats">
        <li>{plural(map.trainingDays, 'træningsdag', 'træningsdage')}</li>
        <li>Længste stime: {plural(map.longestWeekStreak, 'uge', 'uger')}</li>
        {map.busiestMonth !== null && (
          <li>Travleste måned: {monthLong.format(new Date(year, map.busiestMonth, 1))}</li>
        )}
      </ul>
    </section>
  );
}
