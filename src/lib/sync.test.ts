import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasOwnData, initialState, mergeStates, reducer, syncPayload } from './logic';
import { emptyMeta, parseMeta, readRemote, SYNC_DEBOUNCE_MS, SYNC_KEY, SYNC_RETRY_MS, SyncEngine, type SyncMeta, type SyncStatus } from './sync';
import type { AppState, Workout } from './types';

const w = (id: string, startedAt: number, name = id): Workout => ({ id, name, startedAt, finishedAt: startedAt + 1, exercises: [] });
const withHistory = (...history: Workout[]): AppState => ({ ...initialState(), history });

describe('fletning', () => {
  it('samler træninger efter id, nyeste først, og lokal udgave vinder', () => {
    const local = withHistory(w('a', 3, 'lokal'), w('b', 1));
    const remote = withHistory(w('a', 3, 'online'), w('c', 2));
    const m = mergeStates(local, remote);
    expect(m.history.map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(m.history[0].name).toBe('lokal');
  });

  it('beholder egne øvelser og skabeloner fra begge sider', () => {
    const local = initialState();
    local.exercises = [...local.exercises, { id: 'mine', name: 'Min', muscle: 'Ben', equipment: 'Stang', custom: true }];
    const remote = initialState();
    remote.templates = [...remote.templates, { id: 'tpl-x', name: 'X', exercises: [] }];
    const m = reducer(local, { type: 'MERGE_REMOTE', remote });
    expect(m.exercises.some((e) => e.id === 'mine')).toBe(true);
    expect(m.templates.some((t) => t.id === 'tpl-x')).toBe(true);
    expect(m.exercises.length).toBe(local.exercises.length);
  });

  it('sender ikke pausetimeren og kender forskel på tom og brugt app', () => {
    expect('rest' in syncPayload({ ...initialState(), rest: { endsAt: 1, total: 1 } })).toBe(false);
    expect(hasOwnData(initialState())).toBe(false);
    expect(hasOwnData(withHistory(w('a', 1)))).toBe(true);
  });

  it('læser serverdata sikkert', () => {
    expect(readRemote({ state: withHistory(w('a', 1)), version: 3 })?.state.history).toHaveLength(1);
    expect(readRemote({ state: { version: 2 }, version: 3 })).toBeNull();
    expect(readRemote(null)).toBeNull();
    expect(parseMeta('{')).toEqual(emptyMeta());
    expect(parseMeta(JSON.stringify({ version: 2, dirty: true, savedAt: 5 }))).toEqual({ version: 2, dirty: true, savedAt: 5 });
    expect(SYNC_KEY).toBe('loeft-sync-v1');
  });
});

/* ---------- Kø-motoren mod en falsk server ---------- */

interface FakeServer {
  state: unknown;
  version: number | null;
  online: boolean;
  puts: number;
}

function fakeFetch(server: FakeServer): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    if (!server.online) throw new TypeError('Failed to fetch');
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (!init?.method) {
      return server.version === null ? json(404, { error: 'not_found' }) : json(200, { state: server.state, version: server.version });
    }
    server.puts++;
    const { state, baseVersion } = JSON.parse(String(init.body));
    if (server.version !== null && baseVersion !== server.version) {
      return json(409, { error: 'conflict', current: { state: server.state, version: server.version } });
    }
    server.state = state;
    server.version = (server.version ?? 0) + 1;
    return json(200, { state, version: server.version });
  }) as typeof fetch;
}

function setup(local: AppState, server: FakeServer, meta: SyncMeta = emptyMeta()) {
  const app = { state: local, meta, statuses: [] as SyncStatus[], loggedOut: false };
  const engine = new SyncEngine({
    apiUrl: 'https://api',
    token: 't',
    fetchFn: fakeFetch(server),
    getState: () => app.state,
    replaceState: (s) => (app.state = s),
    mergeRemote: (r) => (app.state = reducer(app.state, { type: 'MERGE_REMOTE', remote: r })),
    hasOwnData,
    loadMeta: () => app.meta,
    saveMeta: (m) => (app.meta = m),
    onStatus: (s) => app.statuses.push(s),
    onUnauthorized: () => (app.loggedOut = true),
    now: () => 1000,
  });
  const change = (s: AppState) => {
    app.state = s;
    engine.notifyChange();
  };
  return { app, engine, change };
}

const last = (s: SyncStatus[]) => s[s.length - 1];

