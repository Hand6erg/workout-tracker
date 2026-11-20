import { describe, expect, it } from 'vitest';
import {
  restFor,
  restInfo,
  suggestedRest,
  estimate1RM,
  exerciseHistory,
  formatDuration,
  workoutTimingError,
  nextInProgram,
  trackedReducer,
  MAX_DURATION_MIN,
  hasOwnData,
  initialState,
  isoWeek,
  lastExerciseNote,
  NOTE_MAX,
  muscleDistribution,
  IS_STAGING,
  loadState,
  mergeStates,
  stampChanges,
  personalRecords,
  platesPerSide,
  previousSets,
  previousSetsFor,
  progressionHint,
  recordCount,
  recordsBrokenBy,
  supersetGroups,
  workoutRecords,
  uid,
  recordsWall,
  newRecordsInMonth,
  monthRecap,
  monthKey,
  recapToShow,
  recapChangeTexts,
  formatTotalTime,
  monthNameDa,
  reducer,
  restAlertDue,
  wantsWakeLock,
  STORAGE_KEY,
  bodyToCsv,
  toCsv,
  workoutSummary,
  vsLastTime,
  vsRowCells,
  shareCardLines,
  trainingDays,
  uncheckedFilledCount,
  exerciseKind,
  isSetFilled,
  formatSet,
  parseClock,
  warmupSets,
  warmupBaseWeight,
  weekStreak,
  weeklyVolume,
  workoutVolume,
  workoutDuration,
  syncPayload,
  swapSuggestions,
  canSwapInTemplate,
} from './logic';
import type { AppState, SetEntry, Workout } from './types';

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
    expect(s.rest?.endsAt).toBe(T0 + 1000 + 180_000); // bænkpres: foreslået 3:00 (#119)

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

describe('opvarmningssæt (#25)', () => {
  function withBench(weight: string) {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight, reps: '5' } });
    return { s, weId: we.id };
  }

  it('indsætter opvarmning øverst ud fra første arbejdssæt', () => {
    const { s: s0, weId } = withBench('100');
    const s = reducer(s0, { type: 'ADD_WARMUP_SETS', weId });
    const sets = s.active!.exercises[0].sets;
    expect(sets.map((x) => [x.weight, x.reps, !!x.warmup])).toEqual([
      ['20', '10', true],
      ['40', '5', true],
      ['60', '3', true],
      ['80', '2', true],
      ['100', '5', false],
    ]);
    // Igen: erstatter i stedet for at tilføje flere
    expect(reducer(s, { type: 'ADD_WARMUP_SETS', weId }).active!.exercises[0].sets).toHaveLength(5);
  });

  it('skriver halve kilo med komma', () => {
    const { s, weId } = withBench('120');
    const sets = reducer(s, { type: 'ADD_WARMUP_SETS', weId }).active!.exercises[0].sets;
    expect(sets[1].weight).toBe('47,5');
  });

  it('bruger sidste gangs vægt når feltet er tomt', () => {
    let { s, weId } = withBench('100');
    for (const set of s.active!.exercises[0].sets) s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    s = reducer(s, { type: 'START_WORKOUT', now: T0 + 1 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    expect(we.sets[0].weight).toBe('');
    expect(warmupBaseWeight(s.history, we)).toBe(100);
    const sets = reducer(s, { type: 'ADD_WARMUP_SETS', weId: we.id }).active!.exercises[0].sets;
    expect(sets.filter((x) => x.warmup).map((x) => x.weight)).toEqual(['20', '40', '60', '80']);
  });

  it('gør intet uden vægt i arbejdssættet', () => {
    const { s, weId } = withBench('');
    expect(reducer(s, { type: 'ADD_WARMUP_SETS', weId })).toEqual(s);
  });

  it('opvarmning tæller ikke i volumen, rekorder, statistik eller skabeloner', () => {
    let { s, weId } = withBench('100');
    s = reducer(s, { type: 'ADD_WARMUP_SETS', weId });
    for (const set of s.active!.exercises[0].sets) s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    const w = s.history[0];
    expect(w.exercises[0].sets).toHaveLength(5);
    expect(workoutVolume(w)).toBe(500);
    expect(previousSets(s.history, 'bench').map((x) => x.weight)).toEqual(['100']);
    expect(personalRecords(s, 'bench').repsAtWeight).toEqual({ '100': { reps: 5, date: T0 } });
    expect(muscleDistribution(s, 0).find((m) => m.muscle === 'Bryst')!.sets).toBe(1);
    s = reducer(s, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: w.id, name: 'B' });
    expect(s.templates.at(-1)!.exercises[0].sets).toBe(1);
  });

  it('gamle data uden warmup-felt indlæses uændret', () => {
    const { s } = withBench('80');
    const loaded = loadState(JSON.stringify(s));
    expect(loaded.active!.exercises[0].sets[0].warmup).toBeUndefined();
  });
});

describe('stang og skiver (#30)', () => {
  it('har standardværdier og læser gamle data med dem', () => {
    const old = { ...initialState() } as Partial<AppState>;
    delete old.barWeight;
    delete old.plates;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.barWeight).toBe(20);
    expect(loaded.plates).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });

  it('skifter stangvægt inden for rimelige grænser', () => {
    expect(reducer(initialState(), { type: 'SET_BAR_WEIGHT', weight: 15 }).barWeight).toBe(15);
    expect(reducer(initialState(), { type: 'SET_BAR_WEIGHT', weight: 0 }).barWeight).toBe(20);
  });

  it('slår skiver til og fra, men aldrig den sidste', () => {
    let s = reducer(initialState(), { type: 'TOGGLE_PLATE', plate: 25 });
    expect(s.plates).not.toContain(25);
    expect(platesPerSide(100, s.barWeight, s.plates).perSide).toEqual([20, 20]);
    s = reducer(s, { type: 'TOGGLE_PLATE', plate: 25 });
    expect(s.plates[0]).toBe(25);
    for (const p of [25, 20, 15, 10, 5, 2.5]) s = reducer(s, { type: 'TOGGLE_PLATE', plate: p });
    expect(reducer(s, { type: 'TOGGLE_PLATE', plate: 1.25 }).plates).toEqual([1.25]);
    expect(reducer(s, { type: 'TOGGLE_PLATE', plate: 3 })).toBe(s);
  });

  it('opvarmning bruger den valgte stangvægt', () => {
    let s = reducer(initialState(), { type: 'SET_BAR_WEIGHT', weight: 15 });
    s = reducer(s, { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '5' } });
    s = reducer(s, { type: 'ADD_WARMUP_SETS', weId: we.id });
    expect(s.active!.exercises[0].sets[0].weight).toBe('15');
  });
});

describe('kropsmål (#14)', () => {
  const add = (s: AppState, id: string, date: number, f: { weight?: number; bodyFat?: number; waist?: number }) =>
    reducer(s, { type: 'ADD_MEASUREMENT', id, date, ...f });

  it('gamle data får en tom liste', () => {
    const old = { ...initialState() } as Partial<AppState>;
    delete old.bodyLog;
    expect(loadState(JSON.stringify(old)).bodyLog).toEqual([]);
  });

  it('tilføjer og sorterer nyeste først', () => {
    let s = add(initialState(), 'a', T0, { weight: 82.5 });
    s = add(s, 'b', T0 + 2 * 86_400_000, { waist: 88 });
    s = add(s, 'c', T0 + 86_400_000, { weight: 82, bodyFat: 18 });
    expect(s.bodyLog.map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(s.bodyLog[1]).toEqual({ id: 'c', date: T0 + 86_400_000, weight: 82, bodyFat: 18 });
  });

  it('ignorerer tomme eller ugyldige målinger', () => {
    const s = initialState();
    expect(add(s, 'x', T0, {})).toBe(s);
    expect(add(s, 'x', T0, { weight: 0, waist: NaN })).toBe(s);
    expect(add(s, 'x', T0, { bodyFat: 120 })).toBe(s);
  });

  it('fletter målinger fra to enheder uden at miste nogen', () => {
    const local = add(initialState(), 'a', T0, { weight: 80 });
    const remote = add(initialState(), 'b', T0 + 1, { weight: 79 });
    expect(mergeStates(local, remote).bodyLog.map((m) => m.id)).toEqual(['b', 'a']);
    expect(hasOwnData(local)).toBe(true);
  });

  it('sletter en måling', () => {
    let s = add(initialState(), 'a', T0, { weight: 80 });
    s = add(s, 'b', T0 + 1, { weight: 81 });
    expect(reducer(s, { type: 'DELETE_MEASUREMENT', id: 'a' }).bodyLog.map((m) => m.id)).toEqual(['b']);
  });
});

describe('kropsmål i eksport (#31)', () => {
  it('laver CSV med ældste først og tomme felter', () => {
    let s = reducer(initialState(), { type: 'ADD_MEASUREMENT', id: 'b', date: new Date('2026-11-02T12:00').getTime(), weight: 82.5, bodyFat: 18 });
    s = reducer(s, { type: 'ADD_MEASUREMENT', id: 'a', date: new Date('2026-10-01T12:00').getTime(), waist: 90 });
    expect(bodyToCsv(s)).toBe('Dato,Vægt (kg),Fedt (%),Talje (cm)\n2026-10-01,,,90\n2026-11-02,82.5,18,');
  });

  it('en backup med kropsmål kan gendannes, og en gammel backup uden virker stadig', () => {
    const s = reducer(initialState(), { type: 'ADD_MEASUREMENT', id: 'a', date: T0, weight: 80 });
    expect(loadState(JSON.stringify(s)).bodyLog).toEqual(s.bodyLog);
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.bodyLog;
    expect(loadState(JSON.stringify(old)).bodyLog).toEqual([]);
  });
});

describe('supersæt (#12)', () => {
  function withExercises(ids: string[]) {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ids });
    return s;
  }
  const groups = (s: AppState) => supersetGroups(s.active!.exercises).map((g) => g.map((e) => e.exerciseId));
  const weId = (s: AppState, exId: string) => s.active!.exercises.find((e) => e.exerciseId === exId)!.id;

  it('kobler en øvelse med den næste', () => {
    let s = withExercises(['bench', 'row', 'squat']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') });
    expect(groups(s)).toEqual([['bench', 'row'], ['squat']]);
  });

  it('kan lave supersæt med 3 øvelser', () => {
    let s = withExercises(['bench', 'row', 'squat']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'row') });
    expect(groups(s)).toEqual([['bench', 'row', 'squat']]);
  });

  it('frakobling af en øvelse i et par opløser supersættet', () => {
    let s = withExercises(['bench', 'row']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') });
    s = reducer(s, { type: 'UNLINK_SUPERSET', weId: weId(s, 'row') });
    expect(groups(s)).toEqual([['bench'], ['row']]);
    expect(s.active!.exercises.every((e) => e.supersetId === undefined)).toBe(true);
  });

  it('frakobling af den midterste i 3 efterlader ingen grupper med én øvelse', () => {
    let s = withExercises(['bench', 'row', 'squat', 'curl']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'row') });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'squat') });
    s = reducer(s, { type: 'UNLINK_SUPERSET', weId: weId(s, 'row') });
    expect(groups(s)).toEqual([['bench'], ['row'], ['squat', 'curl']]);
  });

  it('sletning af en øvelse i et par opløser supersættet', () => {
    let s = withExercises(['bench', 'row', 'squat']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') });
    s = reducer(s, { type: 'REMOVE_EXERCISE', weId: weId(s, 'row') });
    expect(s.active!.exercises.every((e) => e.supersetId === undefined)).toBe(true);
  });

  it('sidste øvelse kan ikke kobles, og gamle data indlæses uændret', () => {
    const s = withExercises(['bench']);
    expect(reducer(s, { type: 'LINK_SUPERSET', weId: weId(s, 'bench') })).toEqual(s);
    expect(loadState(JSON.stringify(s)).active!.exercises[0].supersetId).toBeUndefined();
  });
});

