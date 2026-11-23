import { useState } from 'react';
import { validRepRange } from '../lib/logic';
import { useStore } from '../lib/store';
import { MAX_TEMPLATE_REPS, type Template } from '../lib/types';
import { Modal } from './ui';

/** "Rediger reps" (#258): rep-interval ("Fra"–"Til") pr. øvelse i en skabelon. Tomme felter = intet interval. */
export function RepRangeSheet({ template, onClose }: { template: Template; onClose: () => void }) {
  const { dispatch, exerciseById } = useStore();
  const [rows, setRows] = useState(() =>
    template.exercises.map((e) => ({ min: e.repMin ? String(e.repMin) : '', max: e.repMax ? String(e.repMax) : '' })),
  );
  const [error, setError] = useState('');

  // Samme øvelse to gange i skabelonen får et nummer, så felterne har hver sin etiket
  const names = template.exercises.map((e) => exerciseById(e.exerciseId)?.name ?? '?');
  const label = (i: number) => {
    const same = names.filter((n) => n === names[i]).length;
    return same > 1 ? `${names[i]} (${names.slice(0, i + 1).filter((n) => n === names[i]).length})` : names[i];
  };

  const set = (i: number, patch: Partial<{ min: string; max: string }>) => {
    setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    setError('');
  };

  const save = () => {
    const parsed = rows.map((r) => {
      const min = r.min.trim();
      const max = r.max.trim();
      if (!min && !max) return { min: null, max: null };
      // Kun ét felt udfyldt = samme tal i begge (fx "5" = præcis 5 reps)
      const a = Number(min || max);
      const b = Number(max || min);
      return { min: a, max: b };
    });
    const bad = parsed.findIndex((p) => p.min !== null && !validRepRange(p.min, p.max));
    if (bad >= 0) {
      setError(`${label(bad)}: brug hele tal fra 1 til ${MAX_TEMPLATE_REPS}, og "Fra" må ikke være større end "Til".`);
      return;
    }
    parsed.forEach((p, index) => dispatch({ type: 'SET_TEMPLATE_REPS', templateId: template.id, index, min: p.min, max: p.max }));
    onClose();
  };

  return (
    <Modal
      title={`Reps: ${template.name}`}
      onClose={onClose}
      footer={
        <button className="btn-primary wide" onClick={save}>
          Gem
        </button>
      }
    >
      <p className="muted rep-intro">Sæt et rep-interval, fx 8–12. Lad felterne stå tomme for ingen interval.</p>
      <ul className="rep-ranges">
        {template.exercises.map((e, i) => (
          <li key={i} className="rep-range-row">
            <span className="rep-range-name">
              {label(i)}
              <small className="muted"> · {e.sets} sæt</small>
            </span>
            <input
              inputMode="numeric"
              aria-label={`Fra ${label(i)}`}
              placeholder="Fra"
              value={rows[i].min}
              onChange={(ev) => set(i, { min: ev.target.value })}
            />
            <span className="muted">–</span>
            <input
              inputMode="numeric"
              aria-label={`Til ${label(i)}`}
              placeholder="Til"
              value={rows[i].max}
              onChange={(ev) => set(i, { max: ev.target.value })}
            />
          </li>
        ))}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
