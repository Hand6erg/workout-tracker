import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { ACCOUNT_KEY, API_URL_OVERRIDE_KEY, parseAccount, resolveApiUrl, type Account } from './account';
import { hasOwnData, loadState, STORAGE_KEY, trackedReducer, type Action } from './logic';
import { parseMeta, SYNC_KEY, SyncEngine, type Choice, type SyncStatus } from './sync';
import type { AppState, Exercise } from './types';

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  exerciseById: (id: string) => Exercise | undefined;
  /** null = online-gemning er ikke sat op (ingen API-adresse) */
  apiUrl: string | null;
  account: Account | null;
  setAccount: (a: Account | null) => void;
  sync: SyncStatus;
  resolveSync: (choice: Choice) => void;
}

const Ctx = createContext<Store | null>(null);

function readStorage(key = STORAGE_KEY): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(trackedReducer, null, () => loadState(readStorage()));
  // Hver handling får et tidspunkt, så ændringer kan flettes korrekt mellem enheder (#38)
  const dispatch: Dispatch<Action> = useCallback((a: Action) => rawDispatch({ ...a, at: Date.now() }), []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const prevState = useRef(state);
  const engineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* fx privat browsing – appen virker stadig, men gemmer ikke */
    }
    // Gemt lokalt – nu må ændringen sendes online
    if (prevState.current !== state) {
      prevState.current = state;
      engineRef.current?.notifyChange();
    }
  }, [state]);

  const [apiUrl] = useState(() => resolveApiUrl(import.meta.env.VITE_API_URL, readStorage(API_URL_OVERRIDE_KEY)));
  const [account, setAccountState] = useState(() => parseAccount(readStorage(ACCOUNT_KEY)));
  const setAccount = (a: Account | null) => {
    setAccountState(a);
    try {
      if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
      else localStorage.removeItem(ACCOUNT_KEY);
      // Ny konto eller logget ud: kobling til serveren starter forfra (lokale data røres ikke)
      localStorage.removeItem(SYNC_KEY);
    } catch {
      /* ignorer */
    }
  };

  const [sync, setSync] = useState<SyncStatus>({ kind: 'idle' });
  useEffect(() => {
    setSync({ kind: 'idle' });
    if (!apiUrl || !account) return;
    const engine = new SyncEngine({
      apiUrl,
      token: account.token,
      fetchFn: (...args) => fetch(...args),
      getState: () => stateRef.current,
      replaceState: (s) => dispatch({ type: 'IMPORT_STATE', state: s }),
      mergeRemote: (remote) => dispatch({ type: 'MERGE_REMOTE', remote }),
      hasOwnData,
      loadMeta: () => parseMeta(readStorage(SYNC_KEY)),
      saveMeta: (m) => {
        try {
          localStorage.setItem(SYNC_KEY, JSON.stringify(m));
        } catch {
          /* ignorer */
        }
      },
      onStatus: setSync,
      onUnauthorized: () => setAccount(null),
    });
    engineRef.current = engine;
    void engine.start();
    const onOnline = () => void engine.flush();
    window.addEventListener('online', onOnline);
    return () => {
      engine.stop();
      engineRef.current = null;
      window.removeEventListener('online', onOnline);
    };
  }, [apiUrl, account]);

  const resolveSync = (choice: Choice) => {
    if (sync.kind === 'choose') void engineRef.current?.resolve(choice, sync.remote);
  };

  const map = new Map(state.exercises.map((e) => [e.id, e]));
  return <Ctx.Provider value={{ state, dispatch, exerciseById: (id) => map.get(id), apiUrl, account, setAccount, sync, resolveSync }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore skal bruges inden i StoreProvider');
  return s;
}

/** Re-render hvert sekund (til ure og timere) */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
