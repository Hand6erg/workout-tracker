import { describe, expect, it } from 'vitest';
import {
  estimate1RM,
  exerciseHistory,
  formatDuration,
  initialState,
  isoWeek,
  muscleDistribution,
  IS_STAGING,
  loadState,
  personalRecords,
  platesPerSide,
  previousSets,
  recordCount,
  recordsBrokenBy,
  workoutRecords,
  reducer,
  STORAGE_KEY,
  toCsv,
  uncheckedFilledCount,
  warmupSets,
  weeklyVolume,
  workoutVolume,
} from './logic';
import type { AppState } from './types';

const T0 = new Date('2026-11-15T10:00:00').getTime();

function startWith(state: AppState, templateId?: string) {
  return reducer(state, { type: 'START_WORKOUT', templateId, now: T0 });
}

describe('beregninger', () => {
  it('estimerer 1RM med Epley', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimate1RM(0, 5)).toBe(0);
  });

  it('formaterer varighed', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('træningsflow', () => {
  it('starter fra skabelon med rigtigt antal sæt', () => {
    const s = startWith(initialState(), 'tpl-push');
    expect(s.active?.name).toBe('Push');
    expect(s.active?.exercises).toHaveLength(5);
    expect(s.active?.exercises[0].sets).toHaveLength(3);
  });

  it('logger sæt, starter pausetimer og gemmer kun udførte sæt', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    const set1 = we.sets[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set1.id, patch: { weight: '80', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: set1.id, now: T0 + 1000 });
    expect(s.rest?.endsAt).toBe(T0 + 1000 + 90_000);

    s = reducer(s, { type: 'ADD_SET', weId: we.id }); // kopierer 80×5, men ikke udført
    expect(s.active!.exercises[0].sets[1]).toMatchObject({ weight: '80', reps: '5', done: false });

    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 60_000 });
    expect(s.active).toBeNull();
    expect(s.rest).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].exercises[0].sets).toHaveLength(1);
    expect(workoutVolume(s.history[0])).toBe(400);
  });

  it('gemmer udfyldte sæt, der ikke er krydset af, når det vælges (#9)', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '60', reps: '8' } });
    s = reducer(s, { type: 'ADD_SET', weId: we.id });
    s = reducer(s, { type: 'ADD_SET', weId: we.id });
    const empty = s.active!.exercises[0].sets[2];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: empty.id, patch: { weight: '', reps: '' } });
    expect(uncheckedFilledCount(s.active!)).toBe(2);

    const kept = reducer(s, { type: 'FINISH_WORKOUT', now: T0, includeUnchecked: true });
    expect(kept.history).toHaveLength(1);
    expect(kept.history[0].exercises[0].sets).toHaveLength(2);
    expect(kept.history[0].exercises[0].sets.every((x) => x.done)).toBe(true);
    expect(workoutVolume(kept.history[0])).toBe(960);

    // Uden valget gemmes kun afkrydsede sæt (her ingen)
    expect(reducer(s, { type: 'FINISH_WORKOUT', now: T0 }).history).toHaveLength(0);
  });

  it('kasserer en træning uden udførte sæt', () => {
    let s = startWith(initialState(), 'tpl-pull');
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    expect(s.history).toHaveLength(0);
  });

  it('udfylder tomme felter med forrige træning når sættet markeres', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['squat'] });
    let we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '100', reps: '3' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });

    s = reducer(s, { type: 'START_WORKOUT', now: T0 + 86_400_000 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['squat'] });
    we = s.active!.exercises[0];
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ weight: '100', reps: '3', done: true });
    expect(previousSets(s.history, 'squat')[0].weight).toBe('100');
  });

  it('kan ikke markere et sæt uden reps', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    const next = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    expect(next).toBe(s);
  });

  it('gemmer en træning som skabelon', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['curl'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '12', reps: '10' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    s = reducer(s, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: s.history[0].id, name: 'Arme' });
    expect(s.templates.at(-1)).toMatchObject({ name: 'Arme', exercises: [{ exerciseId: 'curl', sets: 1 }] });
  });
});

describe('øvelseshistorik og data', () => {
  it('finder bedste 1RM pr. træning', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '100', reps: '1' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    expect(exerciseHistory(s.history, 'bench')[0].best1RM).toBe(100);
    expect(toCsv(s)).toContain('Bænkpres,1,100,1,');
  });

  it('indlæser gemt data og tilføjer nye standardøvelser', () => {
    const saved = { ...initialState(), exercises: [{ id: 'x', name: 'Min øvelse', muscle: 'Ben', equipment: 'Stang', custom: true }] };
    const s = loadState(JSON.stringify(saved));
    expect(s.exercises.find((e) => e.id === 'x')).toBeTruthy();
    expect(s.exercises.find((e) => e.id === 'bench')).toBeTruthy();
    expect(loadState('ikke json')).toEqual(initialState());
  });
});

