import { loadState, STORAGE_KEY, syncPayload } from './logic';
import type { AppState } from './types';

/* ---------- Online-gemning med offline-kø ----------
 * Alt gemmes altid lokalt først (store.tsx). Denne motor sender derefter de nyeste data til API'et.
 * "Køen" er et dirty-flag i localStorage: er der ikke net, venter ændringen og sendes, når nettet er tilbage.
 */

export const SYNC_KEY = STORAGE_KEY.replace('state', 'sync');
export const SYNC_DEBOUNCE_MS = 1500;
export const SYNC_RETRY_MS = 30_000;

export interface SyncMeta {
  /** Serverens version, som de lokale data bygger på. null = endnu ikke koblet til kontoen. */
  version: number | null;
  /** Der er lokale ændringer, som serveren endnu ikke har bekræftet. */
  dirty: boolean;
  savedAt: number | null;
}

export const emptyMeta = (): SyncMeta => ({ version: null, dirty: false, savedAt: null });

export function parseMeta(raw: string | null): SyncMeta {
  try {
    const m = JSON.parse(raw ?? '') as Partial<SyncMeta>;
    return {
      version: Number.isInteger(m.version) ? (m.version as number) : null,
      dirty: m.dirty === true,
      savedAt: typeof m.savedAt === 'number' ? m.savedAt : null,
    };
  } catch {
    return emptyMeta();
  }
}

export interface Remote {
  state: AppState;
  version: number;
}

/** Læser serverens data sikkert ind (ukendt/ødelagt format → null). */
export function readRemote(body: unknown): Remote | null {
  const b = body as { state?: { version?: unknown }; version?: unknown } | null;
  if (!b || !Number.isInteger(b.version) || !b.state || b.state.version !== 1) return null;
  return { state: { ...loadState(JSON.stringify(b.state)), rest: null }, version: b.version as number };
}

export type PutResult =
  | { kind: 'saved'; version: number }
  | { kind: 'conflict'; current: Remote }
  | { kind: 'offline' }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

export type GetResult = { kind: 'found'; remote: Remote } | { kind: 'empty' } | Exclude<PutResult, { kind: 'saved' | 'conflict' }>;

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

export async function getRemote(apiUrl: string, token: string, fetchFn: typeof fetch): Promise<GetResult> {
  let res: Response;
  try {
    res = await fetchFn(`${apiUrl}/state`, { headers: authHeaders(token) });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 404) return { kind: 'empty' };
  if (res.status === 401) return { kind: 'unauthorized' };
  const remote = res.ok ? readRemote(await res.json().catch(() => null)) : null;
  return remote ? { kind: 'found', remote } : { kind: 'error' };
}

export async function putRemote(
  apiUrl: string,
  token: string,
  state: AppState,
  baseVersion: number | null,
  fetchFn: typeof fetch,
): Promise<PutResult> {
  let res: Response;
  try {
    res = await fetchFn(`${apiUrl}/state`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ state: syncPayload(state), baseVersion }),
    });
  } catch {
    return { kind: 'offline' };
  }
  if (res.status === 401) return { kind: 'unauthorized' };
  const body = (await res.json().catch(() => null)) as { version?: unknown; current?: unknown } | null;
  if (res.ok && Number.isInteger(body?.version)) return { kind: 'saved', version: body!.version as number };
  if (res.status === 409) {
    const current = readRemote(body?.current);
    if (current) return { kind: 'conflict', current };
  }
  return { kind: 'error' };
}

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'offline' }
  | { kind: 'error' }
  /** Der findes allerede data online, og telefonen har også data: brugeren skal vælge. */
  | { kind: 'choose'; remote: Remote };

/**
 * Må appen selv hente nyt fra serveren nu (når den åbnes/kommer frem igen)?
 * Ikke midt i en træning – så kan det, man er ved at skrive, ikke blive skiftet ud.
 */
export function shouldAutoSync(state: Pick<AppState, 'active'>, visible: boolean): boolean {
  return visible && !state.active;
}

export type Choice = 'phone' | 'online' | 'merge';

export interface SyncDeps {
  apiUrl: string;
  token: string;
  fetchFn: typeof fetch;
  getState: () => AppState;
  /** Erstatter de lokale data (kun når brugeren selv vælger "brug online"). */
  replaceState: (s: AppState) => void;
  /** Fletter serverens data ind i de lokale (reducer MERGE_REMOTE). */
  mergeRemote: (s: AppState) => void;
  hasOwnData: (s: AppState) => boolean;
  loadMeta: () => SyncMeta;
  saveMeta: (m: SyncMeta) => void;
  onStatus: (s: SyncStatus) => void;
  onUnauthorized: () => void;
  now?: () => number;
}

export class SyncEngine {
  private meta: SyncMeta;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight = false;
  private again = false;
  private stopped = false;
  private choosing = false;
  private skipNextChange = false;

  constructor(private d: SyncDeps) {
    this.meta = d.loadMeta();
  }

  private now() {
    return this.d.now ? this.d.now() : Date.now();
  }

  private setMeta(patch: Partial<SyncMeta>) {
    this.meta = { ...this.meta, ...patch };
    this.d.saveMeta(this.meta);
  }

  private status(s: SyncStatus) {
    if (!this.stopped) this.d.onStatus(s);
  }

  getMeta(): SyncMeta {
    return this.meta;
  }