describe('pausetimer i supersæt (#24)', () => {
  function supersetWorkout() {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench', 'row', 'squat'] });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: s.active!.exercises[0].id });
    for (const we of s.active!.exercises) {
      s = reducer(s, { type: 'ADD_SET', weId: we.id });
      for (const set of s.active!.exercises.find((e) => e.id === we.id)!.sets)
        s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set.id, patch: { weight: '50', reps: '8' } });
    }
    return s;
  }
  const tick = (s: AppState, i: number, k: number) => {
    const we = s.active!.exercises[i];
    return reducer({ ...s, rest: null }, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[k].id, now: T0 });
  };

  it('starter ikke pausen midt i runden, men efter sidste øvelse', () => {
    let s = supersetWorkout();
    s = tick(s, 0, 0); // bænk sæt 1
    expect(s.rest).toBeNull();
    s = tick(s, 1, 0); // roning sæt 1 → runden færdig
    expect(s.rest).not.toBeNull();
    s = tick(s, 0, 1); // bænk sæt 2
    expect(s.rest).toBeNull();
  });

  it('øvelser uden supersæt starter pausen som før', () => {
    const s = tick(supersetWorkout(), 2, 0); // squat er ikke i supersættet
    expect(s.rest).not.toBeNull();
  });

  it('en øvelse med færre sæt tæller som færdig i de sidste runder', () => {
    let s = supersetWorkout();
    const row = s.active!.exercises[1];
    s = reducer(s, { type: 'REMOVE_SET', weId: row.id, setId: row.sets[1].id });
    s = tick(s, 0, 0);
    s = tick(s, 1, 0);
    s = tick(s, 0, 1); // roning har kun ét sæt → runde 2 er færdig med bænk
    expect(s.rest).not.toBeNull();
  });
});

describe('supersæt i skabeloner og historik (#29)', () => {
  function supersetDone() {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench', 'row', 'squat'] });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: s.active!.exercises[0].id });
    for (const we of s.active!.exercises) {
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '8' } });
      s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    }
    return reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
  }

  it('gemmer supersæt i skabelonen og giver nye id ved start', () => {
    let s = supersetDone();
    const oldId = s.history[0].exercises[0].supersetId;
    s = reducer(s, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: s.history[0].id, name: 'SS' });
    const tpl = s.templates.at(-1)!;
    expect(supersetGroups(tpl.exercises).map((g) => g.map((e) => e.exerciseId))).toEqual([['bench', 'row'], ['squat']]);
    s = reducer(s, { type: 'START_WORKOUT', templateId: tpl.id, now: T0 + 1 });
    const ex = s.active!.exercises;
    expect(ex[0].supersetId).toBeTruthy();
    expect(ex[0].supersetId).toBe(ex[1].supersetId);
    expect(ex[0].supersetId).not.toBe(oldId);
    expect(ex[2].supersetId).toBeUndefined();
  });

  it('opløser et supersæt i historikken, hvis den ene øvelse ikke blev lavet', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench', 'row'] });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: s.active!.exercises[0].id });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '8' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    expect(s.history[0].exercises).toHaveLength(1);
    expect(s.history[0].exercises[0].supersetId).toBeUndefined();
  });
});

describe('kalender og stime (#68)', () => {
  const at = (iso: string) => new Date(iso).getTime();
  function withWorkouts(dates: string[]): AppState {
    let s = initialState();
    for (const d of dates) {
      s = reducer(s, { type: 'START_WORKOUT', now: at(d) });
      s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
      const we = s.active!.exercises[0];
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '5' } });
      s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: at(d) });
      s = reducer(s, { type: 'FINISH_WORKOUT', now: at(d) });
    }
    return s;
  }

  it('finder træningsdage i en måned', () => {
    const s = withWorkouts(['2026-10-31T18:00', '2026-11-02T08:00', '2026-11-02T18:00', '2026-11-15T10:00']);
    const days = trainingDays(s, 2026, 10);
    expect(Object.keys(days).map(Number)).toEqual([2, 15]);
    expect(days[2]).toHaveLength(2);
    expect(trainingDays(s, 2026, 11)).toEqual({});
  });

  it('tæller uger i træk, og denne uge tæller først når målet er nået', () => {
    // Uger: 26/10 og 2/11 med to træninger, ugen fra 9/11 med tre (10., 12. og søndag 15.)
    const s = withWorkouts([
      '2026-10-27T10:00', '2026-10-29T10:00',
      '2026-11-03T10:00', '2026-11-05T10:00',
      '2026-11-10T10:00', '2026-11-12T10:00',
      '2026-11-15T10:00',
    ]);
    // Mandag 16. nov. starter en ny uge
    expect(weekStreak(s, 2, at('2026-11-15T12:00'))).toEqual({ weeks: 3, thisWeek: 3 });
    expect(weekStreak(s, 4, at('2026-11-15T12:00'))).toEqual({ weeks: 0, thisWeek: 3 });
    expect(weekStreak(s, 2, at('2026-11-16T12:00'))).toEqual({ weeks: 3, thisWeek: 0 });
    expect(weekStreak(s, 3, at('2026-11-16T12:00'))).toEqual({ weeks: 1, thisWeek: 0 });
  });

  it('en uge uden træning bryder stimen, også hen over årsskifte', () => {
    const s = withWorkouts(['2026-12-15T10:00', '2026-12-29T10:00', '2027-01-05T10:00']);
    expect(weekStreak(s, 1, at('2027-01-06T12:00'))).toEqual({ weeks: 2, thisWeek: 1 });
    expect(weekStreak(initialState(), 2, at('2027-01-06T12:00'))).toEqual({ weeks: 0, thisWeek: 0 });
  });

  it('ugemål har standard 2 og grænser 1–7', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.weeklyGoal;
    expect(loadState(JSON.stringify(old)).weeklyGoal).toBe(2);
    expect(reducer(initialState(), { type: 'SET_WEEKLY_GOAL', goal: 9 }).weeklyGoal).toBe(7);
    expect(reducer(initialState(), { type: 'SET_WEEKLY_GOAL', goal: 0 }).weeklyGoal).toBe(1);
  });
});

describe('forslag til næste vægt (#71)', () => {
  function logged(exerciseId: string, sets: [string, string][]): AppState {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const weId = s.active!.exercises[0].id;
    sets.forEach(([weight, reps], i) => {
      if (i > 0) s = reducer(s, { type: 'ADD_SET', weId });
      const set = s.active!.exercises[0].sets[i];
      s = reducer(s, { type: 'UPDATE_SET', weId, setId: set.id, patch: { weight, reps } });
      s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: T0 });
    });
    return reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
  }

  it('foreslår +2,5 kg på stang, når alle sæt blev klaret', () => {
    const h = progressionHint(logged('bench', [['60', '8'], ['60', '8'], ['60', '8']]), 'bench');
    expect(h).toEqual({
      last: { sets: 3, reps: 8, weight: 60, repsList: [8, 8, 8] },
      next: { weight: 62.5, reps: 8 },
      increase: true,
    });
  });

  it('foreslår samme vægt, hvis et sæt ikke nåede målet', () => {
    const h = progressionHint(logged('bench', [['60', '8'], ['60', '6']]), 'bench');
    expect(h).toMatchObject({ next: { weight: 60, reps: 8 }, increase: false });
  });

  it('+1 kg på håndvægt og +1 rep på kropsvægt', () => {
    expect(progressionHint(logged('curl', [['12', '10']]), 'curl')!.next).toEqual({ weight: 13, reps: 10 });
    expect(progressionHint(logged('pullup', [['', '8'], ['', '8']]), 'pullup')!.next).toEqual({ weight: 0, reps: 9 });
  });

  it('intet forslag uden historik', () => {
    expect(progressionHint(initialState(), 'bench')).toBeNull();
  });
});

describe('udfyld forslag (#72)', () => {
  it('fylder kun tomme felter i arbejdssæt, der ikke er udført', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const weId = s.active!.exercises[0].id;
    s = reducer(s, { type: 'ADD_SET', weId });
    s = reducer(s, { type: 'ADD_SET', weId });
    const [a, b] = s.active!.exercises[0].sets;
    s = reducer(s, { type: 'UPDATE_SET', weId, setId: a.id, patch: { weight: '55', reps: '5', done: true } });
    s = reducer(s, { type: 'UPDATE_SET', weId, setId: b.id, patch: { reps: '6' } });
    s = reducer(s, { type: 'APPLY_HINT', weId, weight: 62.5, reps: 8 });
    expect(s.active!.exercises[0].sets.map((x) => [x.weight, x.reps])).toEqual([
      ['55', '5'],
      ['62,5', '6'],
      ['62,5', '8'],
    ]);
  });
});

describe('slå forslag fra (#73)', () => {
  it('er slået til som standard, også for gamle data, og kan slås fra', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.showHints;
    expect(loadState(JSON.stringify(old)).showHints).toBe(true);
    expect(reducer(initialState(), { type: 'SET_SHOW_HINTS', on: false }).showHints).toBe(false);
  });
});

describe('pausealarm (#84)', () => {
  const rest = (startS: number, total: number) => ({ endsAt: (startS + total) * 1000, total });
  /** Kører alarmen hvert halve sekund fra..til og samler de alarmer, der gives */
  const run = (r: ReturnType<typeof rest> | null, fromS: number, toS: number) => {
    let fired = null as Parameters<typeof restAlertDue>[2];
    const alerts: string[] = [];
    for (let t = fromS * 1000; t <= toS * 1000; t += 500) {
      const res = restAlertDue(r, t, fired);
      fired = res.fired;
      if (res.alert) alerts.push(`${res.alert}@${t / 1000}`);
    }
    return alerts;
  };

  it('advarer én gang 10 s før og giver besked én gang ved 0', () => {
    expect(run(rest(0, 90), 0, 200)).toEqual(['warning@80', 'done@90']);
  });

  it('ingen advarsel ved meget korte pauser', () => {
    expect(run(rest(0, 11), 0, 30)).toEqual(['done@11']);
    expect(run(rest(0, 12), 0, 30)).toEqual(['warning@2', 'done@12']);
  });

  it('intet efter at pausen er sprunget over', () => {
    const r = rest(0, 90);
    const a = restAlertDue(r, 85_000, null);
    expect(a.alert).toBe('warning');
    expect(restAlertDue(null, 95_000, a.fired)).toEqual({ alert: null, fired: null });
  });

  it('justering af pausen er samme pause: advarsel gives ikke igen, slut kommer på det nye tidspunkt', () => {
    let s: AppState = { ...initialState(), rest: rest(0, 90) };
    const first = restAlertDue(s.rest, 81_000, null);
    expect(first.alert).toBe('warning');
    s = reducer(s, { type: 'ADJUST_REST', delta: 15 });
    expect(restAlertDue(s.rest, 95_000, first.fired).alert).toBeNull();
    expect(restAlertDue(s.rest, 105_000, first.fired).alert).toBe('done');
  });

  it('en ny pause får nye alarmer', () => {
    const first = restAlertDue(rest(0, 30), 30_000, null);
    expect(first.alert).toBe('done');
    expect(restAlertDue(rest(40, 30), 61_000, first.fired).alert).toBe('warning');
  });

  it('har ingen alarm, når man åbner appen længe efter pausen var slut – kun én "slut"', () => {
    const a = restAlertDue(rest(0, 60), 600_000, null);
    expect(a.alert).toBe('done');
    expect(restAlertDue(rest(0, 60), 601_000, a.fired).alert).toBeNull();
  });

  it('lyd og vibration er slået til som standard, også for gamle data, og kan slås fra', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.restSound;
    delete old.restVibrate;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.restSound).toBe(true);
    expect(loaded.restVibrate).toBe(true);
    expect(reducer(loaded, { type: 'SET_REST_SOUND', on: false }).restSound).toBe(false);
    expect(reducer(loaded, { type: 'SET_REST_VIBRATE', on: false }).restVibrate).toBe(false);
  });

  it('tæller som indstillinger ved synk – nyeste ændring vinder', () => {
    const phone = { ...initialState(), restSound: false, settingsAt: 200 };
    const pc = { ...initialState(), settingsAt: 100 };
    expect(mergeStates(pc, phone).restSound).toBe(false);
    expect(mergeStates(phone, pc).restSound).toBe(false);
    expect(mergeStates({ ...initialState(), restVibrate: false, settingsAt: 300 }, phone).restVibrate).toBe(false);
  });
});

