import { useState } from "react";
import {
  DEFAULT_SET_TARGETS,
  SET_TARGET_MAX,
  SET_TARGET_MIN,
  setTargetsOf,
  weeklySetProgress,
} from "../lib/logic";
import { useStore } from "../lib/store";
import { MUSCLES, type Muscle } from "../lib/types";

/** "Ugentlige sæt" i Profil (#301): mål for hårde sæt pr. muskelgruppe pr. uge */
export function SetTargetsSection() {
  const { state } = useStore();
  const targets = setTargetsOf(state);
  return (
    <section aria-label="Ugentlige sæt">
      <h2 className="section">Ugentlige sæt</h2>
      <p className="muted small-print">
        Hvor mange hårde sæt du vil nå pr. muskelgruppe hver uge. 10–20 er et
        godt udgangspunkt.
      </p>
      <ul className="card set-targets">
        {MUSCLES.map((m) => (
          <TargetRow key={m} muscle={m} target={targets[m]} />
        ))}
      </ul>
    </section>
  );
}

function TargetRow({
  muscle,
  target,
}: {
  muscle: Muscle;
  target: number | null;
}) {
  const { dispatch } = useStore();
  const [text, setText] = useState(target === null ? "" : String(target));
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
            if (e.target.value.trim() !== "" && Number.isFinite(n) && n > 0)
              dispatch({ type: "SET_SET_TARGET", muscle, value: n });
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
            dispatch({ type: "SET_SET_TARGET", muscle, value });
          }}
        />
        Fra
      </label>
    </li>
  );
}

/** "Ugens sæt" som små ringe (#302) – på startskærmen og kompakt i træningen */
export function SetTargetRings({ compact = false }: { compact?: boolean }) {
  const { state } = useStore();
  const rows = weeklySetProgress(state, Date.now()).filter(
    (r) => r.target !== null,
  );
  if (!rows.length) return null;
  return (
    <section
      className={`set-rings${compact ? " compact" : ""}`}
      aria-label="Ugens sæt"
    >
      {!compact && <h2 className="section">Ugens sæt</h2>}
      <ul>
        {rows.map((r) => {
          const target = r.target!;
          const frac = Math.min(1, r.done / target);
          const label = `${r.muscle}: ${r.done} af ${target} sæt denne uge${r.reached ? ", mål nået" : ""}`;
          return (
            <li
              key={r.muscle}
              className={r.reached ? "reached" : ""}
              role="img"
              aria-label={label}
            >
              <svg viewBox="0 0 36 36" aria-hidden>
                <circle className="ring-bg" cx="18" cy="18" r="15" />
                {frac > 0 && (
                  <circle
                    className="ring-fg"
                    cx="18"
                    cy="18"
                    r="15"
                    pathLength={100}
                    strokeDasharray={`${frac * 100} 100`}
                    transform="rotate(-90 18 18)"
                  />
                )}
              </svg>
              <span className="ring-text" aria-hidden>
                <strong>{r.muscle}</strong>
                <small>
                  {r.done}/{target}
                  {r.reached ? " ✓" : ""}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