  /** Kaldes når appen åbner, eller når man lige er logget ind. */
  async start(): Promise<void> {
    if (this.meta.savedAt) this.status({ kind: 'saved', at: this.meta.savedAt });
    if (this.meta.version !== null) return this.pull();
    // Første gang med denne konto: er der allerede data online?
    this.status({ kind: 'saving' });
    const r = await getRemote(this.d.apiUrl, this.d.token, this.d.fetchFn);
    if (this.stopped) return;
    switch (r.kind) {
      case 'empty':
        this.setMeta({ dirty: true });
        return this.flush();
      case 'found':
        if (!this.d.hasOwnData(this.d.getState())) return this.resolve('online', r.remote);
        this.choosing = true;
        return this.status({ kind: 'choose', remote: r.remote });
      case 'unauthorized':
        return this.d.onUnauthorized();
      default:
        this.status({ kind: r.kind });
        this.retryLater(() => this.start());
    }
  }

  /**
   * Henter nyere data fra serveren (fx gemt på en anden enhed) og sender derefter ventende ændringer.
   * Ventende lokale ændringer overskrives aldrig: så flettes der i stedet for at erstatte.
   */
  async pull(manual = false): Promise<void> {
    if (this.stopped || this.choosing || this.inflight || this.meta.version === null) return;
    this.inflight = true;
    if (manual) this.status({ kind: 'saving' });
    const r = await getRemote(this.d.apiUrl, this.d.token, this.d.fetchFn);
    this.inflight = false;
    if (this.stopped) return;
    if (r.kind === 'unauthorized') return this.d.onUnauthorized();
    // Brugeren bad selv om det: fortæl, hvis serveren ikke kunne nås
    if (manual && (r.kind === 'offline' || r.kind === 'error')) this.status({ kind: r.kind });
    if (r.kind === 'found' && r.remote.version !== this.meta.version) {
      if (this.meta.dirty) {
        this.d.mergeRemote(r.remote.state);
        this.setMeta({ version: r.remote.version });
      } else {
        // Ingen ventende ændringer her: serverens udgave er den nyeste
        const local = this.d.getState();
        this.d.replaceState({ ...r.remote.state, rest: local.rest });
        this.skipNextChange = true;
        this.setMeta({ version: r.remote.version, savedAt: this.now() });
        this.status({ kind: 'saved', at: this.meta.savedAt! });
      }
    } else if (r.kind === 'empty') {
      // Intet online (fx nulstillet konto): send telefonens data igen
      this.setMeta({ dirty: true });
    } else if (r.kind === 'found' && !this.meta.dirty) {
      // Serveren har intet nyt: telefonen er synkroniseret lige nu
      this.setMeta({ savedAt: this.now() });
      this.status({ kind: 'saved', at: this.meta.savedAt! });
    }
    if (this.meta.dirty) {
      this.again = false;
      return this.flush();
    }
  }

  /** "Synkronisér nu" i Profil, og når appen kommer frem igen. */
  syncNow(manual = true): Promise<void> {
    if (this.meta.version === null) return this.choosing ? Promise.resolve() : this.start();
    return this.pull(manual);
  }

  /** Brugerens valg, når der både er data på telefonen og online. */
  async resolve(choice: Choice, remote: Remote): Promise<void> {
    this.choosing = false;
    if (choice === 'online') {
      this.d.replaceState({ ...remote.state, rest: this.d.getState().rest });
      this.setMeta({ version: remote.version, dirty: false, savedAt: this.now() });
      this.skipNextChange = true;
      this.status({ kind: 'saved', at: this.meta.savedAt! });
      return;
    }
    if (choice === 'merge') this.d.mergeRemote(remote.state);
    this.setMeta({ version: remote.version, dirty: true });
    this.schedule();
  }

  /** Kaldes ved hver lokal ændring (efter den er gemt lokalt). */
  notifyChange(): void {
    if (this.skipNextChange) {
      this.skipNextChange = false;
      return;
    }
    // Endnu ikke koblet til kontoen – start()/resolve() tager sig af første upload
    if (this.meta.version === null && !this.meta.dirty) return;
    if (!this.meta.dirty) this.setMeta({ dirty: true });
    this.schedule();
  }

  private schedule(ms = SYNC_DEBOUNCE_MS) {
    if (this.stopped || this.choosing) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private retryLater(fn: () => void) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      fn();
    }, SYNC_RETRY_MS);
  }

  /** Sender de nyeste lokale data. Kan kaldes igen når nettet er tilbage. */
  async flush(): Promise<void> {
    if (this.stopped || this.choosing) return;
    if (this.meta.version === null && !this.meta.dirty) return void this.start();
    if (!this.meta.dirty) return;
    if (this.inflight) {
      this.again = true;
      return;
    }
    this.inflight = true;
    this.status({ kind: 'saving' });
    const sent = this.d.getState();
    const r = await putRemote(this.d.apiUrl, this.d.token, sent, this.meta.version, this.d.fetchFn);
    this.inflight = false;
    if (this.stopped) return;
    switch (r.kind) {
      case 'saved': {
        const unchanged = this.d.getState() === sent && !this.again;
        this.setMeta({ version: r.version, dirty: !unchanged, savedAt: this.now() });
        this.status({ kind: 'saved', at: this.meta.savedAt! });
        break;
      }
      case 'conflict':
        // En anden enhed har gemt imens: flet og prøv igen
        this.d.mergeRemote(r.current.state);
        this.setMeta({ version: r.current.version, dirty: true });
        this.again = false;
        this.schedule();
        return;
      case 'unauthorized':
        return this.d.onUnauthorized();
      default:
        this.status({ kind: r.kind });
        this.again = false;
        this.retryLater(() => void this.flush());
        return;
    }
    if (this.meta.dirty) {
      this.again = false;
      this.schedule(0);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
