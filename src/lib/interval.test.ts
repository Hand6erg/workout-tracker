import { describe, expect, it } from 'vitest';
import {
  cleanIntervalConfig,
  describeFinisher,
  INTERVAL_DEFAULTS,
  intervalCues,
  intervalStatus,
  intervalTotalSeconds,
  initialState,
  loadState,
  reducer,
  syncPayload,
  type IntervalCue,
} from './logic';

const T0 = 1_700_000_000_000;
const at = (s: number) => T0 + s * 1000;

describe('intervaltimer (#329)', () => {
  it('EMOM: runde og tid tilbage, også med arbejde < 1 min', () => {
    const emom = cleanIntervalConfig({ mode: 'emom', minutes: 10 });
    expect(intervalTotalSeconds(emom)).toBe(600);
    expect(intervalStatus(emom, T0, at(0))).toMatchObject({ round: 1, rounds: 10, phase: 'work', phaseLeft: 60, totalLeft: 600, done: false });
    expect(intervalStatus(emom, T0, at(125.5))).toMatchObject({ round: 3, phase: 'work', phaseLeft: 55, totalLeft: 475 });
    const split = cleanIntervalConfig({ mode: 'emom', minutes: 5, workSeconds: 40 });
    expect(split.restSeconds).toBe(20);
    expect(intervalStatus(split, T0, at(45))).toMatchObject({ round: 1, phase: 'rest', phaseLeft: 15 });
    expect(intervalStatus(split, T0, at(60))).toMatchObject({ round: 2, phase: 'work', phaseLeft: 40 });
  });

  it('Tabata: 20/10 × 8 skifter mellem arbejde og pause og slutter på arbejde', () => {
    const tabata = cleanIntervalConfig({ mode: 'tabata' });
    expect(tabata).toMatchObject({ workSeconds: 20, restSeconds: 10, rounds: 8 });
    expect(intervalTotalSeconds(tabata)).toBe(230);
    expect(intervalStatus(tabata, T0, at(19.2))).toMatchObject({ round: 1, phase: 'work', phaseLeft: 1 });
    expect(intervalStatus(tabata, T0, at(20))).toMatchObject({ round: 1, phase: 'rest', phaseLeft: 10 });
    expect(intervalStatus(tabata, T0, at(25))).toMatchObject({ round: 1, rounds: 8, phase: 'rest', phaseLeft: 5 });
    expect(intervalStatus(tabata, T0, at(30))).toMatchObject({ round: 2, phase: 'work', phaseLeft: 20 });
    expect(intervalStatus(tabata, T0, at(229))).toMatchObject({ round: 8, phase: 'work', totalLeft: 1, done: false });
  });

  it('AMRAP: én lang arbejdsperiode', () => {
    const amrap = cleanIntervalConfig({ mode: 'amrap', minutes: 12 });
    expect(intervalStatus(amrap, T0, at(61))).toMatchObject({ round: 1, rounds: 1, phase: 'work', totalLeft: 659, phaseLeft: 659 });
  });

  it('tåler et langt spring i tiden (skærm slukket) og før start', () => {
    const tabata = INTERVAL_DEFAULTS.tabata;
    expect(intervalStatus(tabata, T0, at(155))).toMatchObject({ round: 6, phase: 'work', phaseLeft: 15 });
    expect(intervalStatus(tabata, T0, at(10_000))).toMatchObject({ done: true, totalLeft: 0, phaseLeft: 0, round: 8 });
    expect(intervalStatus(tabata, T0, at(-5))).toMatchObject({ round: 1, phase: 'work', phaseLeft: 20, done: false });
  });

  it('bip: 3-2-1 før skift, langt bip til sidst – hverken gentaget eller sprunget over', () => {
    const tabata = INTERVAL_DEFAULTS.tabata;
    const heard: IntervalCue[] = [];
    let prev = T0;
    // uregelmæssige tik på 0,25–0,9 s
    for (let i = 0; prev < at(240); i++) {
      const now = prev + [250, 900, 400, 333][i % 4];
      heard.push(...intervalCues(tabata, T0, prev, now));
      prev = now;
    }
    const ats = heard.map((c) => c.at);
    expect(new Set(ats).size).toBe(ats.length);
    expect(heard.slice(0, 4)).toEqual([
      { at: 17, kind: 'count' },
      { at: 18, kind: 'count' },
      { at: 19, kind: 'count' },
      { at: 20, kind: 'phase' },
    ]);
    // pausen på 10 s får også 3-2-1, og sidste bip er det lange
    expect(ats).toContain(27);
    expect(heard[heard.length - 1]).toEqual({ at: 230, kind: 'end' });
    expect(heard.filter((c) => c.kind === 'phase')).toHaveLength(14);
    expect(heard.filter((c) => c.kind === 'count')).toHaveLength(15 * 3);
    // det samme tik to gange giver intet
    expect(intervalCues(tabata, T0, at(20), at(20))).toEqual([]);
  });

  it('efter et langt spring gives kun det seneste bip', () => {
    const emom = cleanIntervalConfig({ mode: 'emom', minutes: 3 });
    expect(intervalCues(emom, T0, at(10), at(130))).toEqual([{ at: 120, kind: 'phase' }]);
    expect(intervalCues(emom, T0, at(170), at(500))).toEqual([{ at: 180, kind: 'end' }]);
  });

  it('klemmer ugyldige indstillinger ind i grænserne', () => {
    expect(cleanIntervalConfig(null)).toEqual(INTERVAL_DEFAULTS.emom);
    expect(cleanIntervalConfig({ mode: 'yoga', minutes: 'x' })).toEqual(INTERVAL_DEFAULTS.emom);
    expect(cleanIntervalConfig({ mode: 'emom', minutes: 500, workSeconds: 2 })).toMatchObject({ minutes: 60, workSeconds: 10, restSeconds: 50 });
    expect(cleanIntervalConfig({ mode: 'tabata', workSeconds: -1, restSeconds: 9999, rounds: 0.4 })).toMatchObject({
      workSeconds: 5,
      restSeconds: 300,
      rounds: 1,
    });
    expect(cleanIntervalConfig({ mode: 'amrap', minutes: '7.6' })).toMatchObject({ mode: 'amrap', minutes: 8 });
  });

  it('beskriver finisheren på dansk', () => {
    expect(describeFinisher(cleanIntervalConfig({ mode: 'emom', minutes: 10 }))).toBe('EMOM 10 min');
    expect(describeFinisher(INTERVAL_DEFAULTS.tabata)).toBe('Tabata 8 × 20/10 s');
    expect(describeFinisher(cleanIntervalConfig({ mode: 'amrap', minutes: 12 }), 7)).toBe('AMRAP 12 min · 7 runder');
    expect(describeFinisher(INTERVAL_DEFAULTS.amrap, 1)).toBe('AMRAP 12 min · 1 runde');
  });
});

