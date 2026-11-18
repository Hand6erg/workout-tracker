import { useState, type FormEvent } from 'react';
import { authenticate, type AuthMode } from '../lib/account';
import { useStore } from '../lib/store';
import type { SyncStatus } from '../lib/sync';
import { ConfirmButton } from './ui';

/** "Konto" i Profil: opret konto / log ind / log ud. Lokale data røres aldrig. */
export function AccountSection() {
  const { state, apiUrl, account, setAccount, sync, resolveSync, syncNow } = useStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!apiUrl) {
    return (
      <section aria-label="Konto">
        <h2 className="section">Konto</h2>
        <p className="muted">Online-gemning er ikke sat op endnu. Appen virker som før, og alt gemmes på denne enhed.</p>
      </section>
    );
  }

  if (account) {
    return (
      <section aria-label="Konto">
        <h2 className="section">Konto</h2>
        <div className="card account-card">
          <small className="muted">Logget ind som</small>
          <strong data-testid="account-email">{account.email}</strong>
          <SyncLine sync={sync} />
          {sync.kind !== 'choose' && (
            <button type="button" className="btn-secondary sync-now" disabled={sync.kind === 'saving'} onClick={syncNow}>
              {sync.kind === 'saving' ? 'Synkroniserer…' : 'Synkronisér nu'}
            </button>
          )}
        </div>
        {sync.kind === 'choose' && (
          <div className="card choose" role="group" aria-label="Vælg hvilke data du vil beholde">
            <p>
              Der ligger allerede data på din konto ({sync.remote.state.history.length} træninger), og telefonen har også
              data ({state.history.length} træninger). Hvad vil du beholde?
            </p>
            <button className="btn-primary" onClick={() => resolveSync('merge')}>
              Flet begge
            </button>
            <button className="btn-secondary" onClick={() => resolveSync('phone')}>
              Behold telefonens
            </button>
            <ConfirmButton
              className="btn-secondary"
              confirmText="Tryk igen – telefonens data erstattes"
              onConfirm={() => resolveSync('online')}
            >
              Brug dem online
            </ConfirmButton>
          </div>
        )}
        <ConfirmButton className="btn-secondary wide" onConfirm={() => setAccount(null)}>
          Log ud
        </ConfirmButton>
        <p className="muted">Dine træninger bliver på denne enhed, når du logger ud.</p>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await authenticate(apiUrl, mode, email, password);
    setBusy(false);
    if (r.ok) {
      setPassword('');
      setAccount(r.account);
    } else setError(r.message);
  };

  return (
    <section aria-label="Konto">
      <h2 className="section">Konto</h2>
      <div className="chips" role="group" aria-label="Vælg login eller ny konto">
        <button type="button" className={`chip ${mode === 'login' ? 'on' : ''}`} aria-pressed={mode === 'login'} onClick={() => setMode('login')}>
          Log ind
        </button>
        <button
          type="button"
          className={`chip ${mode === 'register' ? 'on' : ''}`}
          aria-pressed={mode === 'register'}
          onClick={() => setMode('register')}
        >
          Ny konto
        </button>
      </div>
      <form onSubmit={submit} aria-label={mode === 'login' ? 'Log ind' : 'Opret konto'}>
        <label className="field">
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Adgangskode{mode === 'register' ? ' (mindst 8 tegn)' : ''}
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary wide" disabled={busy}>
          {busy ? 'Vent…' : mode === 'login' ? 'Log ind' : 'Opret konto'}
        </button>
      </form>
      <p className="muted">Med en konto kan dine træninger gemmes online, så de ikke forsvinder.</p>
    </section>
  );
}

const clock = (t: number) => {
  const d = new Date(t);
  const time = `kl. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} ${time}`;
};

function SyncLine({ sync }: { sync: SyncStatus }) {
  const text = {
    idle: '',
    choose: '',
    saving: 'Synkroniserer…',
    saved: sync.kind === 'saved' ? `Sidst synkroniseret ${clock(sync.at)}` : '',
    offline: 'Venter på net – ændringer er gemt på telefonen og sendes, når du er online igen.',
    error: 'Kunne ikke gemme online lige nu. Prøver igen om lidt.',
  }[sync.kind];
  return (
    <small role="status" aria-label="Online-status" className={`sync-line ${sync.kind}`}>
      {text}
    </small>
  );
}
