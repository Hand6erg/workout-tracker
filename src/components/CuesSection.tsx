import { useState } from 'react';
import { canEditCues, exerciseCues } from '../lib/logic';
import { useStore } from '../lib/store';

/** "Teknik" på øvelsessiden (#338): korte tips som punkter. Egne øvelser kan få egne tips. */
export function CuesSection({ exerciseId }: { exerciseId: string }) {
  const { state, dispatch } = useStore();
  const cues = exerciseCues(state, exerciseId);
  const editable = canEditCues(state, exerciseId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!cues.length && !editable) return null;

  const startEdit = () => {
    setDraft(cues.join('\n'));
    setEditing(true);
  };
  const save = () => {
    dispatch({ type: 'SET_EXERCISE_CUES', exerciseId, cues: draft });
    setEditing(false);
  };

  return (
    <section className="card cues" aria-label="Teknik">
      <div className="row-between">
        <h3 className="section">🎯 Teknik</h3>
        {editable && !editing && (
          <button className="btn-ghost small" onClick={startEdit}>
            Redigér teknik
          </button>
        )}
      </div>
      {editing ? (
        <>
          <label className="field">
            Dine tips (ét pr. linje)
            <textarea
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={'Fx Skuldrene på bænken\nPres gennem hælene'}
              autoFocus
            />
          </label>
          <div className="cues-actions">
            <button className="btn-ghost small" onClick={() => setEditing(false)}>
              Annullér
            </button>
            <button className="btn-primary small" onClick={save}>
              Gem teknik
            </button>
          </div>
        </>
      ) : cues.length ? (
        <ul className="cues-list">
          {cues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Ingen tips endnu. Tryk "Redigér teknik" og skriv et tip pr. linje – fx hvordan du stiller dig op.</p>
      )}
    </section>
  );
}