describe('intervaltimer i træningen (#330)', () => {
  const started = () => reducer(initialState(), { type: 'START_WORKOUT', now: T0 });

  it('starter kun under en træning, husker indstillingerne og stoppes', () => {
    expect(reducer(initialState(), { type: 'START_INTERVAL', config: INTERVAL_DEFAULTS.tabata, now: T0 }).interval ?? null).toBeNull();
    let s = reducer(started(), { type: 'START_INTERVAL', config: { ...INTERVAL_DEFAULTS.tabata, rounds: 99 }, now: at(5) });
    expect(s.interval).toEqual({ config: { ...INTERVAL_DEFAULTS.tabata, rounds: 50, minutes: 25 }, startedAt: at(5) });
    expect(s.intervalConfig).toMatchObject({ mode: 'tabata', rounds: 50 });
    s = reducer(s, { type: 'STOP_INTERVAL' });
    expect(s.interval).toBeNull();
    expect(s.intervalConfig?.mode).toBe('tabata');
  });

  it('stoppes, når træningen afsluttes eller annulleres', () => {
    const s = reducer(started(), { type: 'START_INTERVAL', config: INTERVAL_DEFAULTS.emom, now: T0 });
    expect(reducer(s, { type: 'CANCEL_WORKOUT' }).interval).toBeNull();
    expect(reducer(s, { type: 'FINISH_WORKOUT', now: at(60) }).interval).toBeNull();
  });

  it('gamle data uden intervaltimer indlæses, og en kørende timer overlever genindlæsning', () => {
    const old = { ...initialState() } as Partial<ReturnType<typeof initialState>>;
    delete old.interval;
    delete old.intervalConfig;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.interval).toBeNull();
    expect(loaded.intervalConfig).toEqual(INTERVAL_DEFAULTS.emom);
    const s = reducer(started(), { type: 'START_INTERVAL', config: INTERVAL_DEFAULTS.tabata, now: T0 });
    expect(loadState(JSON.stringify(s)).interval).toEqual(s.interval);
    // uden træning i gang ingen timer
    expect(loadState(JSON.stringify({ ...s, active: null })).interval).toBeNull();
    // den sendes ikke online
    expect('interval' in syncPayload(s)).toBe(false);
  });
});