describe('online-gemning', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uploader telefonens data første gang, når intet ligger online', async () => {
    const server: FakeServer = { state: null, version: null, online: true, puts: 0 };
    const { app, engine } = setup(withHistory(w('a', 1)), server);
    await engine.start();
    expect(server.version).toBe(1);
    expect((server.state as AppState).history).toHaveLength(1);
    expect(app.meta).toEqual({ version: 1, dirty: false, savedAt: 1000 });
    expect(last(app.statuses)).toEqual({ kind: 'saved', at: 1000 });
  });

  it('spørger når både telefon og konto har data – og fletter uden at slette noget', async () => {
    const server: FakeServer = { state: withHistory(w('o', 2)), version: 4, online: true, puts: 0 };
    const { app, engine } = setup(withHistory(w('p', 1)), server);
    await engine.start();
    const choose = last(app.statuses);
    expect(choose.kind).toBe('choose');
    expect(server.puts).toBe(0);
    if (choose.kind !== 'choose') return;
    await engine.resolve('merge', choose.remote);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(app.state.history.map((x) => x.id)).toEqual(['o', 'p']);
    expect((server.state as AppState).history.map((x) => x.id)).toEqual(['o', 'p']);
    expect(server.version).toBe(5);
  });

  it('kan beholde telefonens eller bruge dem online', async () => {
    const remoteState = withHistory(w('o', 2));
    const s1: FakeServer = { state: remoteState, version: 1, online: true, puts: 0 };
    const a = setup(withHistory(w('p', 1)), s1);
    await a.engine.start();
    await a.engine.resolve('phone', (last(a.app.statuses) as Extract<SyncStatus, { kind: 'choose' }>).remote);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect((s1.state as AppState).history.map((x) => x.id)).toEqual(['p']);

    const s2: FakeServer = { state: remoteState, version: 1, online: true, puts: 0 };
    const b = setup(withHistory(w('p', 1)), s2);
    await b.engine.start();
    await b.engine.resolve('online', (last(b.app.statuses) as Extract<SyncStatus, { kind: 'choose' }>).remote);
    expect(b.app.state.history.map((x) => x.id)).toEqual(['o']);
    expect(s2.puts).toBe(0);
  });

  it('henter automatisk, når telefonen er tom', async () => {
    const server: FakeServer = { state: withHistory(w('o', 2)), version: 2, online: true, puts: 0 };
    const { app, engine } = setup(initialState(), server);
    await engine.start();
    expect(app.state.history.map((x) => x.id)).toEqual(['o']);
    expect(app.meta.version).toBe(2);
  });

  it('samler hurtige ændringer i én upload', async () => {
    const server: FakeServer = { state: withHistory(), version: 1, online: true, puts: 0 };
    const { app, change } = setup(withHistory(), server, { version: 1, dirty: false, savedAt: null });
    change(withHistory(w('a', 1)));
    change(withHistory(w('a', 1), w('b', 2)));
    expect(app.meta.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(server.puts).toBe(1);
    expect((server.state as AppState).history).toHaveLength(2);
    expect(app.meta.dirty).toBe(false);
  });

  it('venter uden net og sender, når nettet er tilbage', async () => {
    const server: FakeServer = { state: withHistory(), version: 1, online: false, puts: 0 };
    const { app, engine, change } = setup(withHistory(), server, { version: 1, dirty: false, savedAt: null });
    change(withHistory(w('a', 1)));
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(last(app.statuses)).toEqual({ kind: 'offline' });
    expect(app.meta.dirty).toBe(true);
    expect(app.state.history).toHaveLength(1);

    server.online = true;
    await engine.flush(); // 'online'-hændelsen
    expect((server.state as AppState).history).toHaveLength(1);
    expect(app.meta.dirty).toBe(false);
  });

  it('prøver selv igen efter et stykke tid uden net', async () => {
    const server: FakeServer = { state: withHistory(), version: 1, online: false, puts: 0 };
    const { app, change } = setup(withHistory(), server, { version: 1, dirty: false, savedAt: null });
    change(withHistory(w('a', 1)));
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    server.online = true;
    await vi.advanceTimersByTimeAsync(SYNC_RETRY_MS);
    expect(app.meta.dirty).toBe(false);
  });

  it('sender ventende ændringer, når appen åbnes igen', async () => {
    const server: FakeServer = { state: withHistory(), version: 1, online: true, puts: 0 };
    const { engine } = setup(withHistory(w('a', 1)), server, { version: 1, dirty: true, savedAt: null });
    await engine.start();
    expect((server.state as AppState).history).toHaveLength(1);
  });

  it('fletter og prøver igen ved konflikt (409)', async () => {
    // En anden enhed har gemt version 2 med træning "x"
    const server: FakeServer = { state: withHistory(w('x', 5)), version: 2, online: true, puts: 0 };
    const { app, change } = setup(withHistory(), server, { version: 1, dirty: false, savedAt: null });
    change(withHistory(w('a', 1)));
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect(app.state.history.map((x) => x.id)).toEqual(['x', 'a']);
    await vi.advanceTimersByTimeAsync(SYNC_DEBOUNCE_MS);
    expect((server.state as AppState).history.map((x) => x.id)).toEqual(['x', 'a']);
    expect(server.version).toBe(3);
    expect(app.meta).toMatchObject({ version: 3, dirty: false });
  });

  it('logger ud ved udløbet login', async () => {
    const { app, engine } = setup(withHistory(), { state: null, version: null, online: true, puts: 0 });
    const unauthorized = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    (engine as unknown as { d: { fetchFn: typeof fetch } }).d.fetchFn = unauthorized;
    await engine.start();
    expect(app.loggedOut).toBe(true);
  });
});
