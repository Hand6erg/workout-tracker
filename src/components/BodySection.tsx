import { useState } from 'react';
import { num, uid } from '../lib/logic';
import { useStore } from '../lib/store';
import { LineChart } from './LineChart';
import { ConfirmButton, Empty } from './ui';
import type { BodyMeasurement } from '../lib/types';

const dateFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
const dec = (n: number) => String(n).replace('.', ',');

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Metric = 'weight' | 'bodyFat' | 'waist';
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'weight', label: 'Vægt', unit: 'kg' },
  { key: 'bodyFat', label: 'Fedt', unit: '%' },
  { key: 'waist', label: 'Talje', unit: 'cm' },
];

function BodyChart({ log }: { log: BodyMeasurement[] }) {
  const [metric, setMetric] = useState<Metric>('weight');
  const meta = METRICS.find((m) => m.key === metric)!;
  const points = log
    .filter((m) => m[metric] !== undefined)
    .map((m) => ({ t: m.date, value: m[metric] as number }))
    .sort((a, b) => a.t - b.t);
  const fmt = (n: number) => dec(Math.round(n * 10) / 10);
  const first = points[0];
  const last = points[points.length - 1];
  const change = last && first ? Math.round((last.value - first.value) * 10) / 10 : 0;

  return (
    <div className="card chart-card body-chart">
      <div className="seg" role="group" aria-label="Vis udvikling for">
        {METRICS.map((m) => (
          <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {points.length < 2 ? (
        <p className="muted">Tilføj flere målinger for at se en graf.</p>
      ) : (
        <>
          <LineChart
            points={points}
            format={fmt}
            label={`${meta.label} over tid: fra ${fmt(first.value)} til ${fmt(last.value)} ${meta.unit}`}
          />
          <p className="muted">
            Seneste: <strong>{fmt(last.value)} {meta.unit}</strong> · Ændring:{' '}
            <strong>
              {change > 0 ? '+' : ''}
              {fmt(change)} {meta.unit}
            </strong>
          </p>
        </>
      )}
    </div>
  );
}

/** Kropsmål under Profil: registrér og se målinger */
export function BodySection() {
  const { state, dispatch } = useStore();
  const [date, setDate] = useState(todayInput);
  const [weight, setWeight] = useState('');
  const [fat, setFat] = useState('');
  const [waist, setWaist] = useState('');
  const canSave = [weight, fat, waist].some((v) => num(v) > 0) && !!date;

  function save() {
    // Kl. 12 lokal tid, så datoen ikke skifter med tidszoner
    const [y, m, d] = date.split('-').map(Number);
    dispatch({
      type: 'ADD_MEASUREMENT',
      id: uid(),
      date: new Date(y, m - 1, d, 12).getTime(),
      weight: num(weight) || undefined,
      bodyFat: num(fat) || undefined,
      waist: num(waist) || undefined,
    });
    setWeight('');
    setFat('');
    setWaist('');
  }

  return (
    <section aria-label="Kropsmål">
      <h2 className="section">Kropsmål</h2>
      <div className="card body-form">
        <label className="field">
          Dato
          <input type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="body-grid">
          <label className="field">
            Vægt (kg)
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label className="field">
            Fedt (%)
            <input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </label>
          <label className="field">
            Talje (cm)
            <input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
          </label>
        </div>
        <button className="btn-primary wide" disabled={!canSave} onClick={save}>
          Gem måling
        </button>
      </div>
      {state.bodyLog.length > 0 && <BodyChart log={state.bodyLog} />}
      {!state.bodyLog.length ? (
        <Empty>Ingen målinger endnu.</Empty>
      ) : (
        <ul className="list" aria-label="Målinger">
          {state.bodyLog.map((m) => (
            <li key={m.id} className="list-row static">
              <span>
                <strong>{dateFmt.format(m.date)}</strong>
                <small>
                  {[
                    m.weight !== undefined && `${dec(m.weight)} kg`,
                    m.bodyFat !== undefined && `${dec(m.bodyFat)} % fedt`,
                    m.waist !== undefined && `talje ${dec(m.waist)} cm`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <ConfirmButton
                className="btn-ghost small"
                confirmText="Slet?"
                onConfirm={() => dispatch({ type: 'DELETE_MEASUREMENT', id: m.id })}
              >
                Slet
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