describe('noter (#99)', () => {
  function withBench() {
    const s = reducer(startWith(initialState()), { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    return { s, weId: s.active!.exercises[0].id };
  }

  it('sætter, renser og fjerner en note på en øvelse', () => {
    const { s, weId } = withBench();
    const a = reducer(s, { type: 'SET_EXERCISE_NOTE', weId, note: '  sædehøjde 4  ' });
    expect(a.active!.exercises[0].note).toBe('sædehøjde 4');
    const b = reducer(a, { type: 'SET_EXERCISE_NOTE', weId, note: '   ' });
    expect('note' in b.active!.exercises[0]).toBe(false);
  });

  it('afkorter lange noter', () => {
    const { s, weId } = withBench();
    const a = reducer(s, { type: 'SET_EXERCISE_NOTE', weId, note: 'x'.repeat(NOTE_MAX + 50) });
    expect(a.active!.exercises[0].note).toHaveLength(NOTE_MAX);
    const b = reducer(a, { type: 'SET_WORKOUT_NOTE', note: 'y'.repeat(NOTE_MAX + 1) });
    expect(b.active!.note).toHaveLength(NOTE_MAX);
  });

  it('sætter, renser og fjerner en note på hele træningen', () => {
    const s = startWith(initialState());
    const a = reducer(s, { type: 'SET_WORKOUT_NOTE', note: ' sov dårligt ' });
    expect(a.active!.note).toBe('sov dårligt');
    expect(reducer(a, { type: 'SET_WORKOUT_NOTE', note: 'sov dårligt' })).toBe(a);
    expect('note' in reducer(a, { type: 'SET_WORKOUT_NOTE', note: '' }).active!).toBe(false);
  });

  it('gør intet uden en igangværende træning', () => {
    const s = initialState();
    expect(reducer(s, { type: 'SET_WORKOUT_NOTE', note: 'hej' })).toBe(s);
  });

  it('noterne gemmes med træningen, når den afsluttes', () => {
    let { s, weId } = withBench();
    s = reducer(s, { type: 'SET_EXERCISE_NOTE', weId, note: 'smal greb' });
    s = reducer(s, { type: 'SET_WORKOUT_NOTE', note: 'god dag' });
    const setId = s.active!.exercises[0].sets[0].id;
    s = reducer(s, { type: 'UPDATE_SET', weId, setId, patch: { weight: '60', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId, setId, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    expect(s.history[0].note).toBe('god dag');
    expect(s.history[0].exercises[0].note).toBe('smal greb');
    expect(loadState(JSON.stringify(s)).history[0].exercises[0].note).toBe('smal greb');
  });

  it('lastExerciseNote finder den nyeste note og springer træninger uden note over', () => {
    const w = (id: string, at: number, note?: string) => ({
      id,
      name: id,
      startedAt: at,
      finishedAt: at + 1,
      exercises: [{ id: id + 'e', exerciseId: 'bench', sets: [], ...(note ? { note } : {}) }],
    });
    const history = [w('c', 300), w('b', 200, 'sædehøjde 4'), w('a', 100, 'gammel')];
    expect(lastExerciseNote(history, 'bench')).toEqual({ note: 'sædehøjde 4', date: 200 });
    expect(lastExerciseNote(history, 'squat')).toBeNull();
    expect(lastExerciseNote([w('x', 1, '  ')], 'bench')).toBeNull();
  });

  it('gamle data uden noter indlæses uændret', () => {
    const old = {
      ...initialState(),
      history: [{ id: 'w', name: 'Gammel', startedAt: 1, finishedAt: 2, exercises: [{ id: 'e', exerciseId: 'bench', sets: [] }] }],
    };
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.history).toEqual(old.history);
    expect(lastExerciseNote(loaded.history, 'bench')).toBeNull();
  });
});

describe('pause i træningen (#115)', () => {
  it('pausetid tæller ikke med i varigheden, heller ikke efter afslutning', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    s = reducer(s, { type: 'PAUSE_WORKOUT', now: T0 + 60_000 });
    expect(workoutDuration(s.active!, T0 + 600_000)).toBe(60_000);
    // Ekstra tryk på pause ændrer ikke starttidspunktet for pausen
    expect(reducer(s, { type: 'PAUSE_WORKOUT', now: T0 + 120_000 })).toEqual(s);
    s = reducer(s, { type: 'RESUME_WORKOUT', now: T0 + 600_000 });
    expect(s.active!.pausedAt).toBeUndefined();
    expect(workoutDuration(s.active!, T0 + 660_000)).toBe(120_000);
    s = reducer(s, { type: 'PAUSE_WORKOUT', now: T0 + 660_000 });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 + 660_000 });
    // Afslut mens den står på pause
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 900_000 });
    expect(s.history[0].pausedAt).toBeUndefined();
    expect(workoutDuration(s.history[0], 0)).toBe(120_000);
  });

  it('gamle træninger uden pausefelter har uændret varighed', () => {
    const w = { id: 'x', name: 'A', startedAt: T0, finishedAt: T0 + 3_600_000, exercises: [] };
    expect(workoutDuration(w, 0)).toBe(3_600_000);
    expect(workoutDuration({ ...w, finishedAt: undefined }, T0)).toBe(0);
  });
});

describe('ret en afsluttet træning (#90)', () => {
  /** Logger en træning med ét sæt bænkpres (80 × 5) og et pausetimer-forløb */
  function logged(at = T0): AppState {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: at });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '80', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: at });
    return reducer(s, { type: 'FINISH_WORKOUT', now: at + 3_600_000 });
  }

  it('retter sæt, tilføjer sæt og øvelser og gemmer på samme plads med samme id', () => {
    let s = logged(T0 - 86_400_000);
    s = { ...logged(T0), history: [...logged(T0).history, ...s.history] };
    const target = s.history[1];
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: target.id });
    expect(s.editing!.id).toBe(target.id);
    const we = s.editing!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '85' }, edit: true });
    s = reducer(s, { type: 'ADD_SET', weId: we.id, edit: true });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['squat', 'row'], edit: true });
    const squat = s.editing!.exercises[1];
    s = reducer(s, { type: 'UPDATE_SET', weId: squat.id, setId: squat.sets[0].id, patch: { weight: '100', reps: '3' }, edit: true });
    s = reducer(s, { type: 'REMOVE_EXERCISE', weId: s.editing!.exercises[2].id, edit: true });
    expect(s.history[1]).toBe(target); // historikken er urørt indtil der gemmes

    s = reducer(s, { type: 'SAVE_EDIT' });
    expect(s.editing).toBeNull();
    expect(s.history).toHaveLength(2);
    const saved = s.history[1];
    expect(saved.id).toBe(target.id);
    expect(saved.startedAt).toBe(target.startedAt);
    expect(saved.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'squat']);
    expect(saved.exercises[0].sets.map((x) => [x.weight, x.reps, x.done])).toEqual([
      ['85', '5', true],
      ['85', '5', true],
    ]);
    expect(saved.exercises[1].sets[0]).toMatchObject({ weight: '100', reps: '3', done: true });
  });

  it('annullér lader historikken være urørt', () => {
    let s = logged();
    const before = s.history;
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: before[0].id });
    const we = s.editing!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '8' }, edit: true });
    s = reducer(s, { type: 'CANCEL_EDIT' });
    expect(s.editing).toBeNull();
    expect(s.history).toBe(before);
    expect(s.history[0].exercises[0].sets[0].weight).toBe('80');
  });

  it('rører aldrig den aktive træning eller pausetimeren', () => {
    let s = logged();
    s = reducer(s, { type: 'START_WORKOUT', now: T0 + 7_200_000 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const active = s.active;
    const rest = s.rest;
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    const we = s.editing!.exercises[0];
    s = reducer(s, { type: 'ADD_SET', weId: we.id, edit: true });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: s.editing!.exercises[0].sets[1].id, now: T0 + 7_300_000, edit: true });
    s = reducer(s, { type: 'RENAME_WORKOUT', name: 'Rettet', edit: true });
    expect(s.active).toBe(active);
    expect(s.rest).toBe(rest);
    expect(s.rest).toBeNull();
    s = reducer(s, { type: 'SAVE_EDIT' });
    expect(s.active).toBe(active);
    expect(s.history[0].name).toBe('Rettet');
    // Og omvendt: almindelige handlinger rammer stadig den aktive træning, ikke kladden
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    const draft = s.editing;
    s = reducer(s, { type: 'RENAME_WORKOUT', name: 'Aktiv' });
    expect(s.active!.name).toBe('Aktiv');
    expect(s.editing).toBe(draft);
  });

  it('en kladde uden øvelser kan ikke gemmes', () => {
    let s = logged();
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    s = reducer(s, { type: 'REMOVE_EXERCISE', weId: s.editing!.exercises[0].id, edit: true });
    expect(reducer(s, { type: 'SAVE_EDIT' })).toBe(s);
    expect(s.history[0].exercises).toHaveLength(1);
  });

  it('dropper kladden, hvis træningen er slettet imens', () => {
    let s = logged();
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    s = reducer(s, { type: 'DELETE_WORKOUT', workoutId: s.history[0].id });
    s = reducer(s, { type: 'SAVE_EDIT' });
    expect(s.history).toHaveLength(0);
    expect(s.editing).toBeNull();
    expect(reducer(s, { type: 'EDIT_WORKOUT', workoutId: 'findes-ikke' })).toBe(s);
  });

  it('gamle gemte data uden kladde indlæses, og kladden sendes ikke til serveren', () => {
    const old = JSON.stringify({ ...logged(), editing: undefined });
    const s = loadState(old);
    expect(s.editing).toBeNull();
    expect(s.history).toHaveLength(1);
    const withDraft = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    expect('editing' in syncPayload(withDraft)).toBe(false);
  });
});

describe('ret navn, dato og varighed (#93)', () => {
  const T = Date.UTC(2026, 10, 10, 17, 0);
  function logged(at = T): AppState {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: at });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '80', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: at });
    return reducer(s, { type: 'FINISH_WORKOUT', now: at + 3_600_000 });
  }
  const now = T + 10 * 86_400_000;

  it('validerer navn, fremtidig dato og varighed', () => {
    expect(workoutTimingError('Push', T, 60, now)).toBeNull();
    expect(workoutTimingError('  ', T, 60, now)).toMatch(/navn/);
    expect(workoutTimingError('Push', now + 60_000, 60, now)).toMatch(/fremtiden/);
    expect(workoutTimingError('Push', T, 0, now)).toMatch(/mindst 1 minut/);
    expect(workoutTimingError('Push', T, MAX_DURATION_MIN + 1, now)).toMatch(/24 timer/);
    expect(workoutTimingError('Push', T, MAX_DURATION_MIN, now)).toBeNull();
    expect(workoutTimingError('Push', NaN, 60, now)).toMatch(/gyldig dato/);
  });

  it('flytter start- og sluttid, nulstiller pausetid og sorterer historikken', () => {
    const older = logged(T - 2 * 86_400_000);
    let s = { ...logged(), history: [...logged().history, ...older.history] };
    s = { ...s, history: s.history.map((w, i) => (i === 0 ? { ...w, pausedMs: 120_000 } : w)) };
    const target = s.history[0];
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: target.id });
    const newStart = T - 3 * 86_400_000;
    s = reducer(s, { type: 'SET_EDIT_TIMING', startedAt: newStart, durationMin: 45, now });
    expect(s.editing).toMatchObject({ startedAt: newStart, finishedAt: newStart + 45 * 60_000 });
    expect(s.editing!.pausedMs).toBeUndefined();
    expect(s.history[0]).toBe(target); // urørt indtil der gemmes
    s = reducer(s, { type: 'SAVE_EDIT' });
    expect(s.history.map((w) => w.id)).toEqual([older.history[0].id, target.id]);
    expect(s.history[1]).toMatchObject({ startedAt: newStart, finishedAt: newStart + 45 * 60_000 });
  });

  it('afviser ugyldige tider og tomt navn', () => {
    let s = logged();
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    const draft = s.editing;
    expect(reducer(s, { type: 'SET_EDIT_TIMING', startedAt: now + 1, durationMin: 30, now }).editing).toBe(draft);
    expect(reducer(s, { type: 'SET_EDIT_TIMING', startedAt: T, durationMin: 0, now }).editing).toBe(draft);
    expect(reducer(s, { type: 'SET_EDIT_TIMING', startedAt: T, durationMin: 25 * 60, now }).editing).toBe(draft);
    expect(reducer(initialState(), { type: 'SET_EDIT_TIMING', startedAt: T, durationMin: 30, now }).editing).toBeNull();
    s = reducer(s, { type: 'RENAME_WORKOUT', name: '   ', edit: true });
    expect(reducer(s, { type: 'SAVE_EDIT' })).toBe(s);
    s = reducer(s, { type: 'RENAME_WORKOUT', name: '  Ben  ', edit: true });
    expect(reducer(s, { type: 'SAVE_EDIT' }).history[0].name).toBe('Ben');
  });
});

