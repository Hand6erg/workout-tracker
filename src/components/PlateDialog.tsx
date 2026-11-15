import { useState } from 'react';
import { DEFAULT_BAR, DEFAULT_PLATES, formatKg, num, platesPerSide } from '../lib/logic';
import { Modal } from './ui';

const PLATE_STYLE: Record<string, { color: string; h: number }> = {
  '25': { color: '#d93a3a', h: 100 },
  '20': { color: '#2f6fd6', h: 100 },
  '15': { color: '#e5b81c', h: 88 },
  '10': { color: '#2f9e5b', h: 76 },
  '5': { color: '#e8e8e8', h: 60 },
  '2.5': { color: '#555b6b', h: 48 },
  '1.25': { color: '#a9afbd', h: 40 },
};

/** Skivevægte vises præcist (1,25 – ikke 1,3) */
const kg = (n: number) => String(n).replace('.', ',');

export function PlateDialog({
  initialWeight,
  onClose,
  barWeight = DEFAULT_BAR,
  plates = DEFAULT_PLATES,
}: {
  initialWeight: string;
  onClose: () => void;
  barWeight?: number;
  plates?: number[];
}) {
  const [weight, setWeight] = useState(initialWeight);
  const target = num(weight);
  const r = platesPerSide(target, barWeight, plates);

  return (
    <Modal title="Skiver pr. side" onClose={onClose}>
      <label className="field">
        Vægt i alt (kg)
        <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus />
      </label>
      <p className="muted">Stang: {formatKg(barWeight)}</p>
      {!target ? (
        <p className="muted">Skriv en vægt for at se skiverne.</p>
      ) : r.belowBar ? (
        <p role="status">Vægten er under stangens {formatKg(barWeight)}.</p>
      ) : (
        <>
          <div className="plate-bar" aria-hidden>
            <span className="sleeve" />
            {r.perSide.map((p, i) => {
              const st = PLATE_STYLE[String(p)] ?? { color: '#888', h: 50 };
              return <span key={i} className="plate" style={{ background: st.color, height: st.h }} />;
            })}
          </div>
          <p className="plate-list" role="status" aria-label="Skiver på hver side">
            {r.perSide.length ? `Hver side: ${r.perSide.map(kg).join(' + ')} kg` : 'Kun stangen'}
          </p>
          {r.remainder > 0 && (
            <p className="muted">
              Kan ikke ramme præcist – mangler {formatKg(r.remainder)} ({formatKg(target - r.remainder)} på stangen).
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
