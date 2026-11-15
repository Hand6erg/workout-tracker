import { useRef, useState } from 'react';
import { ConfirmButton } from '../components/ui';
import { formatKg, initialState, loadState, toCsv, workoutVolume } from '../lib/logic';
import { useStore } from '../lib/store';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProfileView() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const total = state.history.reduce((a, w) => a + workoutVolume(w), 0);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <h1>Profil</h1>
      <div className="kpis">
        <div>
          <small>Træninger</small>
          <strong data-testid="total-workouts">{state.history.length}</strong>
        </div>
        <div>
          <small>Samlet løftet</small>
          <strong>{formatKg(total)}</strong>
        </div>
      </div>

      <h2 className="section">Indstillinger</h2>
      <label className="field">
        Pausetimer efter hvert sæt (sekunder, 0 = slået fra)
        <input
          type="number"
          min={0}
          max={600}
          step={15}
          value={state.restSeconds}
          onChange={(e) => dispatch({ type: 'SET_REST_SECONDS', seconds: Number(e.target.value) })}
        />
      </label>

      <h2 className="section">Data</h2>
      <p className="muted">Alt gemmes kun på denne enhed. Tag en backup, hvis du skifter telefon.</p>
      <div className="stack">
        <button className="btn-secondary" onClick={() => download(`loeft-${stamp}.csv`, toCsv(state), 'text/csv')}>
          Eksportér CSV
        </button>
        <button
          className="btn-secondary"
          onClick={() => download(`loeft-backup-${stamp}.json`, JSON.stringify(state), 'application/json')}
        >
          Tag backup (JSON)
        </button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Gendan backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            const next = loadState(text);
            if (text && next.history.length === 0 && !text.includes('"version":1')) {
              setMsg('Filen kunne ikke læses.');
              return;
            }
            dispatch({ type: 'IMPORT_STATE', state: { ...next, active: null, rest: null } });
            setMsg(`Gendannet ${next.history.length} træninger.`);
          }}
        />
        <ConfirmButton onConfirm={() => dispatch({ type: 'IMPORT_STATE', state: initialState() })}>
          Slet alle data
        </ConfirmButton>
      </div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