describe('program (#106)', () => {
  const T = Date.UTC(2026, 10, 10, 17, 0);
  /** Logger en træning fra en skabelon (eller tom) og afslutter den */
  function train(s: AppState, templateId: string | undefined, at: number): AppState {
    s = reducer(s, { type: 'START_WORKOUT', templateId, now: at });
    if (!templateId) s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: at });
    return reducer(s, { type: 'FINISH_WORKOUT', now: at + 3_600_000 });
  }
  const withProgram = () => reducer(initialState(), { type: 'SET_PROGRAM', templateIds: ['tpl-push', 'tpl-pull', 'tpl-legs'] });
  const next = (s: AppState) => nextInProgram(s)?.id ?? null;

  it('roterer Push → Pull → Ben → Push', () => {
    let s = withProgram();
    expect(next(s)).toBe('tpl-push');
    s = train(s, 'tpl-push', T);
    expect(next(s)).toBe('tpl-pull');
    s = train(s, 'tpl-pull', T + 86_400_000);
    expect(next(s)).toBe('tpl-legs');
    s = train(s, 'tpl-legs', T + 2 * 86_400_000);
    expect(next(s)).toBe('tpl-push');
  });

  it('spring over flytter én frem og nulstilles efter næste træning', () => {
    let s = withProgram();
    s = reducer(s, { type: 'SKIP_PROGRAM' });
    expect(next(s)).toBe('tpl-pull');
    s = reducer(s, { type: 'SKIP_PROGRAM' });
    s = reducer(s, { type: 'SKIP_PROGRAM' });
    expect(next(s)).toBe('tpl-push'); // starter forfra
    s = train(s, 'tpl-push', T);
    expect(next(s)).toBe('tpl-pull');
    s = reducer(s, { type: 'SKIP_PROGRAM' });
    expect(next(s)).toBe('tpl-legs');
    s = train(s, 'tpl-legs', T + 86_400_000);
    expect(next(s)).toBe('tpl-push');
  });

  it('uden for rækkefølge fortsætter fra den udførte; andre skabeloner flytter intet', () => {
    let s = withProgram();
    s = train(s, 'tpl-pull', T);
    expect(next(s)).toBe('tpl-legs');
    s = train(s, undefined, T + 86_400_000); // tom træning
    expect(next(s)).toBe('tpl-legs');
    s = reducer(s, { type: 'SET_PROGRAM', templateIds: ['tpl-push', 'tpl-legs'] });
    s = train(s, 'tpl-pull', T + 2 * 86_400_000); // ikke i programmet længere
    expect(next(s)).toBe('tpl-push'); // efter Pull kom ingen programtræning → første
  });

  it('springer slettede skabeloner over, og intet program giver null', () => {
    let s = withProgram();
    s = train(s, 'tpl-push', T);
    s = reducer(s, { type: 'DELETE_TEMPLATE', templateId: 'tpl-pull' });
    expect(next(s)).toBe('tpl-legs');
    expect(next(initialState())).toBeNull();
    expect(reducer(initialState(), { type: 'SKIP_PROGRAM' })).toEqual(initialState());
  });

  it('SET_PROGRAM dropper ukendte og dobbelte id’er', () => {
    const s = reducer(initialState(), { type: 'SET_PROGRAM', templateIds: ['tpl-pull', 'nope', 'tpl-pull', 'tpl-push'] });
    expect(s.program).toEqual(['tpl-pull', 'tpl-push']);
    expect(reducer(s, { type: 'SET_PROGRAM', templateIds: ['tpl-pull', 'tpl-push'] })).toBe(s);
  });

  it('START_WORKOUT gemmer skabelonen; gamle data indlæses uændret', () => {
    const s = reducer(initialState(), { type: 'START_WORKOUT', templateId: 'tpl-push', now: T });
    expect(s.active!.templateId).toBe('tpl-push');
    expect(reducer(initialState(), { type: 'START_WORKOUT', now: T }).active!.templateId).toBeUndefined();
    const old = train(initialState(), undefined, T) as Partial<AppState>;
    delete old.program;
    delete old.programSkip;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.program).toEqual([]);
    expect(loaded.programSkip).toEqual({ after: null, n: 0 });
    expect(loaded.history).toEqual(old.history);
    expect(next(loaded)).toBeNull();
  });

  it('programmet flettes som de andre indstillinger (nyeste ændring vinder)', () => {
    const base = initialState();
    const phone = trackedReducer(base, { type: 'SET_PROGRAM', templateIds: ['tpl-push', 'tpl-pull'], at: 100 });
    const pc = trackedReducer(base, { type: 'SET_PROGRAM', templateIds: ['tpl-legs'], at: 200 });
    expect(phone.settingsAt).toBe(100);
    expect(mergeStates(phone, pc).program).toEqual(['tpl-legs']);
    expect(mergeStates(pc, phone).program).toEqual(['tpl-legs']);
    const skipped = trackedReducer(pc, { type: 'SKIP_PROGRAM', at: 300 });
    expect(skipped.settingsAt).toBe(300);
    expect(mergeStates(phone, skipped).programSkip).toEqual({ after: null, n: 1 });
  });
});

describe('pausetid pr. øvelse (#119)', () => {
  const T = 1_800_000_000_000;
  function tick(s: AppState, exerciseIds: string[], k = 0, warmup = false) {
    s = reducer(s, { type: 'START_WORKOUT', now: T });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds });
    for (const we of s.active!.exercises) {
      const set = we.sets[k] ?? we.sets[0];
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set.id, patch: { weight: '20', reps: '8', warmup } });
    }
    return s;
  }
  const toggle = (s: AppState, i: number) => {
    const we = s.active!.exercises[i];
    return reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T });
  };

  it('foreslår længere pause til tunge stangløft og kortere til isolation', () => {
    const s = initialState();
    expect(suggestedRest({ muscle: 'Ben', equipment: 'Stang' })).toBe(180);
    expect(restFor(s, 'squat')).toBe(180);
    expect(restFor(s, 'ohp')).toBe(120);
    expect(restFor(s, 'pullup')).toBe(120);
    expect(restFor(s, 'curl')).toBe(60);
    expect(restFor(s, 'cable-fly')).toBe(60);
    expect(restFor(s, 'leg-ext')).toBe(60);
    expect(restInfo(s, 'curl').source).toBe('suggested');
  });

  it('en øvelse med egen pausetid starter timeren med den tid', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'curl', seconds: 75 });
    expect(restInfo(s, 'curl')).toEqual({ seconds: 75, source: 'own' });
    s = toggle(tick(s, ['curl']), 0);
    expect(s.rest).toEqual({ endsAt: T + 75_000, total: 75 });
  });

  it('begrænser tiden og "brug standard" fjerner den egen tid', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'bench', seconds: 9999 });
    expect(restFor(s, 'bench')).toBe(600);
    s = reducer(s, { type: 'SET_EXERCISE_REST', exerciseId: 'bench', seconds: -5 });
    expect(restFor(s, 'bench')).toBe(0);
    s = reducer(s, { type: 'SET_EXERCISE_REST', exerciseId: 'bench' });
    expect(s.exercises.find((e) => e.id === 'bench')).not.toHaveProperty('restSeconds');
    expect(restFor(s, 'bench')).toBe(180);
    expect(reducer(s, { type: 'SET_EXERCISE_REST', exerciseId: 'ukendt', seconds: 60 })).toBe(s);
  });

  it('egen pausetid på 0 starter ingen timer', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'curl', seconds: 0 });
    s = toggle(tick(s, ['curl']), 0);
    expect(s.rest).toBeNull();
  });

  it('uden egen tid bruges den fælles pausetid, når den er ændret i Profil', () => {
    let s = reducer(initialState(), { type: 'SET_REST_SECONDS', seconds: 120 });
    expect(restInfo(s, 'squat')).toEqual({ seconds: 120, source: 'global' });
    s = toggle(tick(s, ['curl']), 0);
    expect(s.rest?.total).toBe(120);
  });

  it('i et supersæt bruges den længste pause i runden', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'curl', seconds: 45 });
    s = tick(s, ['curl', 'bench']);
    s = reducer(s, { type: 'LINK_SUPERSET', weId: s.active!.exercises[0].id });
    s = toggle(s, 0);
    expect(s.rest).toBeNull(); // runden er ikke færdig
    s = toggle(s, 1);
    expect(s.rest?.total).toBe(180);
  });

  it('opvarmningssæt beholder en kort pause', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'squat', seconds: 240 });
    s = toggle(tick(s, ['squat'], 0, true), 0);
    expect(s.rest?.total).toBe(90);
  });

  it('ændringen stemples og flettes som andre øvelsesændringer', () => {
    const a = trackedReducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'bench', seconds: 150, at: T });
    expect(a.exercises.find((e) => e.id === 'bench')).toMatchObject({ restSeconds: 150, updatedAt: T });
    const merged = mergeStates(initialState(), a);
    expect(restFor(merged, 'bench')).toBe(150);
  });

  it('backup (JSON) og gendan beholder øvelsernes egne pausetider (#121)', () => {
    let s = reducer(initialState(), { type: 'SET_EXERCISE_REST', exerciseId: 'squat', seconds: 240 });
    s = reducer(s, { type: 'SET_EXERCISE_REST', exerciseId: 'curl', seconds: 45 });
    const restored = reducer(initialState(), { type: 'IMPORT_STATE', state: loadState(JSON.stringify(s)) });
    expect(restInfo(restored, 'squat')).toEqual({ seconds: 240, source: 'own' });
    expect(restFor(restored, 'curl')).toBe(45);
    expect(restInfo(restored, 'bench').source).toBe('suggested');
  });

  it('gamle gemte data indlæses og opfører sig som før', () => {
    const old = { ...initialState(), restSeconds: 100 } as Partial<AppState>;
    old.exercises = old.exercises!.map(({ restSeconds: _r, ...e }) => e);
    const s = loadState(JSON.stringify(old));
    expect(s.exercises.every((e) => e.restSeconds === undefined)).toBe(true);
    for (const id of ['squat', 'curl', 'bench']) expect(restFor(s, id)).toBe(100);
    const done = toggle(tick(s, ['squat']), 0);
    expect(done.rest?.total).toBe(100);
  });
});

