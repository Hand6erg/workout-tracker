import { useState } from 'react';
import { DEFAULT_SET_TARGETS, SET_TARGET_MAX, SET_TARGET_MIN, setTargetsOf } from '../lib/logic';
import { useStore } from '../lib/store';
import { MUSCLES, type Muscle } from '../lib/types';

/** "Ugentlige sæt" i Profil (#301): mål for hårde sæt pr. muskelgruppe pr. uge */
export function SetTargetsSection() {
  const { state } = useStore();
  const targets = setTargetsOf(state);
  return (
    <section aria-label="Ugentlige sæt">
      <h2 className="section">Ugentlige sæt</h2>
      <p className="muted small-print">
        Hvor mange hårde sæt du vil nå pr. muskelgruppe hver uge. 10–20 er et godt udgangspunkt.
      </p>
      <ul className="card set-targets">
        {MUSCLES.map((m) => (
          <TargetRow key={m} muscle={m} target={targets[m]} />
        ))}
      </ul>
    </section>
  );
}

function TargetRow({ muscle, target }: { muscle: Muscle; target: number | null }) {
  const { dispatch } = useStore();
  const [text, setText] = useState(target === null ? '' : String(target));
  // Følg med, hvis målet ændres udefra (fx synkronisering)
  const [seen, setSeen] = useState(target);
  if (seen !== target) {
    setSeen(target);
    if (target !== null && Number(text) !== target) setText(String(target));
  }
  const off = target === null;
  return (
    <li className="st-row">
      <span className="st-name">{muscle}</span>
      {!off && (
        <input
          type="number"
          inputMode="numeric"
          min={SET_TARGET_MIN}
          max={SET_TARGET_MAX}
          aria-label={`Mål for ${muscle} pr. uge`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isFinite(n) && n > 0) dispatch({ type: 'SET_SET_TARGET', muscle, value: n });
          }}
          onBlur={() => setText(String(target))}
        />
      )}
      {!off && <span className="muted st-unit">sæt</span>}
      <label className="st-off">
        <input
          type="checkbox"
          aria-label={`Slå mål for ${muscle} fra`}
          checked={off}
          onChange={(e) => {
            const value = e.target.checked ? null : DEFAULT_SET_TARGETS[muscle];
            if (value !== null) setText(String(value));
            dispatch({ type: 'SET_SET_TARGET', muscle, value });
          }}
        />
        Fra
      </label>
    </li>
  );
}
