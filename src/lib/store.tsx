import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { ACCOUNT_KEY, API_URL_OVERRIDE_KEY, parseAccount, resolveApiUrl, type Account } from './account';
import { loadState, reducer, STORAGE_KEY, type Action } from './logic';
import type { AppState, Exercise } from './types';

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  exerciseById: (id: string) => Exercise | undefined;
  /** null = online-gemning er ikke sat op (ingen API-adresse) */
  apiUrl: string | null;
  account: Account | null;
  setAccount: (a: Account | null) => void;
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
  const [state, dispatch] = useReducer(reducer, null, () => loadState(readStorage()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* fx privat browsing – appen virker stadig, men gemmer ikke */
    }
  }, [state]);

  const [apiUrl] = useState(() => resolveApiUrl(import.meta.env.VITE_API_URL, readStorage(API_URL_OVERRIDE_KEY)));
  const [account, setAccountState] = useState(() => parseAccount(readStorage(ACCOUNT_KEY)));
  const setAccount = (a: Account | null) => {
    setAccountState(a);
    try {
      if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch {
      /* ignorer */
    }
  };

  const map = new Map(state.exercises.map((e) => [e.id, e]));
  return <Ctx.Provider value={{ state, dispatch, exerciseById: (id) => map.get(id), apiUrl, account, setAccount }}>{children}</Ctx.Provider>;
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
