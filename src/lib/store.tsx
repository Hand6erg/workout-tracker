import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { ACCOUNT_KEY, API_URL_OVERRIDE_KEY, parseAccount, resolveApiUrl, type Account } from './account';
import { hasOwnData, lastDeletion, loadState, reducer, STORAGE_KEY, trackedReducer, type Action, type Deletion } from './logic';
import { parseMeta, shouldAutoSync, SYNC_KEY, SyncEngine, type Choice, type SyncStatus } from './sync';
import type { AppState, Exercise, WeightUnit } from './types';

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
  /** "Synkronisér nu" */
  syncNow: () => void;
  /** Den seneste sletning, der kan fortrydes (#222) – kun i hukommelsen */
  undo: Deletion | null;
  /** Læg den seneste sletning tilbage */
  undoDelete: () => void;
  /** Glem den seneste sletning (bjælken lukkes) */
  clearUndo: () => void;
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
  const stateRef = useRef(state);
  stateRef.current = state;
  const [undo, setUndo] = useState<Deletion | null>(null);
  const dispatch: Dispatch<Action> = useCallback((a: Action) => {
    // Husk sletninger, så de kan fortrydes (#222). Synk-handlinger tæller ikke.
    if (a.type !== 'MERGE_REMOTE' && a.type !== 'IMPORT_STATE' && a.type !== 'UNDO_DELETE') {
      const prev = stateRef.current;
      const d = lastDeletion(prev, a, reducer(prev, a));
      if (d) setUndo(d);
    }
    rawDispatch({ ...a, at: Date.now() });
  }, []);
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const undoDelete = useCallback(() => {
    const d = undoRef.current;
    if (!d) return;
    undoRef.current = null;
    setUndo(null);
    rawDispatch({ type: 'UNDO_DELETE', deletion: d, at: Date.now() });
  }, []);
  const clearUndo = useCallback(() => setUndo(null), []);
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
    // Appen kommer frem igen (fx skiftet tilbage fra en anden app): hent det nyeste – men ikke midt i en træning
    const onVisible = () => {
      if (shouldAutoSync(stateRef.current, document.visibilityState === 'visible')) void engine.syncNow(false);
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      engine.stop();
      engineRef.current = null;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [apiUrl, account]);

  const resolveSync = (choice: Choice) => {
    if (sync.kind === 'choose') void engineRef.current?.resolve(choice, sync.remote);
  };

  const syncNow = () => void engineRef.current?.syncNow();

  const map = new Map(state.exercises.map((e) => [e.id, e]));
  return <Ctx.Provider value={{ state, dispatch, exerciseById: (id) => map.get(id), apiUrl, account, setAccount, sync, resolveSync, syncNow, undo, undoDelete, clearUndo }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore skal bruges inden i StoreProvider');
  return s;
}

/** Den valgte vægtenhed (#346): vægte gemmes i kg, men vises i kg eller lb */
export function useUnit(): WeightUnit {
  return useStore().state.unit ?? 'kg';
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
