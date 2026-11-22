import { useEffect } from 'react';
import { useStore } from '../lib/store';

/** Hvor længe "Fortryd" kan trykkes efter en sletning */
export const UNDO_TIMEOUT_MS = 6000;

/** Lille bjælke efter en sletning: "Sæt slettet · Fortryd" (#222, #223) */
export function UndoBar({ inWorkout }: { inWorkout: boolean }) {
  const { undo, undoDelete, clearUndo } = useStore();

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(clearUndo, UNDO_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [undo, clearUndo]);

  const show = !!undo;
  return (
    <div className={`undo-bar ${inWorkout ? 'in-workout' : ''}`} role="status" aria-label="Fortryd sletning" hidden={!show}>
      {show && (
        <>
          <span>{undo.label}</span>
          <button className="undo-btn" onClick={undoDelete} aria-label={`Fortryd: ${undo.label}`}>
            Fortryd
          </button>
        </>
      )}
    </div>
  );
}
