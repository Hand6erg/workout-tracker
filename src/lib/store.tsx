import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import { loadState, reducer, STORAGE_KEY, type Action } from './logic';
import type { AppState, Exercise } from './types';

interface Store {
  state: AppState;
  dispatch: Dispatch<Action>;
  exerciseById: (id: string) => Exercise | undefined;
}

const Ctx = createContext<Store | null>(null);

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
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

  const map = new Map(state.exercises.map((e) => [e.id, e]));
  return <Ctx.Provider value={{ state, dispatch, exerciseById: (id) => map.get(id) }}>{children}</Ctx.Provider>;
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
