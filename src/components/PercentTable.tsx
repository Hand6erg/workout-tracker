import { useState } from 'react';
import { exerciseKind, formatKg, formatPlates, isBodyweight, num, percentTable, tableOneRM } from '../lib/logic';
import { useStore } from '../lib/store';

/**
 * "Procenttabel" på øvelsessiden (#251): træningsvægte 95 %–50 % af 1RM, tryk for skiver pr. side.
 * Man kan skrive en testet 1RM, som så bruges i stedet for estimatet (#252).
 */
export function PercentTable({ exerciseId }: { exerciseId: string }) {
  const { state, dispatch } = useStore();
  const ex = state.exercises.find((e) => e.id === exerciseId);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [tested, setTested] = useState(ex?.testedOneRM ? String(ex.testedOneRM).replace('.', ',') : '');
  if (!ex || exerciseKind(state, exerciseId) !== 'reps' || isBodyweight(state, exerciseId)) return null;
  const rows = percentTable(state, exerciseId);
  const base = tableOneRM(state, exerciseId);

  const onTested = (v: string) => {
    setTested(v);
    const w = num(v);
    dispatch({ type: 'SET_TESTED_1RM', exerciseId, weight: w > 0 ? w : undefined });
  };

  return (
    <section aria-label="Procenttabel" className="pct-table">
      <button className="pct-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="section">％ Procenttabel</span>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div className="pct-tested">
            <label className="field">
              Testet 1RM (kg)
              <input
                inputMode="decimal"
                placeholder={base?.source === 'estimated' ? `Est. ${formatKg(base.oneRM)}` : 'Fx 120'}
                value={tested}
                onChange={(e) => onTested(e.target.value)}
              />
            </label>
            {ex.testedOneRM ? (
              <button className="btn-secondary small" onClick={() => onTested('')}>
                Brug estimat
              </button>
            ) : null}
          </div>
          {!base ? (
            <p className="muted pct-base">Log et sæt eller skriv din testede 1RM for at se tabellen.</p>
          ) : (
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
        </>
      )}
    </section>
  );
}