describe('gemmenøgle', () => {
  it('bruger den rigtige nøgle, når det ikke er staging', () => {
    expect(IS_STAGING).toBe(false);
    expect(STORAGE_KEY).toBe('loeft-state-v1');
  });
});

describe('rekorder', () => {
  function logWorkout(state: AppState, exerciseId: string, sets: [string, string][], now: number): AppState {
    let s = reducer(state, { type: 'START_WORKOUT', now });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const weId = s.active!.exercises[0].id;
    sets.forEach(([weight, reps], i) => {
      if (i > 0) s = reducer(s, { type: 'ADD_SET', weId });
      const set = s.active!.exercises[0].sets[i];
      s = reducer(s, { type: 'UPDATE_SET', weId, setId: set.id, patch: { weight, reps } });
      s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now });
    });
    return reducer(s, { type: 'FINISH_WORKOUT', now });
  }
  const done = (weight: string, reps: string) => ({ id: 'x', weight, reps, rpe: '', done: true });

  it('finder ingen rekorder uden historik', () => {
    const s = initialState();
    expect(personalRecords(s, 'bench')).toEqual({ repsAtWeight: {} });
    expect(recordsBrokenBy(s, 'bench', done('100', '5'))).toEqual([]);
  });

  it('finder tungeste vægt, bedste 1RM og flest reps pr. vægt', () => {
    let s = logWorkout(initialState(), 'bench', [['80', '5'], ['90', '1']], T0);
    s = logWorkout(s, 'bench', [['80', '8'], ['62,5', '10']], T0 + 86_400_000);
    const r = personalRecords(s, 'bench');
    expect(r.heaviest).toMatchObject({ weight: 90, reps: 1, date: T0 });
    expect(r.best1RM).toMatchObject({ value: estimate1RM(80, 8), weight: 80, reps: 8 });
    expect(r.repsAtWeight['80']).toMatchObject({ reps: 8, date: T0 + 86_400_000 });
    expect(r.repsAtWeight['62.5'].reps).toBe(10);
  });

  it('afgør hvilke rekorder et nyt sæt slår', () => {
    const s = logWorkout(initialState(), 'bench', [['80', '5']], T0);
    expect(recordsBrokenBy(s, 'bench', done('85', '5'))).toEqual(['heaviest', '1rm']);
    expect(recordsBrokenBy(s, 'bench', done('80', '6'))).toEqual(['1rm', 'reps']);
    expect(recordsBrokenBy(s, 'bench', done('80', '5'))).toEqual([]);
    expect(recordsBrokenBy(s, 'bench', { ...done('100', '5'), done: false })).toEqual([]);
    expect(recordsBrokenBy(s, 'squat', done('100', '5'))).toEqual([]);
  });

  it('tæller tidligere sæt i den aktive træning med, men ikke senere', () => {
    let s = logWorkout(initialState(), 'bench', [['80', '5']], T0);
    s = reducer(s, { type: 'START_WORKOUT', now: T0 + 1 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const weId = s.active!.exercises[0].id;
    s = reducer(s, { type: 'ADD_SET', weId });
    const [first, second] = s.active!.exercises[0].sets;
    s = reducer(s, { type: 'UPDATE_SET', weId, setId: first.id, patch: { weight: '90', reps: '5', done: true } });
    s = reducer(s, { type: 'UPDATE_SET', weId, setId: second.id, patch: { weight: '85', reps: '5', done: true } });
    const sets = s.active!.exercises[0].sets;
    expect(recordsBrokenBy(s, 'bench', sets[0])).toContain('heaviest');
    expect(recordsBrokenBy(s, 'bench', sets[1])).toEqual([]);
  });

  it('finder rekorder pr. afsluttet træning ift. træningerne før (#28)', () => {
    let s = logWorkout(initialState(), 'bench', [['80', '5']], T0);
    s = logWorkout(s, 'bench', [['85', '5'], ['80', '6']], T0 + 86_400_000);
    s = logWorkout(s, 'bench', [['70', '5']], T0 + 2 * 86_400_000);
    const [newest, middle, oldest] = s.history;
    expect(workoutRecords(s, oldest.id)).toEqual({});
    expect(workoutRecords(s, middle.id)).toEqual({ bench: ['heaviest', '1rm', 'reps'] });
    expect(recordCount(workoutRecords(s, middle.id))).toBe(3);
    expect(workoutRecords(s, newest.id)).toEqual({});
  });

  it('kropsvægtsøvelser kan slå reps-rekord ved 0 kg', () => {
    const s = logWorkout(initialState(), 'pullup', [['', '8']], T0);
    expect(recordsBrokenBy(s, 'pullup', done('', '10'))).toEqual(['reps']);
  });
});