describe('byt øvelse (#126)', () => {
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  function logged(state: AppState, exerciseId: string, at: number) {
    let s = reducer(startWith(state), { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '50', reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: at });
    return reducer(s, { type: 'FINISH_WORKOUT', now: at + 1000 });
  }

  it('foreslår øvelser for samme muskelgruppe, andet udstyr først, uden dem i træningen', () => {
    let s = reducer(startWith(initialState()), { type: 'ADD_EXERCISES', exerciseIds: ['bench', 'dips'] });
    s = reducer(s, { type: 'ADD_CUSTOM_EXERCISE', id: 'close-grip', name: 'Smalt bænkpres', muscle: 'Bryst', equipment: 'Stang' });
    const list = swapSuggestions(s, 'bench');
    expect(ids(list)).toEqual(['cable-fly', 'incline-db', 'close-grip']);
    expect(list.every((e) => e.muscle === 'Bryst')).toBe(true);
    expect(ids(list)).not.toContain('bench');
    expect(ids(list)).not.toContain('dips');
  });

  it('øvelser brugeren har logget flest gange kommer først, og der er højst 6 forslag', () => {
    let s = initialState();
    for (let i = 0; i < 2; i++) s = logged(s, 'lunge', T0 + i * 10_000);
    for (let i = 0; i < 6; i++) {
      s = reducer(s, { type: 'ADD_CUSTOM_EXERCISE', id: `ben-${i}`, name: `Ben ${i}`, muscle: 'Ben', equipment: 'Kropsvægt' });
    }
    const list = swapSuggestions(s, 'squat', null);
    expect(list).toHaveLength(6);
    expect(list[0].id).toBe('lunge');
    expect(swapSuggestions(s, 'ukendt')).toEqual([]);
  });

  it('bytter øvelsen og beholder udfyldte og afkrydsede sæt, supersæt og note', () => {
    let s = reducer(startWith(initialState()), { type: 'ADD_EXERCISES', exerciseIds: ['bench', 'ohp'] });
    const [a] = s.active!.exercises;
    const setId = a.sets[0].id;
    s = reducer(s, { type: 'UPDATE_SET', weId: a.id, setId, patch: { weight: '60', reps: '8' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: a.id, setId, now: T0 });
    s = reducer(s, { type: 'ADD_SET', weId: a.id });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: a.id });
    s = reducer(s, { type: 'SET_EXERCISE_NOTE', weId: a.id, note: 'smal greb' });
    const before = s;
    const after = reducer(s, { type: 'SWAP_EXERCISE', weId: a.id, exerciseId: 'incline-db' });
    const swapped = after.active!.exercises[0];
    expect(swapped.exerciseId).toBe('incline-db');
    expect(swapped.id).toBe(a.id);
    expect(swapped.sets).toEqual(before.active!.exercises[0].sets);
    expect(swapped.sets[0]).toMatchObject({ weight: '60', reps: '8', done: true });
    expect(swapped.supersetId).toBe(before.active!.exercises[0].supersetId);
    expect(swapped.note).toBe('smal greb');
    expect(after.active!.exercises[1]).toBe(before.active!.exercises[1]);
    expect(after.rest).toBe(before.rest);
    expect({ ...after.active!, exercises: [] }).toEqual({ ...before.active!, exercises: [] });
  });

  it('at bytte til samme eller en ukendt øvelse gør intet', () => {
    const s = reducer(startWith(initialState()), { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const weId = s.active!.exercises[0].id;
    expect(reducer(s, { type: 'SWAP_EXERCISE', weId, exerciseId: 'bench' })).toBe(s);
    expect(reducer(s, { type: 'SWAP_EXERCISE', weId, exerciseId: 'ukendt' })).toBe(s);
    expect(reducer(s, { type: 'SWAP_EXERCISE', weId: 'ukendt', exerciseId: 'dips' })).toBe(s);
    expect(reducer(initialState(), { type: 'SWAP_EXERCISE', weId, exerciseId: 'dips' })).toEqual(initialState());
  });

  it('virker på kladden (edit: true) uden at røre den aktive træning', () => {
    let s = logged(initialState(), 'bench', T0);
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    s = reducer(startWith(s), { type: 'ADD_EXERCISES', exerciseIds: ['squat'] });
    const active = s.active;
    const weId = s.editing!.exercises[0].id;
    const out = reducer(s, { type: 'SWAP_EXERCISE', weId, exerciseId: 'dips', edit: true });
    expect(out.editing!.exercises[0].exerciseId).toBe('dips');
    expect(out.active).toBe(active);
    expect(out.history[0].exercises[0].exerciseId).toBe('bench');
  });
});

describe('byt øvelsen i skabelonen (#128)', () => {
  it('erstatter øvelsen i skabelonen og beholder antal sæt og supersæt', () => {
    let s = initialState();
    s = {
      ...s,
      templates: [
        { id: 't1', name: 'Bryst', exercises: [{ exerciseId: 'ohp', sets: 2 }, { exerciseId: 'bench', sets: 4, supersetId: 'x' }, { exerciseId: 'dips', sets: 3, supersetId: 'x' }] },
        ...s.templates,
      ],
    };
    const out = reducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 't1', fromExerciseId: 'bench', toExerciseId: 'cable-fly' });
    expect(out.templates[0].exercises).toEqual([
      { exerciseId: 'ohp', sets: 2 },
      { exerciseId: 'cable-fly', sets: 4, supersetId: 'x' },
      { exerciseId: 'dips', sets: 3, supersetId: 'x' },
    ]);
    expect(out.templates.slice(1)).toEqual(s.templates.slice(1));
    // Næste træning fra skabelonen starter med den nye øvelse
    const next = reducer(out, { type: 'START_WORKOUT', templateId: 't1', now: T0 });
    expect(next.active!.exercises.map((e) => e.exerciseId)).toEqual(['ohp', 'cable-fly', 'dips']);
    expect(next.active!.exercises[1].sets).toHaveLength(4);
  });

  it('gør intet ved ukendt skabelon, øvelse der ikke er i skabelonen eller ukendt ny øvelse', () => {
    const s = initialState();
    expect(reducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 'nej', fromExerciseId: 'bench', toExerciseId: 'dips' })).toBe(s);
    expect(reducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 'tpl-push', fromExerciseId: 'squat', toExerciseId: 'dips' })).toBe(s);
    expect(reducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 'tpl-push', fromExerciseId: 'bench', toExerciseId: 'ukendt' })).toBe(s);
    expect(reducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 'tpl-push', fromExerciseId: 'bench', toExerciseId: 'bench' })).toBe(s);
  });

  it('canSwapInTemplate kræver en skabelon med den gamle øvelse', () => {
    const s = initialState();
    expect(canSwapInTemplate(s, 'tpl-push', 'bench')).toBe(true);
    expect(canSwapInTemplate(s, 'tpl-push', 'squat')).toBe(false);
    expect(canSwapInTemplate(s, undefined, 'bench')).toBe(false);
    expect(canSwapInTemplate(s, 'slettet', 'bench')).toBe(false);
  });

  it('ændringen stemples, så den synkroniseres, og gamle data uden templateId indlæses', () => {
    const s = initialState();
    const out = trackedReducer(s, { type: 'SWAP_IN_TEMPLATE', templateId: 'tpl-push', fromExerciseId: 'bench', toExerciseId: 'dips' });
    expect(out.templates.find((t) => t.id === 'tpl-push')!.updatedAt).toBeGreaterThan(0);
    const old = { ...initialState(), history: [{ id: 'w', name: 'Gammel', startedAt: T0, finishedAt: T0 + 1, exercises: [] }] };
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.history[0].templateId).toBeUndefined();
    expect(canSwapInTemplate(loaded, loaded.history[0].templateId, 'bench')).toBe(false);
  });
});

describe('tids- og distancesæt (#133)', () => {
  function logOne(state: AppState, exerciseId: string, patch: Record<string, string>, toggle = true) {
    let s = startWith(state);
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'ADD_SET', weId: we.id });
    const [a] = s.active!.exercises[0].sets;
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: a.id, patch });
    if (toggle) s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: a.id, now: T0 });
    return s;
  }

  it('Planke er en tidsøvelse og de nye indbyggede øvelser findes', () => {
    const s = initialState();
    expect(exerciseKind(s, 'plank')).toBe('time');
    expect(exerciseKind(s, 'dead-hang')).toBe('time');
    expect(exerciseKind(s, 'farmers-walk')).toBe('distance');
    expect(exerciseKind(s, 'rower')).toBe('distance');
    expect(exerciseKind(s, 'bench')).toBe('reps');
    expect(exerciseKind(s, 'findes-ikke')).toBe('reps');
  });

  it('eksisterende brugere får de nye øvelser, og Planke bliver en tidsøvelse', () => {
    const old = {
      ...initialState(),
      exercises: [
        { id: 'plank', name: 'Planke', muscle: 'Mave', equipment: 'Kropsvægt' },
        { id: 'bench', name: 'Bænkpres', muscle: 'Bryst', equipment: 'Stang' },
        { id: 'egen', name: 'Egen planke', muscle: 'Mave', equipment: 'Kropsvægt', custom: true },
      ],
    };
    const s = loadState(JSON.stringify(old));
    expect(exerciseKind(s, 'plank')).toBe('time');
    expect(exerciseKind(s, 'egen')).toBe('reps');
    expect(s.exercises.find((e) => e.id === 'bench')!.kind).toBeUndefined();
    for (const id of ['dead-hang', 'farmers-walk', 'rower']) expect(s.exercises.filter((e) => e.id === id)).toHaveLength(1);
  });

  it('gamle sæt (uden type og sekunder) indlæses uændret', () => {
    const set = { id: 's1', weight: '60', reps: '30', rpe: '', done: true };
    const old = {
      ...initialState(),
      history: [{ id: 'w1', name: 'Gammel', startedAt: T0, finishedAt: T0 + 1, exercises: [{ id: 'e1', exerciseId: 'plank', sets: [set] }] }],
    };
    const s = loadState(JSON.stringify(old));
    expect(s.history[0].exercises[0].sets[0]).toEqual(set);
    expect(formatSet(s.history[0].exercises[0].sets[0])).toBe('60 kg × 30');
  });

  it('formatSet for alle tre typer', () => {
    const base = { id: 'x', weight: '', reps: '', rpe: '', done: true };
    expect(formatSet({ ...base, weight: '62.5', reps: '5' })).toBe('62,5 kg × 5');
    expect(formatSet({ ...base, reps: '12' })).toBe('12 reps');
    expect(formatSet({ ...base, seconds: '45' })).toBe('45 sek.');
    expect(formatSet({ ...base, meters: '500', seconds: '125' })).toBe('500 m · 2:05');
    expect(formatSet({ ...base, meters: '40' })).toBe('40 m');
  });

  it('isSetFilled ser på det rigtige felt', () => {
    const base = { id: 'x', weight: '', reps: '', rpe: '', done: false };
    expect(isSetFilled({ ...base, reps: '5' })).toBe(true);
    expect(isSetFilled({ ...base, seconds: '30' }, 'time')).toBe(true);
    expect(isSetFilled({ ...base, reps: '5' }, 'time')).toBe(false);
    expect(isSetFilled({ ...base, meters: '500' }, 'distance')).toBe(true);
    expect(isSetFilled({ ...base, seconds: '120' }, 'distance')).toBe(false);
  });

  it('afslutning beholder udfyldte tidssæt og dropper tomme', () => {
    const s = reducer(logOne(initialState(), 'plank', { seconds: '45' }), { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    const sets = s.history[0].exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(formatSet(sets[0])).toBe('45 sek.');
  });

  it('afslutning med "gem uafkrydsede" beholder udfyldte distancesæt', () => {
    let s = logOne(initialState(), 'rower', { meters: '500', seconds: '125' }, false);
    expect(uncheckedFilledCount(s.active!, s)).toBe(1);
    expect(uncheckedFilledCount(s.active!)).toBe(0); // uden typer ses kun reps
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 1000, includeUnchecked: true });
    const sets = s.history[0].exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(formatSet(sets[0])).toBe('500 m · 2:05');
  });

  it('et tidssæt uden sekunder kan ikke krydses af, men bruger sidste gangs tid', () => {
    let s = logOne(initialState(), 'plank', {}, true);
    expect(s.active!.exercises[0].sets.every((x) => !x.done)).toBe(true);
    s = reducer(logOne(initialState(), 'plank', { seconds: '40' }), { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    s = startWith(s);
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['plank'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 + 5000 });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ done: true, seconds: '40' });
  });

  it('nyt sæt kopierer sekunder og meter fra forrige sæt', () => {
    let s = logOne(initialState(), 'rower', { meters: '500', seconds: '125' });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'REMOVE_SET', weId: we.id, setId: we.sets[1].id });
    const next = reducer(s, { type: 'ADD_SET', weId: we.id }).active!.exercises[0].sets.at(-1)!;
    expect(next).toMatchObject({ meters: '500', seconds: '125', done: false });
  });

  it('rettelse af en træning beholder tidssæt', () => {
    let s = reducer(logOne(initialState(), 'plank', { seconds: '45' }), { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    const we = s.editing!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { seconds: '50', done: false }, edit: true });
    s = reducer(s, { type: 'SAVE_EDIT' });
    expect(formatSet(s.history[0].exercises[0].sets[0])).toBe('50 sek.');
  });
});

describe('stopur og tid i felter (#134)', () => {
  function withPlank() {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['plank'] });
    s = reducer(s, { type: 'ADD_SET', weId: s.active!.exercises[0].id });
    return s;
  }

  it('læser m:ss og sekunder', () => {
    expect(parseClock('2:05')).toBe(125);
    expect(parseClock('2:')).toBe(120);
    expect(parseClock('2.30')).toBe(150);
    expect(parseClock('45')).toBe(45);
    expect(parseClock('')).toBeNull();
    expect(parseClock('abc')).toBeNull();
  });

  it('stopuret gemmer starttidspunktet og skriver sekunderne ved stop', () => {
    let s = withPlank();
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'START_SET_TIMER', weId: we.id, setId: we.sets[0].id, now: T0 });
    expect(s.active!.exercises[0].sets[0].timerStartedAt).toBe(T0);
    // Overlever en genindlæsning, fordi det er et tidspunkt
    s = loadState(JSON.stringify(s));
    s = reducer(s, { type: 'STOP_SET_TIMER', weId: we.id, setId: we.sets[0].id, now: T0 + 30_400 });
    const set = s.active!.exercises[0].sets[0];
    expect(set.seconds).toBe('30');
    expect(set.timerStartedAt).toBeUndefined();
  });

  it('kun ét stopur kører ad gangen', () => {
    let s = withPlank();
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'START_SET_TIMER', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'START_SET_TIMER', weId: we.id, setId: we.sets[1].id, now: T0 + 20_000 });
    const [a, b] = s.active!.exercises[0].sets;
    expect(a).toMatchObject({ seconds: '20' });
    expect(a.timerStartedAt).toBeUndefined();
    expect(b.timerStartedAt).toBe(T0 + 20_000);
  });

  it('afslutning stopper et kørende stopur, og tiden kommer med', () => {
    let s = withPlank();
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'START_SET_TIMER', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 50_000, includeUnchecked: true });
    const sets = s.history[0].exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].timerStartedAt).toBeUndefined();
    expect(formatSet(sets[0])).toBe('50 sek.');
  });
});

describe('type på egne øvelser (#135)', () => {
  const add = (kind?: unknown) =>
    reducer(initialState(), {
      type: 'ADD_CUSTOM_EXERCISE',
      id: 'wall-sit',
      name: 'Wall sit',
      muscle: 'Ben',
      equipment: 'Kropsvægt',
      kind: kind as 'time',
    });

  it('gemmer tid og distance', () => {
    expect(exerciseKind(add('time'), 'wall-sit')).toBe('time');
    expect(add('time').exercises.find((e) => e.id === 'wall-sit')!.kind).toBe('time');
    expect(exerciseKind(add('distance'), 'wall-sit')).toBe('distance');
  });

  it('standard og ugyldige typer bliver vægt × reps uden et kind-felt', () => {
    for (const k of [undefined, 'reps', 'svømning', 42]) {
      const s = add(k);
      expect(exerciseKind(s, 'wall-sit')).toBe('reps');
      expect(s.exercises.find((e) => e.id === 'wall-sit')!.kind).toBeUndefined();
    }
  });

  it('typen overlever gem og indlæsning', () => {
    const s = loadState(JSON.stringify(add('distance')));
    expect(exerciseKind(s, 'wall-sit')).toBe('distance');
  });
});

