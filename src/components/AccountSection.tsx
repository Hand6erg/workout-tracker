import { useState, type FormEvent } from 'react';
import { authenticate, type AuthMode } from '../lib/account';
import { useStore } from '../lib/store';
import { ConfirmButton } from './ui';

/** "Konto" i Profil: opret konto / log ind / log ud. Lokale data røres aldrig. */
export function AccountSection() {
  const { apiUrl, account, setAccount } = useStore();
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
        </div>
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
