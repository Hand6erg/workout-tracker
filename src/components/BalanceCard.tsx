import { useState } from 'react';
import { BALANCE_MIN_SETS, trainingBalance, type BalanceTip } from '../lib/logic';
import { useStore } from '../lib/store';
import { ExerciseDetail } from '../views/ExercisesView';

function pct(a: number, b: number): number {
  return a + b ? Math.round((100 * a) / (a + b)) : 50;
}

function SplitBar({ left, leftN, right, rightN }: { left: string; leftN: number; right: string; rightN: number }) {
  const p = pct(leftN, rightN);
  const label = `${left} ${leftN} sæt, ${right.toLowerCase()} ${rightN} sæt`;
  return (
    <div className="bal-row" role="img" aria-label={label}>
      <div className="bal-labels" aria-hidden>
        <span>
          {left} <strong>{p} %</strong>
        </span>
        <span>
          <strong>{100 - p} %</strong> {right}
        </span>
      </div>
      <div className="bal-track" aria-hidden>
        <span className="bal-left" style={{ width: `${p}%` }} />
        <span className="bal-right" style={{ width: `${100 - p}%` }} />
      </div>
      <div className="bal-labels muted" aria-hidden>
        <small>{leftN} sæt</small>
        <small>{rightN} sæt</small>
      </div>
    </div>
  );
}

function Tip({ tip, onOpen }: { tip: BalanceTip; onOpen: (id: string) => void }) {
  if (!tip.suggestion) return <p className="bal-tip">💡 {tip.text}</p>;
  const suffix = ` – prøv at tilføje ${tip.suggestion.name}`;
  const head = tip.text.endsWith(suffix) ? tip.text.slice(0, -suffix.length) : tip.text;
  return (
    <p className="bal-tip">
      💡 {head} – prøv at tilføje{' '}
      <button className="link" onClick={() => onOpen(tip.suggestion!.id)} aria-label={`Åbn ${tip.suggestion.name}`}>
        {tip.suggestion.name}
      </button>
    </p>
  );
}

/** "Balance" i Profil (#368): pres/træk og overkrop/underkrop de sidste 4 uger med et tip til den svage side */
export function BalanceCard() {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const b = trainingBalance(state, Date.now());
  const total = b.push + b.pull + b.legs + b.core;
  const open = state.exercises.find((e) => e.id === openId);
  return (
    <section aria-label="Balance">
      <h2 className="section">⚖️ Balance</h2>
      <div className="card balance">
        {total < BALANCE_MIN_SETS ? (
          <p className="muted">Træn lidt mere, så viser vi din balance her.</p>
        ) : (
          <>
            <SplitBar left="Pres" leftN={b.push} right="Træk" rightN={b.pull} />
            <SplitBar left="Overkrop" leftN={b.upper} right="Underkrop" rightN={b.lower} />
            {b.tips.map((t) => (
              <Tip key={t.kind} tip={t} onOpen={setOpenId} />
            ))}
            <p className="muted small-print">Udførte arbejdssæt de sidste 4 uger.</p>
          </>
        )}
      </div>
      {open && <ExerciseDetail ex={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
