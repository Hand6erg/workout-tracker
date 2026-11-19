import { useEffect, useState } from 'react';
import { wantsWakeLock } from './logic';
import { useStore } from './store';

type Sentinel = { released?: boolean; release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void };
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

function api(): WakeLockApi | undefined {
  return typeof navigator !== 'undefined' ? (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock : undefined;
}

/** Kan browseren holde skærmen tændt (#155)? */
export function wakeLockSupported(): boolean {
  return !!api();
}

function useVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/**
 * Holder skærmen tændt, mens en træning er i gang (#155). Browseren slipper låsen, når appen skjules,
 * så den bedes om igen, når appen bliver synlig. Browsere uden Wake Lock ignoreres stille.
 */
export function useWakeLock() {
  const { state } = useStore();
  const visible = useVisible();
  const want = wantsWakeLock(state, visible);

  useEffect(() => {
    const wl = api();
    if (!want || !wl) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    wl.request('screen').then(
      (s) => {
        if (cancelled) s.release().catch(() => {});
        else sentinel = s;
      },
      () => {},
    );
    return () => {
      cancelled = true;
      if (sentinel && !sentinel.released) sentinel.release().catch(() => {});
    };
  }, [want]);
}
