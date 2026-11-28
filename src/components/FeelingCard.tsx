import { useMemo } from 'react';
import { FEELING_EMOJIS, feelingInsights, feelingTrend, recentFeeling } from '../lib/logic';
import { useStore } from '../lib/store';
import { LineChart } from './LineChart';

const fmt = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 1 });

/** "Sådan føltes det" i Profil (#384): gennemsnitlig vurdering pr. uge de sidste 12 uger, de sidste 4 ugers snit og tips */
export function FeelingCard() {
  const { state } = useStore();
  const now = Date.now();
  const data = useMemo(() => {
    const trend = feelingTrend(state.history, 12, now);
    return {
      points: trend.filter((w) => w.avg !== null).map((w) => ({ t: w.weekStart, value: w.avg! })),
      recent: recentFeeling(state.history, 4, now),
      tips: feelingInsights(state.history),
    };
  }, [state.history]);

  return (
    <section aria-label="Sådan føltes det">
      <h2 className="section">🙂 Sådan føltes det</h2>
      <div className="card feeling-card">
      {!data.points.length ? (
        <p className="muted">Bedøm dine træninger på opsummeringen for at se, hvordan de føles over tid.</p>
      ) : (
        <>
          {data.recent && (
            <p className="feeling-avg">
              <span aria-hidden>{FEELING_EMOJIS[Math.round(data.recent.avg) - 1]}</span> Snit de sidste 4 uger:{' '}
              <strong>{fmt(data.recent.avg)} af 5</strong>
            </p>
          )}
          <LineChart points={data.points} label="Gennemsnitlig vurdering pr. uge" format={fmt} />
          {data.tips.map((t) => (
            <p key={t} className="bal-tip">
              💡 {t}
            </p>
          ))}
        </>
      )}
      </div>
    </section>
  );
}
