import { useState } from 'react';
import { ConfirmButton, Empty, Modal } from '../components/ui';
import { bestSet, formatDuration, formatKg, formatSet, workoutVolume } from '../lib/logic';
import { useStore } from '../lib/store';
import type { Workout } from '../lib/types';

const dateFmt = new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function HistoryView() {
  const { state, exerciseById } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.history.find((w) => w.id === openId);

  return (
    <div className="page">
      <h1>Historik</h1>
      {!state.history.length && <Empty>Ingen træninger endnu. Afslut en træning, så dukker den op her.</Empty>}
      <div className="cards">
        {state.history.map((w) => (
          <button key={w.id} className="card as-button" onClick={() => setOpenId(w.id)} aria-label={`Træning ${w.name}`}>
            <h3>{w.name}</h3>
            <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
            <p className="stats">
              <span>⏱ {formatDuration((w.finishedAt ?? w.startedAt) - w.startedAt)}</span>
              <span>🏋️ {formatKg(workoutVolume(w))}</span>
            </p>
            <table className="mini">
              <tbody>
                {w.exercises.map((e) => {
                  const b = bestSet(e.sets);
                  return (
                    <tr key={e.id}>
                      <td>
                        {e.sets.length} × {exerciseById(e.exerciseId)?.name}
                      </td>
                      <td className="muted">{b ? formatSet(b) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </button>
        ))}
      </div>
      {open && <WorkoutDetail w={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function WorkoutDetail({ w, onClose }: { w: Workout; onClose: () => void }) {
  const { dispatch, exerciseById } = useStore();
  const [saved, setSaved] = useState(false);

  return (
    <Modal
      title={w.name}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn-secondary"
            disabled={saved}
            onClick={() => {
              dispatch({ type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: w.id, name: w.name });
              setSaved(true);
            }}
          >
            {saved ? 'Gemt som skabelon ✓' : 'Gem som skabelon'}
          </button>
          <ConfirmButton
            onConfirm={() => {
              dispatch({ type: 'DELETE_WORKOUT', workoutId: w.id });
              onClose();
            }}
          >
            Slet
          </ConfirmButton>
        </>
      }
    >
      <p className="muted cap">{dateFmt.format(w.startedAt)}</p>
      {w.exercises.map((e) => (
        <section key={e.id} className="detail-ex">
          <h3>{exerciseById(e.exerciseId)?.name}</h3>
          <ol>
            {e.sets.map((s) => (
              <li key={s.id}>
                {formatSet(s)}
                {s.rpe && <span className="muted"> @ RPE {s.rpe}</span>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Modal>
  );
}