describe('rekorder, forslag og statistik for tids- og distancesæt (#136)', () => {
  const set = (patch: Partial<SetEntry>, id = 's'): SetEntry => ({ id, weight: '', reps: '', rpe: '', done: true, ...patch });
  const workout = (id: string, day: number, exerciseId: string, sets: SetEntry[]): Workout => ({
    id,
    name: id,
    startedAt: T0 + day * 86_400_000,
    finishedAt: T0 + day * 86_400_000 + 1000,
    exercises: [{ id: `${id}-e`, exerciseId, sets }],
  });
  // historikken er nyeste først
  const withHistory = (...ws: Workout[]): AppState => ({ ...initialState(), history: [...ws].sort((a, b) => b.startedAt - a.startedAt) });

  it('tidsøvelser får længste hold og ingen vægtrekorder', () => {
    const s = withHistory(workout('a', 0, 'plank', [set({ seconds: '30' })]), workout('b', 1, 'plank', [set({ seconds: '40' })]));
    const r = personalRecords(s, 'plank');
    expect(r.longestHold).toEqual({ seconds: 40, date: T0 + 86_400_000 });
    expect(r.heaviest).toBeUndefined();
    expect(r.best1RM).toBeUndefined();
    expect(r.repsAtWeight).toEqual({});
    expect(workoutRecords(s, 'b')).toEqual({ plank: ['hold'] });
    expect(workoutRecords(s, 'a')).toEqual({});
  });

  it('distanceøvelser får længste distance og hurtigste tid (tempo)', () => {
    const s = withHistory(
      workout('a', 0, 'rower', [set({ meters: '500', seconds: '120' })]),
      workout('b', 1, 'rower', [set({ meters: '1000', seconds: '250' })]),
      workout('c', 2, 'rower', [set({ meters: '500', seconds: '115' })]),
    );
    const r = personalRecords(s, 'rower');
    expect(r.longestDistance).toMatchObject({ meters: 1000, seconds: 250 });
    expect(r.fastest).toMatchObject({ meters: 500, seconds: 115 });
    expect(workoutRecords(s, 'b')).toEqual({ rower: ['distance'] }); // længere, men langsommere tempo
    expect(workoutRecords(s, 'c')).toEqual({ rower: ['pace'] });
  });

  it('et tidssæt sætter aldrig en vægt × reps-rekord', () => {
    // Fx efter "Byt øvelse" kan et sæt med sekunder ende på en vægtøvelse
    const s = withHistory(
      workout('a', 0, 'bench', [set({ weight: '60', reps: '5' })]),
      workout('b', 1, 'bench', [set({ weight: '200', seconds: '40' })]),
    );
    const r = personalRecords(s, 'bench');
    expect(r.heaviest?.weight).toBe(60);
    expect(r.longestHold).toBeUndefined();
    expect(workoutRecords(s, 'b')).toEqual({});
  });

  it('progressionsforslag: +5 sek. for tid, samme distance lidt hurtigere for distance', () => {
    const t = withHistory(workout('a', 0, 'plank', [set({ seconds: '30' }, '1'), set({ seconds: '45' }, '2')]));
    expect(progressionHint(t, 'plank')?.timed).toEqual({ kind: 'time', last: { seconds: 45, meters: 0 }, next: { seconds: 50, meters: 0 } });
    const d = withHistory(workout('a', 0, 'rower', [set({ meters: '500', seconds: '125' })]));
    expect(progressionHint(d, 'rower')?.timed).toEqual({
      kind: 'distance',
      last: { seconds: 125, meters: 500 },
      next: { seconds: 122, meters: 500 },
    });
  });

  it('intet forslag hellere end et forkert', () => {
    // Distance uden tid, og gamle "reps" på planke (før tidssæt fandtes)
    expect(progressionHint(withHistory(workout('a', 0, 'farmers-walk', [set({ meters: '40' })])), 'farmers-walk')).toBeNull();
    expect(progressionHint(withHistory(workout('a', 0, 'plank', [set({ reps: '30' })])), 'plank')).toBeNull();
  });

  it('forslaget udfyldes i sekund- og meterfelterne, ikke i reps', () => {
    let s = withHistory(workout('a', 0, 'rower', [set({ meters: '500', seconds: '125' })]));
    s = startWith(s);
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['rower'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'APPLY_HINT', weId: we.id, weight: 0, reps: 0, seconds: 122, meters: 500 });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ meters: '500', seconds: '122', reps: '', weight: '' });
  });

  it('volumen ændres ikke af tids- og distancesæt', () => {
    const lift = workout('a', 0, 'bench', [set({ weight: '100', reps: '5' })]);
    const mixed: Workout = {
      ...lift,
      exercises: [
        ...lift.exercises,
        { id: 'p', exerciseId: 'plank', sets: [set({ seconds: '60', weight: '20' })] },
        { id: 'r', exerciseId: 'farmers-walk', sets: [set({ meters: '40', weight: '32' })] },
      ],
    };
    expect(workoutVolume(mixed)).toBe(workoutVolume(lift));
    expect(weeklyVolume(withHistory(mixed), 1, mixed.startedAt)[0].volume).toBe(500);
    const dist = muscleDistribution(withHistory(mixed), 0);
    expect(dist.find((m) => m.muscle === 'Mave')!.volume).toBe(0);
    expect(dist.find((m) => m.muscle === 'Bryst')!.volume).toBe(500);
  });
});

describe('tids- og distancesæt i skabeloner, eksport og backup (#137)', () => {
  function finishedWith(sets: Record<string, Record<string, string>>): AppState {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: Object.keys(sets) });
    for (const we of s.active!.exercises) {
      const set = we.sets[0];
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set.id, patch: sets[we.exerciseId] });
      s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: set.id, now: T0 });
    }
    return reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 60_000 });
  }

  it('CSV har kolonnerne "Sek." og "Meter", tomme for vægt × reps', () => {
    const s = finishedWith({ bench: { weight: '80', reps: '5' }, plank: { seconds: '45' }, rower: { meters: '500,5', seconds: '125' } });
    const lines = toCsv(s).split('\n');
    expect(lines[0]).toBe('Dato,Træning,Øvelse,Sæt,Vægt (kg),Reps,RPE,Sek.,Meter');
    expect(lines.find((l) => l.includes('Bænkpres'))).toMatch(/,Bænkpres,1,80,5,,,$/);
    expect(lines.find((l) => l.includes('Planke'))).toMatch(/,Planke,1,,,,45,$/);
    expect(lines.find((l) => l.includes('Romaskine'))).toMatch(/,Romaskine,1,,,,125,500\.5$/);
  });

  it('backup og gendan beholder type, sekunder og meter', () => {
    let s = finishedWith({ plank: { seconds: '60' }, 'farmers-walk': { meters: '40', seconds: '30' } });
    s = reducer(s, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: s.history[0].id, name: 'Core' });
    const restored = reducer(initialState(), { type: 'IMPORT_STATE', state: loadState(JSON.stringify(s)) });
    expect(restored.history[0]).toEqual(s.history[0]);
    expect(exerciseKind(restored, 'farmers-walk')).toBe('distance');
    expect(restored.templates.at(-1)).toEqual(s.templates.at(-1));
  });

  it('en gammel backup uden typer og tider indlæses uændret', () => {
    const set = { id: 's1', weight: '100', reps: '5', rpe: '8', done: true };
    const old = {
      ...initialState(),
      exercises: initialState().exercises.map(({ kind: _k, ...e }) => e),
      history: [{ id: 'w1', name: 'Gammel', startedAt: T0, finishedAt: T0 + 1, exercises: [{ id: 'e1', exerciseId: 'squat', sets: [set] }] }],
    };
    const s = reducer(initialState(), { type: 'IMPORT_STATE', state: loadState(JSON.stringify(old)) });
    expect(s.history[0].exercises[0].sets[0]).toEqual(set);
    expect(toCsv(s).split('\n')[1]).toMatch(/,Gammel,Squat,1,100,5,8,,$/);
  });

  it('fletning mellem to enheder holder tidssæt intakte', () => {
    const phone = finishedWith({ plank: { seconds: '50' } });
    const pc = finishedWith({ rower: { meters: '1000', seconds: '240' } });
    const merged = mergeStates(phone, pc);
    expect(merged.history).toHaveLength(2);
    const sets = merged.history.flatMap((w) => w.exercises.flatMap((e) => e.sets));
    expect(sets.find((x) => x.seconds === '50')).toMatchObject({ seconds: '50', done: true });
    expect(sets.find((x) => x.meters === '1000')).toMatchObject({ meters: '1000', seconds: '240', done: true });
    expect(mergeStates(pc, phone).history.map((w) => w.id).sort()).toEqual(merged.history.map((w) => w.id).sort());
  });

  it('en skabelon gemt fra en træning med Planke starter med Planke', () => {
    let s = finishedWith({ plank: { seconds: '45' } });
    s = reducer(s, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: s.history[0].id, name: 'Core' });
    const tpl = s.templates.at(-1)!;
    s = reducer(s, { type: 'START_WORKOUT', templateId: tpl.id, now: T0 + 3_600_000 });
    expect(s.active!.exercises.map((e) => e.exerciseId)).toEqual(['plank']);
    expect(exerciseKind(s, s.active!.exercises[0].exerciseId)).toBe('time');
  });
});

describe('opsummering af en træning (#142)', () => {
  const H = 3_600_000;
  function doWorkout(state: AppState, at: number, sets: { ex: string; weight: string; reps: string; done?: boolean }[], templateId?: string) {
    let s = reducer(state, { type: 'START_WORKOUT', templateId, now: at });
    if (!templateId) s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [...new Set(sets.map((x) => x.ex))] });
    for (const x of sets) {
      let we = s.active!.exercises.find((e) => e.exerciseId === x.ex)!;
      let set = we.sets.find((y) => !y.weight && !y.reps);
      if (!set) {
        s = reducer(s, { type: 'ADD_SET', weId: we.id });
        we = s.active!.exercises.find((e) => e.exerciseId === x.ex)!;
        set = we.sets.at(-1)!;
      }
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set.id, patch: { weight: x.weight, reps: x.reps } });
      if (x.done !== false) s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: set.id, now: at });
    }
    return reducer(s, { type: 'FINISH_WORKOUT', now: at + 45 * 60_000 });
  }

  it('varighed, volumen og antal sæt – ikke-udførte sæt tæller ikke', () => {
    const s = doWorkout(initialState(), T0, [
      { ex: 'bench', weight: '80', reps: '5' },
      { ex: 'bench', weight: '80', reps: '5' },
      { ex: 'bench', weight: '100', reps: '5', done: false },
    ]);
    expect(s.lastFinishedId).toBe(s.history[0].id);
    const sum = workoutSummary(s, s.lastFinishedId!)!;
    expect(sum.durationMs).toBe(45 * 60_000);
    expect(sum.volume).toBe(800);
    expect(sum.sets).toBe(2);
    expect(sum.volumeChangePct).toBeNull();
    expect(sum.records).toEqual([]);
  });

  it('en ny tungeste vægt er en rekord, den samme vægt er ikke', () => {
    let s = doWorkout(initialState(), T0, [{ ex: 'squat', weight: '100', reps: '5' }]);
    s = doWorkout(s, T0 + 24 * H, [{ ex: 'squat', weight: '100', reps: '5' }]);
    expect(workoutSummary(s, s.lastFinishedId!)!.recordCount).toBe(0);
    s = doWorkout(s, T0 + 48 * H, [{ ex: 'squat', weight: '105', reps: '5' }]);
    const sum = workoutSummary(s, s.lastFinishedId!)!;
    expect(sum.records).toEqual([{ exerciseId: 'squat', name: 'Squat', kinds: expect.arrayContaining(['heaviest']) }]);
    expect(sum.recordCount).toBeGreaterThan(0);
  });

  it('sammenligner volumen med sidste træning fra samme skabelon', () => {
    const tpl = initialState().templates[0];
    const ex = tpl.exercises[0].exerciseId;
    let s = doWorkout(initialState(), T0, [{ ex, weight: '100', reps: '5' }], tpl.id);
    expect(workoutSummary(s, s.lastFinishedId!)!.volumeChangePct).toBeNull();
    // En træning uden skabelon imellem tæller ikke med
    s = doWorkout(s, T0 + 24 * H, [{ ex, weight: '200', reps: '5' }]);
    s = doWorkout(s, T0 + 48 * H, [{ ex, weight: '105', reps: '5' }], tpl.id);
    const sum = workoutSummary(s, s.lastFinishedId!)!;
    expect(sum.previousVolume).toBe(500);
    expect(sum.volumeChangePct).toBe(5);
  });

  it('opsummeringen lukkes, når en ny træning startes eller med CLOSE_SUMMARY', () => {
    let s = doWorkout(initialState(), T0, [{ ex: 'bench', weight: '60', reps: '8' }]);
    expect(reducer(s, { type: 'CLOSE_SUMMARY' }).lastFinishedId).toBeNull();
    s = reducer(s, { type: 'START_WORKOUT', now: T0 + H });
    expect(s.lastFinishedId).toBeNull();
    expect(workoutSummary(s, 'findes-ikke')).toBeNull();
  });

  it('gammel gemt data uden feltet indlæses, og genindlæsning lukker opsummeringen', () => {
    const { lastFinishedId: _l, ...old } = initialState();
    expect(loadState(JSON.stringify(old)).lastFinishedId).toBeNull();
    const s = doWorkout(initialState(), T0, [{ ex: 'bench', weight: '60', reps: '8' }]);
    const reloaded = loadState(JSON.stringify(s));
    expect(reloaded.lastFinishedId).toBeNull();
    expect(reloaded.history).toEqual(s.history);
    expect('lastFinishedId' in syncPayload(s)).toBe(false);
  });
});

