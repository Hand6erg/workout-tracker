import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasOwnData, initialState, loadState, mergeStates, reducer, syncPayload, trackedReducer } from './logic';
import { emptyMeta, parseMeta, readRemote, SYNC_DEBOUNCE_MS, SYNC_KEY, SYNC_RETRY_MS, shouldAutoSync, SyncEngine, type SyncMeta, type SyncStatus } from './sync';
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

describe('fletning mellem to enheder (#38)', () => {
  const tpl = (id: string, name: string, updatedAt?: number) => ({ id, name, exercises: [], ...(updatedAt ? { updatedAt } : {}) });

  it('mister eller dublerer ingen træninger, når begge enheder har logget offline', () => {
    const base = withHistory(w('a', 1));
    const phone = trackedReducer(base, { type: 'IMPORT_STATE', state: withHistory(w('p', 3), w('a', 1)) });
    const pc = withHistory(w('c', 2), w('a', 1));
    const m1 = mergeStates(phone, pc);
    const m2 = mergeStates(pc, phone);
    expect(m1.history.map((x) => x.id)).toEqual(['p', 'c', 'a']);
    expect(m2.history.map((x) => x.id)).toEqual(['p', 'c', 'a']);
    // Fletter man igen, sker der ikke mere
    expect(mergeStates(m1, m2).history).toHaveLength(3);
  });

  it('en slettet træning forbliver slettet – også når den anden enhed stadig har den', () => {
    const both = withHistory(w('a', 2), w('b', 1));
    const phone = trackedReducer(both, { type: 'DELETE_WORKOUT', workoutId: 'a', at: 50 });
    expect(phone.deleted).toEqual({ a: 50 });
    const pc = both; // har ikke hørt om sletningen
    expect(mergeStates(pc, phone).history.map((x) => x.id)).toEqual(['b']);
    expect(mergeStates(phone, pc).history.map((x) => x.id)).toEqual(['b']);
    expect(mergeStates(pc, phone).deleted).toEqual({ a: 50 });
  });

  it('slettede kropsmål og skabeloner forbliver også slettede', () => {
    const s0: AppState = { ...initialState(), bodyLog: [{ id: 'm1', date: 1, weight: 80 }] };
    const s1 = trackedReducer(s0, { type: 'DELETE_MEASUREMENT', id: 'm1', at: 9 });
    const s2 = trackedReducer(s1, { type: 'DELETE_TEMPLATE', templateId: s0.templates[0].id, at: 9 });
    const m = mergeStates(s0, s2);
    expect(m.bodyLog).toHaveLength(0);
    expect(m.templates.map((t) => t.id)).not.toContain(s0.templates[0].id);
  });

  it('skabeloner: den nyeste ændring vinder, uanset hvilken enhed', () => {
    const local = { ...initialState(), templates: [tpl('t', 'Gammel', 10), tpl('only-local', 'L')] };
    const remote = { ...initialState(), templates: [tpl('t', 'Ny', 20), tpl('only-remote', 'R')] };
    const m = mergeStates(local, remote);
    expect(m.templates.find((t) => t.id === 't')?.name).toBe('Ny');
    expect(m.templates.map((t) => t.id)).toEqual(expect.arrayContaining(['only-local', 'only-remote']));
    expect(mergeStates(remote, local).templates.find((t) => t.id === 't')?.name).toBe('Ny');
  });

  it('egne øvelser får tidsstempel og den nyeste vinder', () => {
    const s = trackedReducer(initialState(), { type: 'ADD_CUSTOM_EXERCISE', id: 'x', name: 'Hip thrust', muscle: 'Ben', equipment: 'Stang', at: 77 });
    expect(s.exercises.find((e) => e.id === 'x')?.updatedAt).toBe(77);
    expect(s.exercises.filter((e) => e.updatedAt).length).toBe(1);
    const older = { ...initialState(), exercises: [{ id: 'x', name: 'Gammelt navn', muscle: 'Ben' as const, equipment: 'Stang' as const, custom: true, updatedAt: 5 }] };
    expect(mergeStates(older, s).exercises.find((e) => e.id === 'x')?.name).toBe('Hip thrust');
  });

  it('indstillinger: den enhed, der ændrede dem senest, vinder', () => {
    const phone = trackedReducer(initialState(), { type: 'SET_REST_SECONDS', seconds: 120, at: 100 });
    const pc = trackedReducer(trackedReducer(initialState(), { type: 'SET_BAR_WEIGHT', weight: 15, at: 200 }), { type: 'SET_WEEKLY_GOAL', goal: 4, at: 200 });
    const m = mergeStates(phone, pc);
    expect(m).toMatchObject({ barWeight: 15, weeklyGoal: 4, settingsAt: 200 });
    expect(mergeStates(pc, phone)).toMatchObject({ barWeight: 15, weeklyGoal: 4, settingsAt: 200 });
    expect(phone.settingsAt).toBe(100);
  });

  it('flet og fjern-fra-server ændrer ikke tidsstempler, og gamle data uden felterne kan læses', () => {
    const s = trackedReducer(initialState(), { type: 'MERGE_REMOTE', remote: initialState() });
    expect(s.settingsAt).toBe(0);
    const old = loadState(JSON.stringify({ version: 1, exercises: [], templates: [], history: [w('a', 1)], active: null, rest: null, restSeconds: 90 }));
    expect(old.deleted).toEqual({});
    expect(old.settingsAt).toBe(0);
    expect(mergeStates(old, withHistory(w('b', 2))).history.map((x) => x.id)).toEqual(['b', 'a']);
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

  it('henter nyere data fra en anden enhed, når appen åbnes (#37)', async () => {
    const server: FakeServer = { state: withHistory(w('x', 5), w('a', 1)), version: 4, online: true, puts: 0 };
    const local = { ...withHistory(w('a', 1)), rest: { endsAt: 9, total: 9 } };
    const { app, engine } = setup(local, server, { version: 2, dirty: false, savedAt: 500 });
    await engine.start();
    expect(app.state.history.map((x) => x.id)).toEqual(['x', 'a']);
    expect(app.state.rest).toEqual({ endsAt: 9, total: 9 });
    expect(app.meta).toEqual({ version: 4, dirty: false, savedAt: 1000 });
    expect(server.puts).toBe(0);
    expect(last(app.statuses)).toEqual({ kind: 'saved', at: 1000 });
  });

  it('overskriver aldrig ventende lokale ændringer – fletter og sender dem (#37)', async () => {
    const server: FakeServer = { state: withHistory(w('x', 5)), version: 4, online: true, puts: 0 };
    const { app, engine } = setup(withHistory(w('mine', 1)), server, { version: 2, dirty: true, savedAt: null });
    await engine.start();
    expect(app.state.history.map((x) => x.id)).toEqual(['x', 'mine']);
    expect((server.state as AppState).history.map((x) => x.id)).toEqual(['x', 'mine']);
    expect(server.puts).toBe(1);
    expect(app.meta).toMatchObject({ version: 5, dirty: false });
  });

  it('gør intet ved åbning, når serveren ikke har noget nyt eller ikke kan nås (#37)', async () => {
    const server: FakeServer = { state: withHistory(w('a', 1)), version: 2, online: true, puts: 0 };
    const local = withHistory(w('a', 1));
    const { app, engine } = setup(local, server, { version: 2, dirty: false, savedAt: 500 });
    await engine.start();
    expect(app.state).toBe(local);
    expect(server.puts).toBe(0);
    expect(last(app.statuses)).toEqual({ kind: 'saved', at: 1000 });
    server.online = false;
    await engine.pull();
    expect(app.state).toBe(local);
    expect(last(app.statuses)).toEqual({ kind: 'saved', at: 1000 });
  });

  it('"Synkronisér nu" henter nyt fra en anden enhed og siger til uden net (#39)', async () => {
    const server: FakeServer = { state: withHistory(w('a', 1)), version: 2, online: true, puts: 0 };
    const { app, engine } = setup(withHistory(w('a', 1)), server, { version: 2, dirty: false, savedAt: 500 });
    // Den anden enhed gemmer en ny træning
    server.state = withHistory(w('pc', 9), w('a', 1));
    server.version = 3;
    await engine.syncNow();
    expect(app.state.history.map((x) => x.id)).toEqual(['pc', 'a']);
    expect(app.meta).toEqual({ version: 3, dirty: false, savedAt: 1000 });
    expect(server.puts).toBe(0);

    server.online = false;
    await engine.syncNow();
    expect(last(app.statuses)).toEqual({ kind: 'offline' });
    // Automatisk (ikke bedt om): ingen fejlbesked
    const before = app.statuses.length;
    await engine.syncNow(false);
    expect(app.statuses.length).toBe(before);
  });

  it('"Synkronisér nu" før kontoen er koblet starter første upload (#39)', async () => {
    const server: FakeServer = { state: null, version: null, online: true, puts: 0 };
    const { app, engine } = setup(withHistory(w('a', 1)), server);
    await engine.syncNow();
    expect(server.version).toBe(1);
    expect(app.meta.dirty).toBe(false);
  });

  it('henter kun automatisk, når appen er synlig og ingen træning er i gang (#39)', () => {
    expect(shouldAutoSync({ active: null }, true)).toBe(true);
    expect(shouldAutoSync({ active: null }, false)).toBe(false);
    expect(shouldAutoSync({ active: { id: 'x', name: 'x', startedAt: 1, exercises: [] } }, true)).toBe(false);
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