describe('statistik til grafer', () => {
  function logAt(state: AppState, exerciseId: string, weight: string, reps: string, now: number): AppState {
    let s = reducer(state, { type: 'START_WORKOUT', now });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight, reps } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now });
    return reducer(s, { type: 'FINISH_WORKOUT', now });
  }
  // Søndag 15. nov. 2026 (uge 46); mandag 16. nov. starter uge 47
  const SUN = new Date('2026-11-15T10:00:00').getTime();
  const MON = new Date('2026-11-16T09:00:00').getTime();

  it('beregner ISO-ugenumre', () => {
    expect(isoWeek(SUN)).toBe(46);
    expect(isoWeek(MON)).toBe(47);
    expect(isoWeek(new Date('2027-01-01T12:00:00').getTime())).toBe(53);
    expect(isoWeek(new Date('2027-01-04T12:00:00').getTime())).toBe(1);
  });

  it('samler volumen pr. uge, også uger uden træning, ældste først', () => {
    let s = logAt(initialState(), 'bench', '100', '5', SUN); // uge 46
    s = logAt(s, 'squat', '100', '3', MON); // uge 47
    s = logAt(s, 'squat', '50', '2', MON + 3600_000);
    const weeks = weeklyVolume(s, 4, MON + 86_400_000);
    expect(weeks.map((w) => w.week)).toEqual([44, 45, 46, 47]);
    expect(weeks.map((w) => w.volume)).toEqual([0, 0, 500, 400]);
  });

  it('tom historik giver 0 i alle uger', () => {
    expect(weeklyVolume(initialState(), 3, SUN).every((w) => w.volume === 0)).toBe(true);
  });

  it('fordeler sæt og volumen på muskelgrupper', () => {
    let s = logAt(initialState(), 'bench', '100', '5', SUN);
    s = logAt(s, 'squat', '100', '3', MON);
    s = logAt(s, 'squat', '100', '3', MON);
    const all = muscleDistribution(s, 0);
    expect(all.map((m) => m.muscle)).toEqual(['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave']);
    expect(all.find((m) => m.muscle === 'Bryst')).toMatchObject({ sets: 1, volume: 500 });
    expect(all.find((m) => m.muscle === 'Ben')).toMatchObject({ sets: 2, volume: 600 });
    expect(muscleDistribution(s, MON).find((m) => m.muscle === 'Bryst')!.sets).toBe(0);
  });

  it('ignorerer ukendte øvelser', () => {
    const s = logAt(initialState(), 'bench', '100', '5', SUN);
    s.history[0].exercises[0].exerciseId = 'slettet';
    expect(muscleDistribution(s, 0).every((m) => m.sets === 0)).toBe(true);
  });
});

describe('plader og opvarmning', () => {
  it('finder skiver pr. side', () => {
    expect(platesPerSide(100)).toEqual({ perSide: [25, 15], remainder: 0, belowBar: false });
    expect(platesPerSide(60)).toEqual({ perSide: [20], remainder: 0, belowBar: false });
    expect(platesPerSide(22.5)).toEqual({ perSide: [1.25], remainder: 0, belowBar: false });
    expect(platesPerSide(20)).toEqual({ perSide: [], remainder: 0, belowBar: false });
  });

  it('melder rest, når vægten ikke kan rammes præcist', () => {
    expect(platesPerSide(21)).toEqual({ perSide: [], remainder: 1, belowBar: false });
    expect(platesPerSide(103)).toMatchObject({ perSide: [25, 15, 1.25], remainder: 0.5 });
  });

  it('håndterer vægt under stangen og andre stænger/skiver', () => {
    expect(platesPerSide(15).belowBar).toBe(true);
    expect(platesPerSide(100, 20, [20, 10, 5]).perSide).toEqual([20, 20]);
    expect(platesPerSide(50, 15).perSide).toEqual([15, 2.5]);
  });

  it('foreslår opvarmning afrundet til 2,5 kg', () => {
    expect(warmupSets(100)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 40, reps: 5 },
      { weight: 60, reps: 3 },
      { weight: 80, reps: 2 },
    ]);
    expect(warmupSets(67)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 27.5, reps: 5 },
      { weight: 40, reps: 3 },
      { weight: 52.5, reps: 2 },
    ]);
  });

  it('springer trin over, der giver samme vægt eller er for tunge', () => {
    expect(warmupSets(40)).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 3 },
      { weight: 32.5, reps: 2 },
    ]);
    expect(warmupSets(20)).toEqual([]);
  });
});