describe('delebillede af opsummeringen (#144)', () => {
  it('bygger tekstlinjerne ud fra en opsummering', () => {
    const card = shareCardLines({
      workoutId: 'w1',
      name: 'Push',
      startedAt: T0,
      durationMs: 45 * 60_000,
      volume: 1250.5,
      sets: 12,
      records: [{ exerciseId: 'bench', name: 'Bænkpres', kinds: ['heaviest', '1rm'] }],
      recordCount: 2,
      volumeChangePct: 25,
      previousVolume: 1000,
    });
    expect(card.app).toBe('Løft');
    expect(card.date).toBe('15. november 2026');
    expect(card.title).toBe('Push');
    expect(card.stats).toEqual([
      { label: 'Tid', value: '45:00' },
      { label: 'Volumen', value: '1250,5 kg' },
      { label: 'Sæt', value: '12 sæt' },
      { label: 'Rekorder', value: '2' },
    ]);
    expect(card.change).toBe('+25 % volumen siden sidst');
    expect(card.records).toEqual(['🏆 Bænkpres – tungeste vægt, estimeret 1RM']);
    expect(card.fileName).toBe('loeft-2026-11-15.png');
  });

  it('uden sammenligning og rekorder er de linjer tomme', () => {
    const base = {
      workoutId: 'w1', name: 'Tom træning', startedAt: T0, durationMs: 0, volume: 0, sets: 1,
      records: [], recordCount: 0, volumeChangePct: null, previousVolume: null,
    };
    const card = shareCardLines(base);
    expect(card.change).toBeNull();
    expect(card.records).toEqual([]);
    expect(shareCardLines({ ...base, volumeChangePct: -10, previousVolume: 10 }).change).toBe('−10 % volumen siden sidst');
  });
});

describe('gentag en træning (#149)', () => {
  const set = (weight: string, reps: string, extra: Partial<SetEntry> = {}): SetEntry => ({
    id: Math.random().toString(36).slice(2), weight, reps, rpe: '', done: true, ...extra,
  });
  const tuesday: Workout = {
    id: 'tue', name: 'Tirsdag', startedAt: T0 - 7 * 86_400_000, finishedAt: T0 - 7 * 86_400_000 + 3_600_000,
    exercises: [
      { id: 'e1', exerciseId: 'bench', sets: [set('40', '10', { warmup: true }), set('80', '8'), set('80', '7')] },
      { id: 'e2', exerciseId: 'row', supersetId: 'ss', sets: [set('60', '10')] },
      { id: 'e3', exerciseId: 'curl', supersetId: 'ss', sets: [set('12', '12'), set('12', '10'), set('', '', { done: false })] },
    ],
  };
  const latest: Workout = {
    id: 'latest', name: 'Senest', startedAt: T0 - 86_400_000, finishedAt: T0 - 86_400_000 + 3_600_000,
    exercises: [{ id: 'e9', exerciseId: 'bench', sets: [set('100', '3')] }],
  };
  const withHistory = (): AppState => ({ ...initialState(), history: [latest, tuesday] });

  it('kopierer øvelser, antal arbejdssæt og supersæt med nye id’er og springer opvarmning over', () => {
    const s = reducer(withHistory(), { type: 'REPEAT_WORKOUT', workoutId: 'tue', now: T0 });
    const a = s.active!;
    expect(a.name).toBe('Tirsdag');
    expect(a.repeatOf).toBe('tue');
    expect(a.startedAt).toBe(T0);
    expect(a.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'row', 'curl']);
    expect(a.exercises.map((e) => e.sets.length)).toEqual([2, 1, 3]);
    expect(a.exercises.every((e) => e.sets.every((x) => !x.done && !x.weight && !x.reps && !x.warmup))).toBe(true);
    expect(a.exercises[0].id).not.toBe('e1');
    expect(a.exercises[1].supersetId).toBeTruthy();
    expect(a.exercises[1].supersetId).toBe(a.exercises[2].supersetId);
    expect(a.exercises[1].supersetId).not.toBe('ss');
    expect(a.exercises[0].supersetId).toBeUndefined();
  });

  it('"Forrige" kommer fra den gentagne træning, og afkrydsning udfylder den dags tal', () => {
    let s = reducer(withHistory(), { type: 'REPEAT_WORKOUT', workoutId: 'tue', now: T0 });
    expect(previousSetsFor(s.history, s.active, 'bench').map((x) => x.weight)).toEqual(['80', '80']);
    // uden repeatOf: seneste gang
    expect(previousSetsFor(s.history, { id: 'x' }, 'bench').map((x) => x.weight)).toEqual(['100']);
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[1].id, now: T0 });
    const done = s.active!.exercises[0].sets[1];
    expect(done).toMatchObject({ done: true, weight: '80', reps: '7' });
  });

  it('falder tilbage til seneste gang for øvelser, der ikke var med den dag', () => {
    const s = reducer(withHistory(), { type: 'REPEAT_WORKOUT', workoutId: 'tue', now: T0 });
    const other = { ...tuesday, id: 'x', exercises: [] };
    expect(previousSetsFor([latest, other], { id: 'n', repeatOf: 'x' }, 'bench').map((x) => x.weight)).toEqual(['100']);
    expect(s.active).not.toBeNull();
  });

  it('erstatter kun en igangværende træning med replace, og ukendt træning gør intet', () => {
    const running = reducer(withHistory(), { type: 'START_WORKOUT', now: T0 });
    const same = reducer(running, { type: 'REPEAT_WORKOUT', workoutId: 'tue', now: T0 + 1 });
    expect(same).toBe(running);
    const replaced = reducer(running, { type: 'REPEAT_WORKOUT', workoutId: 'tue', now: T0 + 1, replace: true });
    expect(replaced.active!.repeatOf).toBe('tue');
    expect(replaced.active!.id).not.toBe(running.active!.id);
    const s0 = withHistory();
    expect(reducer(s0, { type: 'REPEAT_WORKOUT', workoutId: 'nope', now: T0 })).toBe(s0);
  });

  it('gamle gemte data uden repeatOf indlæses uændret', () => {
    const old = { ...initialState(), history: [tuesday], active: { ...latest, finishedAt: undefined } };
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.history).toEqual([tuesday]);
    expect(loaded.active!.repeatOf).toBeUndefined();
    expect(previousSetsFor(loaded.history, loaded.active, 'bench').map((x) => x.weight)).toEqual(['80', '80']);
  });
});

describe('hold skærmen tændt (#154)', () => {
  it('vil kun have skærmlås under en kørende, synlig træning med indstillingen slået til', () => {
    const idle = initialState();
    const running = startWith(idle);
    expect(wantsWakeLock(running, true)).toBe(true);
    expect(wantsWakeLock(idle, true)).toBe(false);
    expect(wantsWakeLock(running, false)).toBe(false);
    const paused = reducer(running, { type: 'PAUSE_WORKOUT', now: T0 + 1000 });
    expect(wantsWakeLock(paused, true)).toBe(false);
    expect(wantsWakeLock(reducer(paused, { type: 'RESUME_WORKOUT', now: T0 + 2000 }), true)).toBe(true);
    expect(wantsWakeLock(reducer(running, { type: 'SET_KEEP_AWAKE', on: false }), true)).toBe(false);
  });

  it('er slået til for gamle data og flettes mellem enheder som en indstilling', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.keepAwake;
    expect(loadState(JSON.stringify(old)).keepAwake).toBe(true);
    const prev = initialState();
    const off = stampChanges(prev, reducer(prev, { type: 'SET_KEEP_AWAKE', on: false }), 500);
    expect(off.settingsAt).toBe(500);
    expect(mergeStates({ ...initialState(), settingsAt: 100 }, off).keepAwake).toBe(false);
    expect(mergeStates(off, { ...initialState(), settingsAt: 100 }).keepAwake).toBe(false);
  });
});

describe('rekordvæg (#162)', () => {
  const DAY = 86_400_000;
  const BASE = new Date(2026, 10, 3, 12).getTime(); // 3. nov. 2026
  const ws = (weight: string, reps: string, warmup = false): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup });
  const w = (id: string, at: number, exercises: [string, SetEntry[]][]): Workout => ({
    id,
    name: id,
    startedAt: at,
    finishedAt: at + 1000,
    exercises: exercises.map(([exerciseId, sets]) => ({ id: uid(), exerciseId, sets })),
  });
  const withHistory = (...list: Workout[]): AppState => ({ ...initialState(), history: [...list].sort((a, b) => b.startedAt - a.startedAt) });

  it('samler tungeste, 1RM og mest volumen pr. øvelse med datoer, nyeste først', () => {
    const s = withHistory(
      w('a', BASE, [['bench', [ws('80', '5'), ws('120', '1', true)]], ['squat', [ws('100', '5')]]]),
      w('b', BASE + DAY, [['bench', [ws('90', '1'), ws('60', '12')]]]),
      w('c', BASE + 2 * DAY, [['squat', [ws('110', '3')]]]),
    );
    const rows = recordsWall(s);
    expect(rows.map((r) => r.exerciseId)).toEqual(['squat', 'bench']);
    const [squat, bench] = rows;
    expect(bench.heaviest).toEqual({ weight: 90, reps: 1, date: BASE + DAY }); // opvarmning på 120 tæller ikke
    expect(bench.best1RM).toMatchObject({ value: estimate1RM(80, 5), weight: 80, reps: 5, date: BASE }); // 80 × 5 (≈93) slår 90 × 1
    expect(bench.bestVolume).toEqual({ volume: 720, weight: 60, reps: 12, date: BASE + DAY });
    expect(bench.latest).toBe(BASE + DAY);
    expect(squat.heaviest).toMatchObject({ weight: 110, date: BASE + 2 * DAY });
    expect(squat.bestVolume).toMatchObject({ volume: 500, date: BASE });
    expect(squat.latest).toBe(BASE + 2 * DAY);
    expect(squat.name).toBe('Squat');
  });

  it('kan filtrere på muskelgruppe og springer øvelser med kun opvarmning over', () => {
    const s = withHistory(w('a', BASE, [['bench', [ws('80', '5')]], ['squat', [ws('60', '5', true)]], ['plank', [{ ...ws('', ''), seconds: '45' }]]]));
    expect(recordsWall(s, 'Bryst').map((r) => r.exerciseId)).toEqual(['bench']);
    expect(recordsWall(s, 'Ben')).toEqual([]);
    const plank = recordsWall(s, 'Mave')[0];
    expect(plank.longestHold).toEqual({ seconds: 45, date: BASE });
    expect(plank.heaviest).toBeUndefined();
    expect(recordsWall(initialState())).toEqual([]);
  });

  it('tæller kun rekorder fra denne måned', () => {
    const october = new Date(2026, 9, 20, 12).getTime();
    const s = withHistory(
      w('a', october, [['bench', [ws('80', '5')]]]),
      w('b', october + DAY, [['bench', [ws('85', '5')]]]), // oktober: heaviest + 1rm
      w('c', BASE, [['bench', [ws('85', '7')]]]), // november: 1rm + reps
      w('d', BASE + DAY, [['bench', [ws('70', '5')]]]),
    );
    expect(newRecordsInMonth(s, BASE + 5 * DAY)).toBe(2);
    expect(newRecordsInMonth(s, october + 5 * DAY)).toBe(2);
    expect(newRecordsInMonth(s, new Date(2026, 11, 2).getTime())).toBe(0);
    expect(newRecordsInMonth(initialState(), BASE)).toBe(0);
  });
});

