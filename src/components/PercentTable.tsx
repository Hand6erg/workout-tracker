import { useState } from 'react';
import { formatKg, formatPlates, percentTable, tableOneRM } from '../lib/logic';
import { useStore } from '../lib/store';

/** "Procenttabel" på øvelsessiden (#251): træningsvægte 95 %–50 % af 1RM, tryk for skiver pr. side */
export function PercentTable({ exerciseId }: { exerciseId: string }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const rows = percentTable(state, exerciseId);
  const base = tableOneRM(state, exerciseId);
  if (!rows.length || !base) return null;

  return (
    <section aria-label="Procenttabel" className="pct-table">
      <button className="pct-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="section">％ Procenttabel</span>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <p className="muted pct-base">
            Bygger på: {base.source === 'tested' ? 'testet 1RM' : 'estimeret 1RM'} ({formatKg(base.oneRM)})
          </p>
          <ul className="pct-list">
            {rows.map((r) => {
              const on = picked === r.pct;
              return (
                <li key={r.pct}>
                  <button
                    className={`pct-row ${on ? 'on' : ''}`}
                    aria-label={`${r.pct} % – ${formatKg(r.weight)}`}
                    aria-expanded={on}
                    onClick={() => setPicked(on ? null : r.pct)}
                  >
                    <span className="pct-pct">{r.pct} %</span>
                    <strong>{formatKg(r.weight)}</strong>
                  </button>
                  {on && <p className="pct-plates">{formatPlates(r.weight, state.barWeight, state.plates)}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