describe('månedens opsummering (#168)', () => {
  const MIN = 60_000;
  const ws = (weight: string, reps: string, warmup = false): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup });
  const w = (id: string, at: number, mins: number, exercises: [string, SetEntry[]][]): Workout => ({
    id,
    name: id,
    startedAt: at,
    finishedAt: at + mins * MIN,
    exercises: exercises.map(([exerciseId, sets]) => ({ id: uid(), exerciseId, sets })),
  });
  const withHistory = (...list: Workout[]): AppState => ({ ...initialState(), history: [...list].sort((a, b) => b.startedAt - a.startedAt) });
  const oct = (day: number) => new Date(2026, 9, day, 12).getTime();
  const sep = (day: number) => new Date(2026, 8, day, 12).getTime();

  it('tæller træninger, tid, volumen, rekorder, muskelgruppe, favorit og stime – uden opvarmning', () => {
    const s = withHistory(
      w('s1', sep(28), 40, [['bench', [ws('80', '5')]]]),
      w('o1', oct(1), 60, [['bench', [ws('85', '5'), ws('100', '5', true)]], ['squat', [ws('100', '5')]]]),
      w('o2', oct(2), 45, [['squat', [ws('100', '5'), ws('100', '5'), ws('100', '5')]]]),
      w('o3', oct(3), 30, [['bench', [ws('80', '5')]]]),
      w('o4', oct(10), 50, [['squat', [ws('110', '3')]]]),
      w('n1', new Date(2026, 10, 1, 12).getTime(), 30, [['squat', [ws('200', '5')]]]),
    );
    const r = monthRecap(s, 2026, 9);
    expect(r.key).toBe('2026-10');
    expect(r.workouts).toBe(4);
    expect(r.durationMs).toBe((60 + 45 + 30 + 50) * MIN);
    expect(r.volume).toBe(425 + 500 + 1500 + 400 + 330);
    // o1: bænk 85 slår 80 (tungeste + 1RM); o4: squat 110 slår 100 (tungeste + 1RM) – opvarmningen på 100 tæller ikke
    expect(r.records).toBe(4);
    expect(r.topMuscle).toBe('Ben');
    expect(r.favourite).toEqual({ exerciseId: 'squat', name: 'Squat', sets: 5 });
    expect(r.longestStreak).toBe(3);
  });

  it('sammenligner med måneden før – også når den var tom', () => {
    const s = withHistory(
      w('s1', sep(5), 40, [['bench', [ws('100', '5')]]]),
      w('o1', oct(5), 40, [['bench', [ws('100', '5')]]]),
      w('o2', oct(6), 40, [['bench', [ws('100', '6')]]]),
      w('o3', oct(9), 40, [['bench', [ws('100', '4')]]]),
    );
    const r = monthRecap(s, 2026, 9);
    expect(r.previous.workouts).toBe(1);
    expect(r.workoutsDiff).toBe(2);
    expect(r.volumeChangePct).toBe(200); // 1500 mod 500
    const sepRecap = monthRecap(s, 2026, 8);
    expect(sepRecap.previous.workouts).toBe(0);
    expect(sepRecap.workoutsDiff).toBe(1);
    expect(sepRecap.volumeChangePct).toBeNull();
    const empty = monthRecap(initialState(), 2026, 9);
    expect(empty).toMatchObject({ workouts: 0, volume: 0, records: 0, topMuscle: null, favourite: null, longestStreak: 0, volumeChangePct: null });
  });

  it('januar sammenlignes med december året før', () => {
    const s = withHistory(w('d', new Date(2025, 11, 20, 12).getTime(), 30, [['bench', [ws('50', '10')]]]));
    const r = monthRecap(s, 2026, 0);
    expect(r.key).toBe('2026-01');
    expect(r.previous.workouts).toBe(1);
    expect(monthKey(2025, 11)).toBe('2025-12');
  });

  it('viser sidste måneds opsummering de første 7 dage af en ny måned (#169)', () => {
    const s = withHistory(
      w('s1', sep(5), 40, [['bench', [ws('100', '5')]]]),
      w('o1', oct(5), 40, [['bench', [ws('100', '5')]]]),
      w('o2', oct(6), 40, [['bench', [ws('100', '6')]]]),
    );
    const nov = (day: number) => new Date(2026, 10, day, 9).getTime();
    expect(recapToShow(s, nov(3))?.key).toBe('2026-10');
    expect(recapToShow(s, nov(7))?.workouts).toBe(2);
    expect(recapToShow(s, nov(8))).toBeNull();
    expect(recapToShow(s, nov(10))).toBeNull();
    // lukket for oktober → skjult, men november-opsummeringen i december vises igen
    const closed = reducer(s, { type: 'DISMISS_RECAP', key: '2026-10' });
    expect(recapToShow(closed, nov(3))).toBeNull();
    // ingen træninger i måneden før → intet kort
    expect(recapToShow(s, new Date(2026, 11, 2).getTime())).toBeNull();
    // januar viser december året før
    const dec = withHistory(w('d', new Date(2025, 11, 20, 12).getTime(), 30, [['bench', [ws('50', '10')]]]));
    expect(recapToShow(dec, new Date(2026, 0, 1, 8).getTime())?.key).toBe('2025-12');
    expect(monthNameDa(9)).toBe('oktober');
    expect(monthNameDa(-1)).toBe('december');
  });

  it('formaterer tid og ændringer for opsummeringen (#169)', () => {
    expect(formatTotalTime(45 * MIN)).toBe('45 min');
    expect(formatTotalTime(320 * MIN)).toBe('5 t 20 min');
    expect(formatTotalTime(120 * MIN)).toBe('2 t');
    const s = withHistory(
      w('s1', sep(5), 40, [['bench', [ws('100', '5')]]]),
      w('o1', oct(5), 40, [['bench', [ws('100', '5')]]]),
      w('o2', oct(6), 40, [['bench', [ws('100', '6')]]]),
    );
    expect(recapChangeTexts(monthRecap(s, 2026, 9))).toEqual(['+1 træning', '+120 % volumen']);
    expect(recapChangeTexts(monthRecap(s, 2026, 10))).toEqual(['−2 træninger', '−100 % volumen']);
    expect(recapChangeTexts(monthRecap(s, 2026, 8))).toEqual([]);
  });

  it('DISMISS_RECAP gemmer måneden, og gamle data indlæses uændret', () => {
    const s = reducer(initialState(), { type: 'DISMISS_RECAP', key: '2026-10' });
    expect(s.recapDismissed).toBe('2026-10');
    expect(loadState(JSON.stringify(s)).recapDismissed).toBe('2026-10');
    const old: Partial<AppState> = { ...initialState(), history: [w('a', oct(1), 30, [['bench', [ws('80', '5')]]])] };
    delete old.recapDismissed;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.recapDismissed).toBeNull();
    expect(loaded.history).toHaveLength(1);
  });
});

describe('mod sidst under træningen (#175)', () => {
  const DAY = 24 * 3_600_000;
  const set = (weight: string, reps: string, extra: Partial<SetEntry> = {}): SetEntry => ({
    id: Math.random().toString(36).slice(2), weight, reps, rpe: '', done: true, ...extra,
  });
  const we = (exerciseId: string, sets: SetEntry[]) => ({ id: `we-${exerciseId}-${Math.random()}`, exerciseId, sets });
  function stateWith(prev: Workout[]): AppState {
    return { ...initialState(), history: prev };
  }
  const last: Workout = {
    id: 'last', name: 'Push', startedAt: T0 - 3 * DAY, finishedAt: T0 - 3 * DAY + 3_600_000, templateId: 'tpl-push',
    exercises: [
      we('bench', [set('40', '10', { warmup: true }), set('80', '5'), set('80', '5'), set('80', '5')]),
      we('ohp', [set('50', '5'), set('50', '5')]),
      we('plank', [set('', '', { seconds: '60' }), set('', '', { seconds: '60' })]),
    ],
  };
  const active = (exercises: Workout['exercises'], templateId: string | null = 'tpl-push'): Workout => ({
    id: 'now', name: 'Push', startedAt: T0, templateId: templateId ?? undefined, exercises,
  });

  it('ingen skabelon eller ikke lavet før → null', () => {
    const s = stateWith([last]);
    expect(vsLastTime(s, active([we('bench', [set('80', '5')])], null))).toBeNull();
    expect(vsLastTime(s, active([we('bench', [set('80', '5')])], 'tpl-pull'))).toBeNull();
    expect(vsLastTime(stateWith([]), active([we('bench', [set('80', '5')])]))).toBeNull();
    expect(vsLastTime(s, null)).toBeNull();
  });

  it('efter 2 af 3 sæt sammenlignes kun med de første 2 sæt fra sidst; opvarmning tæller ikke', () => {
    const s = stateWith([last]);
    const w = active([
      we('bench', [set('20', '10', { warmup: true }), set('85', '5'), set('85', '5'), set('85', '5', { done: false })]),
    ]);
    const r = vsLastTime(s, w)!;
    expect(r.previousId).toBe('last');
    expect(r.previousDate).toBe(last.startedAt);
    expect(r.started).toBe(true);
    expect(r.rows[0]).toMatchObject({ exerciseId: 'bench', name: 'Bænkpres', unit: 'kg', doneSets: 2, complete: false, now: 850, last: 800, status: null });
    expect(r.diffKg).toBe(50);
  });

  it('▲/●/▼ pr. øvelse, når alle sæt er krydset af; byttede øvelser uden historik har ingen sammenligning', () => {
    const s = stateWith([last]);
    const r = vsLastTime(s, active([
      we('bench', [set('85', '5'), set('80', '5'), set('80', '5')]),
      we('ohp', [set('50', '5'), set('50', '4')]),
      we('lateral', [set('10', '12')]),
      we('curl', [set('10', '12', { done: false })]),
    ]))!;
    expect(r.rows.map((x) => x.status)).toEqual(['up', 'down', null, null]);
    expect(r.rows[2]).toMatchObject({ exerciseId: 'lateral', last: null, complete: true });
    expect(r.diffKg).toBe(25 - 50);
    const same = vsLastTime(s, active([we('ohp', [set('50', '5'), set('50', '5')])]))!;
    expect(same.rows[0].status).toBe('same');
    expect(same.diffKg).toBe(0);
  });

  it('intet afkrydset endnu → ikke startet', () => {
    const r = vsLastTime(stateWith([last]), active([we('bench', [set('80', '5', { done: false })])]))!;
    expect(r.started).toBe(false);
    expect(r.diffKg).toBe(0);
    expect(r.rows[0].last).toBe(0);
  });

  it('et plankesæt sammenlignes i sekunder og ændrer ikke kg-forskellen', () => {
    const r = vsLastTime(stateWith([last]), active([
      we('plank', [set('', '', { seconds: '90' }), set('', '', { seconds: '45', done: false })]),
    ]))!;
    expect(r.rows[0]).toMatchObject({ unit: 'sek', now: 90, last: 60, status: null });
    expect(r.diffKg).toBe(0);
    expect(r.started).toBe(true);
  });

  it('oversigtens tekster: tal begge gange, "Ny i dag" og "–" for ikke startet (#177)', () => {
    const s = stateWith([last]);
    const r = vsLastTime(s, active([
      we('bench', [set('85', '5'), set('85', '5'), set('85', '5')]),
      we('lateral', [set('10', '12')]),
      we('ohp', [set('50', '5', { done: false }), set('50', '5', { done: false })]),
      we('plank', [set('', '', { seconds: '90' }), set('', '', { seconds: '60' })]),
    ]))!;
    expect(r.rows.map(vsRowCells)).toEqual([
      { now: '1.275 kg', last: '1.200 kg' },
      { now: '120 kg', last: 'Ny i dag' },
      { now: '–', last: '500 kg' },
      { now: '150 sek.', last: '120 sek.' },
    ]);
    expect(r.rows[2]).toMatchObject({ last: 0, lastTotal: 500 });
  });

  it('sammenligner med den seneste afsluttede gang fra skabelonen', () => {
    const older: Workout = { ...last, id: 'older', startedAt: T0 - 10 * DAY, finishedAt: T0 - 10 * DAY + 1 };
    const r = vsLastTime(stateWith([older, last]), active([we('ohp', [set('50', '5')])]))!;
    expect(r.previousId).toBe('last');
  });
});
