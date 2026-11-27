import { describe, expect, it } from 'vitest';
import {
  deloadWeightInput,
  deloadWeightText,
  stallText,
  exerciseStall,
  stalledExercises,
  isStallDismissed,
  actualRests,
  repMaxTable,
  repMaxesBeaten,
  isStrongRepMax,
  workoutRepMaxes,
  repMaxLine,
  nearestLoadableKg,
  platesText,
  warmupSetsFor,
  plateSetup,
  DEFAULT_PLATES_LB,
  toDisplay,
  fromDisplay,
  weightInputText,
  weightFromInput,
  formatWeight,
  restSummary,
  typicalRest,
  weekPlan,
  weekPlanNudge,
  roundRestTo15,
  actualRestBefore,
  yearReview,
  yearsWithWorkouts,
  yearReviewCardYear,
  yearReviewSlides,
  yearShareCardLines,
  volumeComparison,
  restFor,
  lifetimeStats,
  mostLiftedExercises,
  formatTons,
  daysAgoText,
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
  recentExercises,
  pickerGroups,
  goalProgress,
  goalsOverview,
  goalEta,
  etaText,
  goalOnTrack,
  stampChanges,
  validRepRange,
  formatTemplateLine,
  personalRecords,
  platesPerSide,
  previousSets,
  previousSetsFor,
  progressionHint,
  yearHeatmap,
  heatmapYears,
  parseRpe,
  formatRpe,
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
  resolveTheme,
  restAlertDue,
  wantsWakeLock,
  STORAGE_KEY,
  bodyToCsv,
  toCsv,
  workoutSummary,
  vsLastTime,
  dropSetWeight,
  setTagInfo,
  setTagSuffix,
  setLabel,
  milestones,
  milestonesUnlockedBy,
  milestoneProgressText,
  milestoneTileLabel,
  bodyWeightAt,
  bodyWeightOn,
  setLoad,
  withLoads,
  loadedState,
  isBodyweight,
  vsRowCells,
  shareCardLines,
  trainingDays,
  uncheckedFilledCount,
  exerciseKind,
  isSetFilled,
  formatSet,
  bodyweightText,
  BODYWEIGHT_REPS_TARGET,
  isBodyweightReps,
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
  muscleRecovery,
  templateReady,
  nearestLoadable,
  percentTable,
  tableOneRM,
  formatPlates,
  exerciseProgress,
  describeProgressPoint,
  lastDeletion,
  searchHistory,
  historyTemplates,
  normalizeSearch,
  templateDurationEstimate,
  timeLeftEstimate,
  SET_WORK_SECONDS,
  weeklySetProgress,
  DEFAULT_SET_TARGETS,
  exerciseCues,
  cleanCues,
} from './logic';
import { BUILT_IN_CUES } from './cues';
import { SEED_EXERCISES } from './seed';
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
  describe('dobbelt progression med rep-interval (#259)', () => {
    const range = { repMin: 8, repMax: 12 };
    it('alle sæt nåede toppen → +2,5 kg og bunden af intervallet', () => {
      const h = progressionHint(logged('bench', [['60', '12'], ['60', '12'], ['60', '12']]), 'bench', range);
      expect(h).toMatchObject({ next: { weight: 62.5, reps: 8 }, increase: true, range: { min: 8, max: 12, topReached: true } });
      expect(progressionHint(logged('curl', [['12', '12']]), 'curl', range)!.next).toEqual({ weight: 13, reps: 8 });
    });
    it('toppen ikke nået → samme vægt og én rep mere end laveste sæt, aldrig over toppen', () => {
      const h = progressionHint(logged('bench', [['60', '12'], ['60', '10'], ['60', '9']]), 'bench', range);
      expect(h).toMatchObject({ next: { weight: 60, reps: 10 }, increase: true, range: { topReached: false } });
      expect(progressionHint(logged('bench', [['60', '11'], ['60', '12']]), 'bench', range)!.next).toEqual({ weight: 60, reps: 12 });
      // Under bunden: mindst bunden af intervallet
      expect(progressionHint(logged('bench', [['60', '5']]), 'bench', range)!.next).toEqual({ weight: 60, reps: 8 });
    });
    it('uden (gyldigt) interval → det gamle forslag', () => {
      const s = logged('bench', [['60', '12'], ['60', '12']]);
      expect(progressionHint(s, 'bench', {})).toEqual(progressionHint(s, 'bench'));
      expect(progressionHint(s, 'bench', { repMin: 12, repMax: 8 })!.range).toBeUndefined();
      expect(progressionHint(s, 'bench')!.next).toEqual({ weight: 62.5, reps: 12 });
    });
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
    expect(lines[0]).toBe('Dato,Træning,Øvelse,Sæt,Vægt (kg),Reps,RPE,Sek.,Meter,Belastning (kg),Mærke');
    expect(lines.find((l) => l.includes('Bænkpres'))).toMatch(/,Bænkpres,1,80,5,,,,,$/);
    expect(lines.find((l) => l.includes('Planke'))).toMatch(/,Planke,1,,,,45,,,$/);
    expect(lines.find((l) => l.includes('Romaskine'))).toMatch(/,Romaskine,1,,,,125,500\.5,,$/);
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
    expect(toCsv(s).split('\n')[1]).toMatch(/,Gammel,Squat,1,100,5,8,,,,$/);
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
      goals: [{ goalId: 'g1', exerciseId: 'bench', name: 'Bænkpres', weight: 100, reps: 1 }],
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
    expect(card.records).toEqual(['🎯 Mål nået: Bænkpres 100 kg × 1', '🏆 Bænkpres – tungeste vægt, estimeret 1RM']);
    expect(card.fileName).toBe('loeft-2026-11-15.png');
  });

  it('uden sammenligning og rekorder er de linjer tomme', () => {
    const base = {
      workoutId: 'w1', name: 'Tom træning', startedAt: T0, durationMs: 0, volume: 0, sets: 1,
      records: [], recordCount: 0, volumeChangePct: null, previousVolume: null, goals: [],
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
    expect(r.rows.map((x) => vsRowCells(x))).toEqual([
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

describe('milepæle (#182)', () => {
  const DAY = 24 * 3_600_000;
  const set = (weight: string, reps: string, extra: Partial<SetEntry> = {}): SetEntry => ({
    id: Math.random().toString(36).slice(2), weight, reps, rpe: '', done: true, ...extra,
  });
  const wk = (id: string, startedAt: number, sets: SetEntry[]): Workout => ({
    id, name: 'Træning', startedAt, finishedAt: startedAt + 3_600_000, exercises: [{ id: `we-${id}`, exerciseId: 'bench', sets }],
  });
  const get = (ms: ReturnType<typeof milestones>, id: string) => ms.find((m) => m.id === id)!;

  it('10 afsluttede træninger låser "10 træninger" op med datoen for den 10.; 25 viser 10 / 25', () => {
    const history = Array.from({ length: 10 }, (_, i) => wk(`w${i}`, T0 - (20 - i) * DAY, [set('10', '5')]));
    const s: AppState = { ...initialState(), history: [...history].reverse() };
    const ms = milestones(s);
    expect(get(ms, 'workouts-1')).toMatchObject({ unlockedBy: 'w0', label: 'Første træning' });
    expect(get(ms, 'workouts-10')).toMatchObject({ unlockedBy: 'w9', unlockedAt: history[9].startedAt });
    const m25 = get(ms, 'workouts-25');
    expect(m25).toMatchObject({ unlockedAt: null, current: 10, target: 25 });
    expect(milestoneProgressText(m25)).toBe('10 / 25 træninger');
  });

  it('samlet volumen over 1000 kg låser "1 ton" op; opvarmning tæller ikke', () => {
    const a = wk('a', T0 - 2 * DAY, [set('100', '5'), set('100', '4'), set('200', '10', { warmup: true })]); // 900 kg
    const b = wk('b', T0 - DAY, [set('50', '1'), set('40', '10', { done: false })]); // 950 kg
    const c = wk('c', T0, [set('50', '1')]); // 1000 kg
    const ms2 = milestones({ ...initialState(), history: [a, b] });
    expect(get(ms2, 'volume-1t').unlockedAt).toBeNull();
    expect(milestoneProgressText(get(ms2, 'volume-1t'))).toBe('0,9 / 1 t');
    const ms3 = milestones({ ...initialState(), history: [c, a, b] });
    expect(get(ms3, 'volume-1t').unlockedBy).toBe('c');
    expect(milestonesUnlockedBy({ ...initialState(), history: [c, a, b] }, 'c').map((m) => m.id)).toEqual(['volume-1t']);
  });

  it('kropsvægt-milepælen kræver en kropsmåling; 100 kg i ét løft', () => {
    const history = [wk('a', T0, [set('80', '3'), set('100', '0')])];
    const none = milestones({ ...initialState(), history, bodyLog: [] });
    expect(get(none, 'lift-bodyweight')).toMatchObject({ unlockedAt: null, target: null });
    expect(milestoneProgressText(get(none, 'lift-bodyweight'))).toBe('Kræver en kropsvægt');
    expect(get(none, 'lift-100').unlockedAt).toBeNull(); // 0 reps tæller ikke
    const withBw = milestones({ ...initialState(), history, bodyLog: [{ id: 'm', date: T0 - DAY, weight: 78 }] });
    expect(get(withBw, 'lift-bodyweight').unlockedBy).toBe('a');
    const heavier = milestones({ ...initialState(), history, bodyLog: [{ id: 'm', date: T0 - DAY, weight: 85 }] });
    expect(get(heavier, 'lift-bodyweight')).toMatchObject({ unlockedAt: null, current: 80, target: 85 });
    expect(bodyWeightAt([{ id: 'x', date: T0 + DAY, weight: 90 }, { id: 'y', date: T0 - DAY, weight: 80 }], T0)).toBe(80);
    expect(bodyWeightAt([{ id: 'x', date: T0 + DAY, weight: 90 }], T0)).toBe(90);
  });

  it('"uger i træk" bruger ugemålet; 4 uger låses op af træningen der fuldender 4. uge', () => {
    const WEEK = 7 * DAY;
    const MON = T0 - 6 * DAY; // T0 er en søndag
    const history = [0, 1, 2, 3].flatMap((i) => [wk(`a${i}`, MON + i * WEEK, [set('20', '5')]), wk(`b${i}`, MON + i * WEEK + DAY, [set('20', '5')])]);
    const s: AppState = { ...initialState(), weeklyGoal: 2, history };
    expect(get(milestones(s), 'streak-4').unlockedBy).toBe('b3');
    const gap = { ...s, history: history.filter((w) => w.id !== 'b1') };
    expect(get(milestones(gap), 'streak-4')).toMatchObject({ unlockedAt: null, current: 2 });
  });

  it('"låst op af denne træning" giver kun milepæle krydset i netop den træning; gamle data indlæses uændret', () => {
    const history = Array.from({ length: 10 }, (_, i) => wk(`w${i}`, T0 - (20 - i) * DAY, [set('10', '5')]));
    const s: AppState = { ...initialState(), history };
    expect(milestonesUnlockedBy(s, 'w9').map((m) => m.id)).toEqual(['workouts-10']);
    expect(milestonesUnlockedBy(s, 'w0').map((m) => m.id)).toEqual(['workouts-1']);
    expect(milestonesUnlockedBy(s, 'w5')).toEqual([]);
    expect(milestones(loadState(JSON.stringify(s))).map((m) => m.unlockedBy)).toEqual(milestones(s).map((m) => m.unlockedBy));
  });
});

describe('milestoneTileLabel (#183)', () => {
  it('låst viser fremskridt, låst op viser datoen', () => {
    const w = { id: 'a', name: 'X', startedAt: new Date(2026, 10, 20, 10).getTime(), finishedAt: new Date(2026, 10, 20, 11).getTime(), exercises: [] };
    const ms = milestones({ ...initialState(), history: [w] });
    const first = ms.find((m) => m.id === 'workouts-1')!;
    const ten = ms.find((m) => m.id === 'workouts-10')!;
    expect(milestoneTileLabel(ten)).toBe('10 træninger – låst, 1 af 10 træninger');
    expect(milestoneTileLabel(first)).toMatch(/^Første træning – låst op 20\. nov\.? 2026$/);
    const bw = ms.find((m) => m.id === 'lift-bodyweight')!;
    expect(milestoneTileLabel(bw)).toBe('Løftet din kropsvægt – låst, kræver en kropsvægt');
  });
});

describe('milestonesUnlockedBy (#184)', () => {
  it('kun den træning, der krydser grænsen, fejrer milepælen', () => {
    const mk = (id: string, t: number) => ({ id, name: 'X', startedAt: t, finishedAt: t + 1, exercises: [] });
    const st = { ...initialState(), history: [mk('b', 2000), mk('a', 1000)] };
    expect(milestonesUnlockedBy(st, 'a').map((m) => m.id)).toEqual(['workouts-1']);
    expect(milestonesUnlockedBy(st, 'b')).toEqual([]);
  });
});

describe('favoritøvelser og senest brugt (#190)', () => {
  const we = (exerciseId: string) => ({ id: uid(), exerciseId, sets: [] });
  const mk = (id: string, t: number, ids: string[], finished = true): Workout => ({
    id,
    name: 'X',
    startedAt: t,
    finishedAt: finished ? t + 1 : undefined,
    exercises: ids.map(we),
  });

  it('stjerne to gange tilføjer og fjerner favoritten', () => {
    const one = reducer(initialState(), { type: 'TOGGLE_FAVORITE', exerciseId: 'squat' });
    expect(one.favorites).toEqual(['squat']);
    expect(reducer(one, { type: 'TOGGLE_FAVORITE', exerciseId: 'squat' }).favorites).toEqual([]);
    expect(reducer(initialState(), { type: 'TOGGLE_FAVORITE', exerciseId: 'findes-ikke' }).favorites).toEqual([]);
  });

  it('favoritter tæller som en indstilling (tidsstempel til synk)', () => {
    const next = trackedReducer(initialState(), { type: 'TOGGLE_FAVORITE', exerciseId: 'bench', at: 500 });
    expect(next.settingsAt).toBe(500);
  });

  it('recentExercises giver forskellige øvelser, nyeste først, uden den igangværende træning', () => {
    const st: AppState = {
      ...initialState(),
      history: [mk('new', 3000, ['bench', 'squat']), mk('old', 1000, ['deadlift', 'bench', 'row'])],
      active: mk('act', 5000, ['pullup'], false),
    };
    expect(recentExercises(st)).toEqual(['bench', 'squat', 'deadlift', 'row']);
    expect(recentExercises(st, 2)).toEqual(['bench', 'squat']);
    expect(recentExercises(initialState())).toEqual([]);
  });

  it('pickerGroups viser favoritter og senest brugte uden dubletter (#192)', () => {
    const st: AppState = {
      ...initialState(),
      favorites: ['squat', 'slettet'],
      history: [mk('new', 3000, ['bench', 'squat']), mk('old', 1000, ['deadlift', 'row'])],
    };
    expect(pickerGroups(st)).toEqual({ favorites: ['squat'], recent: ['bench', 'deadlift', 'row'] });
    expect(pickerGroups(st, 1).recent).toEqual(['bench']);
    expect(pickerGroups(initialState())).toEqual({ favorites: [], recent: [] });
  });

  it('gamle data uden favoritter indlæses, og en backup gendanner dem', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.favorites;
    expect(loadState(JSON.stringify(old)).favorites).toEqual([]);
    const backup = { ...initialState(), favorites: ['squat', 'bench', 'slettet-øvelse'] };
    expect(loadState(JSON.stringify(backup)).favorites).toEqual(['squat', 'bench']);
  });

  it('fletning beholder favoritterne og fjerner slettede øvelser', () => {
    const phone = { ...initialState(), favorites: ['squat', 'mine'], settingsAt: 200, deleted: { mine: 150 } };
    const pc = { ...initialState(), settingsAt: 100 };
    expect(mergeStates(pc, phone).favorites).toEqual(['squat']);
    expect(mergeStates(phone, pc).favorites).toEqual(['squat']);
    const oldRemote = JSON.parse(JSON.stringify(initialState()));
    delete oldRemote.favorites;
    expect(mergeStates({ ...initialState(), favorites: ['bench'] }, { ...oldRemote, settingsAt: 999 }).favorites).toEqual(['bench']);
  });
});

describe('løftemål (#197)', () => {
  const D = 1_700_000_000_000;
  const addGoal = (s: AppState, id: string, weight: number, reps: number) =>
    trackedReducer(s, { type: 'ADD_GOAL', id, exerciseId: 'bench', weight, reps, now: D, at: D });
  const lift = (s: AppState, weight: string, reps: string, now: number) => {
    s = reducer(s, { type: 'START_WORKOUT', now });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight, reps } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now });
    return reducer(s, { type: 'FINISH_WORKOUT', now: now + 60_000 });
  };

  it('tilføjer og sletter et mål – det slettede mål får en gravsten', () => {
    let s = addGoal(initialState(), 'g1', 100, 1);
    expect(s.goals).toHaveLength(1);
    expect(s.goals[0]).toMatchObject({ exerciseId: 'bench', weight: 100, reps: 1, createdAt: D });
    expect(addGoal(s, 'bad', 0, 1).goals).toHaveLength(1); // ugyldig vægt
    expect(trackedReducer(s, { type: 'ADD_GOAL', id: 'x', exerciseId: 'findes-ikke', weight: 50, reps: 1, now: D }).goals).toHaveLength(1);
    s = trackedReducer(s, { type: 'DELETE_GOAL', goalId: 'g1', at: D + 5 });
    expect(s.goals).toEqual([]);
    expect(s.deleted.g1).toBe(D + 5);
  });

  it('fremskridt ud fra den bedste e1RM, højst 100 %', () => {
    let s = addGoal(initialState(), 'g1', 100, 1);
    expect(goalProgress(s, 'g1')).toEqual({ current: 0, target: 100, pct: 0 });
    s = lift(s, '80', '1', D + 1000);
    expect(goalProgress(s, 'g1')).toEqual({ current: 80, target: 100, pct: 80 });
    s = addGoal(s, 'g2', 60, 1);
    expect(goalProgress(s, 'g2')!.pct).toBe(100);
    expect(goalProgress(s, 'ukendt')).toBeNull();
  });

  it('100 kg × 1 når målet med datoen, 97,5 kg × 1 gør ikke', () => {
    let s = addGoal(initialState(), 'g1', 100, 1);
    s = lift(s, '97.5', '1', D + 1000);
    expect(s.goals[0].achievedAt).toBeUndefined();
    s = lift(s, '100', '1', D + 9000);
    expect(s.goals[0].achievedAt).toBe(D + 9000 + 60_000);
    expect(goalProgress(s, 'g1')!.pct).toBe(100);
  });

  it('mål flettes mellem enheder, og et slettet mål forbliver slettet', () => {
    const phone = addGoal(addGoal(initialState(), 'g1', 100, 1), 'g2', 140, 5);
    const pc = addGoal(initialState(), 'g3', 60, 10);
    const merged = mergeStates(pc, phone);
    expect(merged.goals.map((g) => g.id).sort()).toEqual(['g1', 'g2', 'g3']);
    const phoneDel = trackedReducer(phone, { type: 'DELETE_GOAL', goalId: 'g2', at: D + 10 });
    expect(mergeStates(merged, phoneDel).goals.map((g) => g.id).sort()).toEqual(['g1', 'g3']);
    // et nået mål vinder over den gamle udgave
    const reached = { ...phone, goals: phone.goals.map((g) => (g.id === 'g1' ? { ...g, achievedAt: D + 50, updatedAt: D + 50 } : g)) };
    expect(mergeStates(merged, reached).goals.find((g) => g.id === 'g1')!.achievedAt).toBe(D + 50);
  });

  it('gamle data uden mål indlæses uændret, og en backup gendanner målene', () => {
    const old = JSON.parse(JSON.stringify({ ...initialState(), history: [] }));
    delete old.goals;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.goals).toEqual([]);
    expect(loaded.templates).toEqual(old.templates);
    const backup = addGoal(initialState(), 'g1', 100, 1);
    expect(loadState(JSON.stringify(backup)).goals).toEqual(backup.goals);
  });
});

describe('løftemål: i dette tempo (#198)', () => {
  const DAY = 86_400_000;
  const NOW = new Date(2026, 2, 1, 12).getTime(); // 1. marts 2026
  const workout = (daysAgo: number, weight: number): Workout => ({
    id: `w${daysAgo}`,
    name: 'Bryst',
    startedAt: NOW - daysAgo * DAY,
    finishedAt: NOW - daysAgo * DAY + 3_600_000,
    exercises: [{ id: `we${daysAgo}`, exerciseId: 'bench', sets: [{ id: `s${daysAgo}`, weight: String(weight), reps: '1', rpe: '', done: true }] }],
  });
  const withGoal = (history: Workout[], targetDate?: number): AppState => ({
    ...initialState(),
    history,
    goals: [{ id: 'g1', exerciseId: 'bench', weight: 100, reps: 1, createdAt: NOW - 60 * DAY, ...(targetDate ? { targetDate } : {}) }],
  });
  // +2,5 kg om ugen: 80 → 90 kg over de sidste 4 uger
  const steady = [28, 21, 14, 7, 0].map((d, i) => workout(d, 80 + i * 2.5));

  it('en jævn stigning på 2,5 kg om ugen giver den forventede måned', () => {
    const eta = goalEta(withGoal(steady), 'g1', NOW)!;
    // 10 kg mangler à 2,5 kg/uge = 4 uger → slutningen af marts
    expect(Math.round((eta - NOW) / DAY)).toBe(28);
    expect(etaText(eta, NOW)).toBe('ca. marts');
  });

  it('flad eller faldende trend og under 3 træninger giver null', () => {
    expect(goalEta(withGoal([28, 14, 0].map((d) => workout(d, 90))), 'g1', NOW)).toBeNull();
    expect(goalEta(withGoal([28, 14, 0].map((d, i) => workout(d, 90 - i * 2.5))), 'g1', NOW)).toBeNull();
    expect(goalEta(withGoal(steady.slice(3)), 'g1', NOW)).toBeNull();
    // gamle træninger (over 8 uger) tæller ikke
    expect(goalEta(withGoal([90, 80, 0].map((d, i) => workout(d, 80 + i * 5))), 'g1', NOW)).toBeNull();
    // over et år væk
    expect(goalEta(withGoal([28, 14, 0].map((d, i) => workout(d, 50 + i * 0.1))), 'g1', NOW)).toBeNull();
  });

  it('etaText: samme år, næste år og inden for en uge', () => {
    expect(etaText(new Date(2026, 4, 10).getTime(), NOW)).toBe('ca. maj');
    expect(etaText(new Date(2027, 2, 10).getTime(), NOW)).toBe('ca. marts 2027');
    expect(etaText(NOW + 3 * DAY, NOW)).toBe('inden for en uge');
  });

  it('goalOnTrack er sand/falsk omkring måldatoen', () => {
    expect(goalOnTrack(withGoal(steady, NOW + 35 * DAY), 'g1', NOW)).toBe(true);
    expect(goalOnTrack(withGoal(steady, NOW + 20 * DAY), 'g1', NOW)).toBe(false);
    expect(goalOnTrack(withGoal(steady), 'g1', NOW)).toBeNull();
  });
});

describe('mål i Profil (#200)', () => {
  const D = 1_700_000_000_000;
  const add = (s: AppState, id: string, exerciseId: string, weight: number, now = D) =>
    trackedReducer(s, { type: 'ADD_GOAL', id, exerciseId, weight, reps: 1, now, at: now });
  const lift = (s: AppState, exerciseId: string, weight: string, now: number) => {
    s = reducer(s, { type: 'START_WORKOUT', now });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight, reps: '1' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now });
    return reducer(s, { type: 'FINISH_WORKOUT', now: now + 60_000 });
  };

  it('tom uden mål', () => {
    expect(goalsOverview(initialState())).toEqual({ open: [], reached: [] });
  });

  it('åbne mål sorteres efter fremskridt, nåede mål nyeste først', () => {
    let s = add(initialState(), 'b', 'bench', 100);
    s = add(s, 'q', 'squat', 100);
    s = add(s, 'r1', 'bench', 50);
    s = lift(s, 'bench', '50', D + 1000);
    s = add(s, 'r2', 'squat', 40, D + 2000);
    s = lift(s, 'squat', '90', D + 5000);
    const o = goalsOverview(s);
    expect(o.open.map((x) => [x.goal.id, x.pct])).toEqual([
      ['q', 90],
      ['b', 50],
    ]);
    expect(o.reached.map((g) => g.id)).toEqual(['r2', 'r1']);
  });
});

describe('nåede mål i opsummeringen (#201)', () => {
  const D = 1_700_000_000_000;
  const lift = (s: AppState, weight: string, now: number) => {
    s = reducer(s, { type: 'START_WORKOUT', now });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight, reps: '1' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now });
    return reducer(s, { type: 'FINISH_WORKOUT', now: now + 60_000 });
  };

  it('lister mål nået i træningen – og kun i den', () => {
    let s = trackedReducer(initialState(), { type: 'ADD_GOAL', id: 'g1', exerciseId: 'bench', weight: 100, reps: 1, now: D, at: D });
    s = lift(s, '90', D + 1000);
    const miss = s.history[s.history.length - 1].id;
    expect(workoutSummary(s, miss)!.goals).toEqual([]);
    s = lift(s, '100', D + 9000);
    const hit = s.history.find((w) => w.id !== miss)!.id;
    expect(workoutSummary(s, hit)!.goals).toEqual([{ goalId: 'g1', exerciseId: 'bench', name: 'Bænkpres', weight: 100, reps: 1 }]);
    s = lift(s, '105', D + 20000);
    const later = s.history.find((w) => w.id !== miss && w.id !== hit)!.id;
    expect(workoutSummary(s, later)!.goals).toEqual([]);
  });
});

describe('kropsvægt til kropsvægtsøvelser (#206)', () => {
  const DAY = 86_400_000;
  const T = Date.UTC(2026, 5, 15);
  const log = [
    { id: 'b', date: T + 10 * DAY, weight: 82 },
    { id: 'a', date: T, weight: 80 },
    { id: 'c', date: T + 5 * DAY, bodyFat: 15 },
  ];

  it('finder øvelser med udstyret Kropsvægt – også egne', () => {
    const s = initialState();
    const pullup = s.exercises.find((e) => e.equipment === 'Kropsvægt')!;
    const bar = s.exercises.find((e) => e.equipment === 'Stang')!;
    expect(isBodyweight(s, pullup.id)).toBe(true);
    expect(isBodyweight(s, bar.id)).toBe(false);
    expect(isBodyweight(s, 'findes-ikke')).toBe(false);
    const own = reducer(s, { type: 'ADD_CUSTOM_EXERCISE', id: 'ring', name: 'Ringrows', muscle: 'Ryg', equipment: 'Kropsvægt' });
    expect(isBodyweight(own, 'ring')).toBe(true);
  });

  it('bruger det seneste kropsmål før datoen, ellers det første efter, ellers indstillingen', () => {
    const s = { ...initialState(), bodyLog: log, bodyWeight: 75 };
    expect(bodyWeightOn(s, T - DAY)).toBe(80); // før alle målinger: den første måling
    expect(bodyWeightOn(s, T)).toBe(80);
    expect(bodyWeightOn(s, T + 7 * DAY)).toBe(80); // mellem målinger (målingen uden vægt tæller ikke)
    expect(bodyWeightOn(s, T + 20 * DAY)).toBe(82);
    expect(bodyWeightOn({ ...s, bodyLog: [] }, T)).toBe(75);
    expect(bodyWeightOn({ ...s, bodyLog: [{ id: 'x', date: T, waist: 80 }] }, T)).toBe(75);
    expect(bodyWeightOn({ ...s, bodyLog: [], bodyWeight: null }, T)).toBeNull();
  });

  it('SET_BODY_WEIGHT gemmer kg, og tom/0 betyder ikke angivet', () => {
    const s = initialState();
    expect(s.bodyWeight).toBeNull();
    const set = reducer(s, { type: 'SET_BODY_WEIGHT', kg: 81.25 });
    expect(set.bodyWeight).toBe(81.25); // gemmes præcist, så lb-værdier bevares (#347)
    expect(reducer(set, { type: 'SET_BODY_WEIGHT', kg: 0 }).bodyWeight).toBeNull();
    expect(reducer(set, { type: 'SET_BODY_WEIGHT', kg: NaN }).bodyWeight).toBeNull();
    expect(reducer(set, { type: 'SET_BODY_WEIGHT', kg: -5 }).bodyWeight).toBeNull();
  });

  it('gamle data uden kropsvægt indlæses, og indstillingen flettes efter settingsAt', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.bodyWeight;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.bodyWeight).toBeNull();
    expect(bodyWeightOn(loaded, T)).toBeNull();
    expect(loadState(JSON.stringify({ ...old, bodyWeight: 78 })).bodyWeight).toBe(78);

    const prev = { ...initialState(), settingsAt: 100 };
    const phone = stampChanges(prev, reducer(prev, { type: 'SET_BODY_WEIGHT', kg: 80 }), 500);
    expect(phone.settingsAt).toBe(500);
    expect(mergeStates(prev, phone).bodyWeight).toBe(80);
    expect(mergeStates(phone, prev).bodyWeight).toBe(80);
    // At rydde feltet på en nyere enhed rydder det også de andre steder
    const cleared = stampChanges(phone, reducer(phone, { type: 'SET_BODY_WEIGHT', kg: 0 }), 900);
    expect(mergeStates(phone, cleared).bodyWeight).toBeNull();
    // Data fra serveren fra før #206 (uden feltet) rører ikke den lokale værdi
    const oldRemote = JSON.parse(JSON.stringify({ ...initialState(), settingsAt: 1000 }));
    delete oldRemote.bodyWeight;
    expect(mergeStates(phone, oldRemote).bodyWeight).toBe(80);
  });
});

describe('kropsvægt i volumen, rekorder og statistik (#207)', () => {
  const DAY = 86_400_000;
  const T = Date.UTC(2026, 5, 15, 10);
  let n = 0;
  const set = (weight: string, reps: string): SetEntry => ({ id: `s${++n}`, weight, reps, rpe: '', done: true });
  const wo = (id: string, at: number, exerciseId: string, sets: SetEntry[]): Workout => ({
    id, name: 'Træning', startedAt: at, finishedAt: at + 3_600_000, exercises: [{ id: `we-${id}`, exerciseId, sets }],
  });
  const base = (history: Workout[], extra: Partial<AppState> = {}): AppState => ({ ...initialState(), history, ...extra });

  it('10 pull-ups med 80 kg kropsvægt: 800 kg, +10 giver 900, −20 giver 600, ukendt kropsvægt 0', () => {
    const w = wo('a', T, 'pullup', [set('', '10')]);
    const s = base([w], { bodyWeight: 80 });
    expect(setLoad(s, w, 'pullup', w.exercises[0].sets[0])).toBe(80);
    expect(workoutVolume(withLoads(s, w))).toBe(800);
    expect(workoutVolume(withLoads(s, wo('b', T, 'pullup', [set('10', '10')])))).toBe(900);
    expect(workoutVolume(withLoads(s, wo('c', T, 'pullup', [set('-20', '10')])))).toBe(600);
    expect(workoutVolume(withLoads(base([w]), w))).toBe(0);
    expect(workoutVolume(withLoads(base([]), wo('d', T, 'pullup', [set('-20', '10')])))).toBe(0); // aldrig under 0
    expect(workoutVolume(withLoads(base([]), wo('e', T, 'pullup', [set('10', '10')])))).toBe(100); // kun ekstra vægt
    // Tallene i opsummering, ugevolumen og muskelfordeling følger med
    expect(workoutSummary(s, 'a')!.volume).toBe(800);
    expect(weeklyVolume(s, 1, T).at(-1)!.volume).toBe(800);
    expect(muscleDistribution(s, 0).find((m) => m.muscle === 'Ryg')!.volume).toBe(800);
    expect(exerciseHistory(s.history, 'pullup', s)[0]).toMatchObject({ volume: 800, best1RM: estimate1RM(80, 10) });
    expect(exerciseHistory(s.history, 'pullup', s)[0].sets[0].weight).toBe(''); // sættene vises som logget
    // Gemte data ændres ikke
    expect(s.history[0].exercises[0].sets[0].weight).toBe('');
  });

  it('et pull-up-sæt med ekstra vægt kan slå et uden som rekord', () => {
    const first = wo('a', T, 'pullup', [set('', '8')]);
    const second = wo('b', T + DAY, 'pullup', [set('10', '8')]);
    const s = base([second, first], { bodyWeight: 80 });
    expect(workoutRecords(s, 'b').pullup).toEqual(expect.arrayContaining(['heaviest', '1rm']));
    expect(personalRecords(s, 'pullup').heaviest).toMatchObject({ weight: 90, reps: 8 });
    expect(recordsWall(s).find((r) => r.exerciseId === 'pullup')!.best1RM!.weight).toBe(90);
    // Under træningen: +10 slår det bedste uden ekstra vægt
    const active = { ...wo('c', T + 2 * DAY, 'pullup', [set('12.5', '8')]), finishedAt: undefined };
    const live = { ...base([first], { bodyWeight: 80 }), active };
    expect(recordsBrokenBy(live, 'pullup', active.exercises[0].sets[0])).toEqual(expect.arrayContaining(['heaviest', '1rm']));
  });

  it('øvelser uden kropsvægt giver præcis de samme tal som før', () => {
    const w = wo('a', T, 'squat', [set('100', '5'), set('110', '3')]);
    const s = base([w], { bodyWeight: 80 });
    expect(withLoads(s, w)).toBe(w);
    expect(loadedState(s)).toBe(s);
    expect(workoutSummary(s, 'a')!.volume).toBe(830);
    expect(personalRecords(s, 'squat').heaviest!.weight).toBe(110);
  });

  it('et kropsmål logget senere ændrer ikke en ældre træning, når der findes et ældre mål', () => {
    const w = wo('a', T, 'dips', [set('', '10')]);
    const s = base([w], { bodyLog: [{ id: 'm1', date: T - 10 * DAY, weight: 80 }] });
    expect(workoutSummary(s, 'a')!.volume).toBe(800);
    const later = { ...s, bodyLog: [{ id: 'm2', date: T + 10 * DAY, weight: 90 }, ...s.bodyLog] };
    expect(workoutSummary(later, 'a')!.volume).toBe(800);
    // Kun det senere mål: det bruges (den første måling efter datoen)
    expect(workoutSummary({ ...s, bodyLog: [{ id: 'm2', date: T + 10 * DAY, weight: 90 }] }, 'a')!.volume).toBe(900);
  });

  it('kropsvægten lægges aldrig til to gange og tæller med i volumenmilepæle', () => {
    const w = wo('a', T, 'pullup', [set('', '10')]);
    const s = base([w], { bodyWeight: 80 });
    const once = withLoads(s, w);
    expect(withLoads(s, once)).toBe(once);
    expect(workoutVolume(withLoads(s, once))).toBe(800);
    expect(monthRecap(s, 2026, 5).volume).toBe(800);
    expect(milestones(s).find((m) => m.id === 'volume-1t')!.current).toBe(800);
  });
});

describe('kropsvægtsøvelser som tekst (#208)', () => {
  const base: SetEntry = { id: 'x', weight: '', reps: '10', rpe: '', done: true };
  it('bodyweightText: KV, KV +10 og KV −20', () => {
    expect(bodyweightText('')).toBe('KV');
    expect(bodyweightText('0')).toBe('KV');
    expect(bodyweightText('10')).toBe('KV +10');
    expect(bodyweightText('+2,5')).toBe('KV +2,5');
    expect(bodyweightText('-20')).toBe('KV −20');
  });
  it('formatSet med kropsvægt', () => {
    expect(formatSet(base, true)).toBe('KV × 10');
    expect(formatSet({ ...base, weight: '10', reps: '8' }, true)).toBe('KV +10 × 8');
    expect(formatSet({ ...base, weight: '-20', reps: '6' }, true)).toBe('KV −20 × 6');
    // Normale øvelser som før
    expect(formatSet({ ...base, weight: '10', reps: '8' })).toBe('10 kg × 8');
    expect(formatSet(base)).toBe('10 reps');
  });
  it('isBodyweightReps: pull-up ja, planke (tid) og bænkpres nej', () => {
    const s = initialState();
    expect(isBodyweightReps(s, 'pullup')).toBe(true);
    expect(isBodyweightReps(s, 'plank')).toBe(false);
    expect(isBodyweightReps(s, s.exercises.find((e) => e.equipment === 'Stang')!.id)).toBe(false);
  });
});

describe('kropsvægtsøvelser: progression, egne øvelser og eksport (#209)', () => {
  const T = Date.UTC(2026, 0, 5, 10);
  function logged(exerciseId: string, sets: [string, string][], extra: Partial<AppState> = {}): AppState {
    let s: AppState = { ...initialState(), ...extra };
    s = reducer(s, { type: 'START_WORKOUT', now: T });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const weId = s.active!.exercises[0].id;
    sets.forEach(([weight, reps], i) => {
      if (i > 0) s = reducer(s, { type: 'ADD_SET', weId });
      const set = s.active!.exercises[0].sets[i];
      s = reducer(s, { type: 'UPDATE_SET', weId, setId: set.id, patch: { weight, reps } });
      s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: T });
    });
    return reducer(s, { type: 'FINISH_WORKOUT', now: T + 60_000 });
  }

  it('uden ekstra vægt: +1 rep, indtil alle sæt har 12+ – så +2,5 kg', () => {
    expect(BODYWEIGHT_REPS_TARGET).toBe(12);
    const a = progressionHint(logged('pullup', [['', '10'], ['', '10']]), 'pullup')!;
    expect(a).toMatchObject({ next: { weight: 0, reps: 11 }, increase: true, bodyweight: true });
    const b = progressionHint(logged('pullup', [['', '12'], ['', '12'], ['', '12']]), 'pullup')!;
    expect(b).toMatchObject({ next: { weight: 2.5, reps: 12 }, increase: true, bodyweight: true });
    // Ikke alle sæt nåede målet: samme igen
    const c = progressionHint(logged('pullup', [['', '12'], ['', '9']]), 'pullup')!;
    expect(c).toMatchObject({ next: { weight: 0, reps: 12 }, increase: false, bodyweight: true });
  });

  it('med vægtbælte: +1 rep, ved 12+ reps +2,5 kg ekstra', () => {
    expect(progressionHint(logged('pullup', [['10', '8'], ['10', '8']]), 'pullup')!.next).toEqual({ weight: 10, reps: 9 });
    expect(progressionHint(logged('dips', [['10', '12'], ['10', '13']]), 'dips')!.next).toEqual({ weight: 12.5, reps: 12 });
  });

  it('assisteret: +1 rep, ved 12+ reps 2,5 kg mindre assistance', () => {
    expect(progressionHint(logged('pullup', [['-20', '8']]), 'pullup')!.next).toEqual({ weight: -20, reps: 9 });
    expect(progressionHint(logged('pullup', [['-20', '12'], ['-20', '12']]), 'pullup')!.next).toEqual({ weight: -17.5, reps: 12 });
    expect(progressionHint(logged('pullup', [['-2,5', '12']]), 'pullup')!.next).toEqual({ weight: 0, reps: 12 });
  });

  it('APPLY_HINT udfylder negativ assistance', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['pullup'] });
    const weId = s.active!.exercises[0].id;
    s = reducer(s, { type: 'APPLY_HINT', weId, weight: -17.5, reps: 12 });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ weight: '-17,5', reps: '12' });
  });

  it('egne øvelser med udstyret "Kropsvægt" er kropsvægtsøvelser', () => {
    const id = 'ringrows';
    let s = reducer(initialState(), { type: 'ADD_CUSTOM_EXERCISE', id, name: 'Ringrows', muscle: 'Ryg', equipment: 'Kropsvægt' });
    expect(isBodyweightReps(s, id)).toBe(true);
    s = logged(id, [['5', '10']], { exercises: s.exercises, bodyWeight: 80 });
    expect(progressionHint(s, id)).toMatchObject({ bodyweight: true });
    expect(toCsv(s).split('\n')[1]).toMatch(/,Ringrows,1,5,10,,,,85,$/);
  });

  it('CSV: "Belastning (kg)" = kropsvægt + ekstra for kropsvægtssæt, tom for andre', () => {
    const s = logged('pullup', [['', '10'], ['10', '8'], ['-20', '6']], { bodyWeight: 80 });
    const lines = toCsv(s).split('\n');
    expect(lines[0].split(',').at(-2)).toBe('Belastning (kg)');
    expect(lines[1]).toMatch(/,Pull-up,1,,10,,,,80,$/);
    expect(lines[2]).toMatch(/,Pull-up,2,10,8,,,,90,$/);
    expect(lines[3]).toMatch(/,Pull-up,3,-20,6,,,,60,$/);
    const b = logged('bench', [['100', '5']], { bodyWeight: 80 });
    expect(toCsv(b).split('\n')[1]).toMatch(/,Bænkpres,1,100,5,,,,,$/);
  });

  it('backup med kropsvægtssæt gendannes uændret', () => {
    const s = logged('pullup', [['-20', '6']], { bodyWeight: 80 });
    const restored = reducer(initialState(), { type: 'IMPORT_STATE', state: loadState(JSON.stringify(s)) });
    expect(restored.history).toEqual(s.history);
    expect(restored.bodyWeight).toBe(80);
  });
});

describe('restitution pr. muskelgruppe (#286)', () => {
  const DAY = 86_400_000;
  const NOW = new Date('2026-11-20T18:00:00').getTime();
  const sets = (n: number, extra: Partial<SetEntry> = {}): SetEntry[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, weight: '60', reps: '8', rpe: '', done: true, ...extra }));
  const workout = (id: string, startedAt: number, ex: Record<string, SetEntry[]>, finished = true): Workout => ({
    id,
    name: id,
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : undefined,
    exercises: Object.entries(ex).map(([exerciseId, s], i) => ({ id: `${id}-${i}`, exerciseId, sets: s })),
  });
  const withHistory = (...history: Workout[]): AppState => ({ ...initialState(), history });
  const row = (s: AppState, m: string) => muscleRecovery(s, NOW).find((r) => r.muscle === m)!;

  it('6 sæt i går er hårdt, 3 sæt i går er for nylig, 4 dage siden er hvilet', () => {
    expect(row(withHistory(workout('a', NOW - DAY, { squat: sets(6) })), 'Ben').status).toBe('hard');
    expect(row(withHistory(workout('a', NOW - DAY, { squat: sets(3) })), 'Ben').status).toBe('recent');
    expect(row(withHistory(workout('a', NOW - 4 * DAY, { squat: sets(8) })), 'Ben').status).toBe('rested');
    // sæt fra to øvelser for samme muskel lægges sammen
    expect(row(withHistory(workout('a', NOW - DAY, { squat: sets(3), 'leg-press': sets(3) })), 'Ben').status).toBe('hard');
  });

  it('opvarmning og en igangværende træning tæller ikke', () => {
    const warm = workout('a', NOW - DAY, { squat: [...sets(3), ...sets(5, { warmup: true })] });
    expect(row(withHistory(warm), 'Ben').status).toBe('recent');
    expect(row(withHistory(warm), 'Ben').hardSets7d).toBe(3);
    const active = workout('b', NOW - 3_600_000, { bench: sets(8) }, false);
    const s = { ...withHistory(warm), active, history: [active, warm] };
    expect(row(s, 'Bryst')).toMatchObject({ status: 'rested', lastTrainedAt: null });
    // ikke-afkrydsede sæt tæller heller ikke
    expect(row(withHistory(workout('c', NOW - DAY, { bench: sets(8, { done: false }) })), 'Bryst').status).toBe('rested');
  });

  it('dage siden og sæt de sidste 7 dage passer omkring 7-dagesgrænsen', () => {
    const s = withHistory(
      workout('new', NOW - 2 * DAY, { bench: sets(4) }),
      workout('in', NOW - 7 * DAY + 60_000, { bench: sets(2) }),
      workout('out', NOW - 7 * DAY - 60_000, { bench: sets(5) }),
    );
    const r = row(s, 'Bryst');
    expect(r.hardSets7d).toBe(6);
    expect(r.daysSince).toBe(2);
    expect(r.lastWorkoutId).toBe('new');
    expect(r.lastTrainedAt).toBe(NOW - 2 * DAY);
    expect(row(withHistory(workout('t', NOW - 3_600_000, { bench: sets(1) })), 'Bryst').daysSince).toBe(0);
  });

  it('en muskel, der aldrig er trænet, er hvilet', () => {
    const rows = muscleRecovery(initialState(), NOW);
    expect(rows.map((r) => r.muscle)).toEqual(['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave']);
    for (const r of rows) expect(r).toMatchObject({ status: 'rested', lastTrainedAt: null, daysSince: null, hardSets7d: 0 });
  });

  it('templateReady: Ben er klar efter en brystdag, men ikke lige efter en hård bendag', () => {
    const chest = withHistory(workout('a', NOW - DAY, { bench: sets(6) }));
    expect(templateReady(chest, 'tpl-legs', NOW)).toBe(true);
    const legs = withHistory(workout('a', NOW - DAY, { squat: sets(6) }));
    expect(templateReady(legs, 'tpl-legs', NOW)).toBe(false);
    expect(templateReady(legs, 'tpl-push', NOW)).toBe(true);
    expect(templateReady(legs, 'findes-ikke', NOW)).toBe(false);
  });
});

describe('procenttabel (#250)', () => {
  /** Historik med ét udført sæt på 100 kg × 1 i bænkpres (e1RM = 100) */
  function withBench(weight: string, reps = '1', exerciseId = 'bench'): AppState {
    const w: Workout = {
      id: 'w1',
      name: 'Test',
      startedAt: T0,
      finishedAt: T0 + 3_600_000,
      exercises: [
        { id: 'we1', exerciseId, sets: [{ id: 's1', weight, reps, rpe: '', done: true }] },
      ],
    };
    return { ...initialState(), history: [w] };
  }
  const row = (s: AppState, pct: number, id = 'bench') => percentTable(s, id).find((r) => r.pct === pct)!;

  it('estimeret 1RM 100 kg med 20 kg-stang: 80 % = 80 kg og 85 % = 85 kg', () => {
    const s = withBench('100');
    expect(row(s, 80).weight).toBe(80);
    expect(row(s, 85).weight).toBe(85);
    expect(percentTable(s, 'bench').map((r) => r.pct)).toEqual([95, 90, 85, 80, 75, 70, 65, 60, 55, 50]);
  });

  it('runder til nærmeste vægt man kan lægge på', () => {
    // 1RM 101 kg: 95 % = 95,95 → 95 kg (2,5 kg-spring med 1,25-skiver)
    expect(row(withBench('101'), 95)).toEqual({ pct: 95, exact: 95.95, weight: 95 });
    expect(nearestLoadable(83.4)).toBe(82.5);
    expect(nearestLoadable(84)).toBe(85);
    expect(nearestLoadable(10)).toBe(20); // aldrig under stangen
    // Kun 20 kg-skiver: 85 kg → 100 eller 60? Nærmest er 100 (afstand 15) mod 60 (25)
    expect(nearestLoadable(85, 20, [20])).toBe(100);
    expect(nearestLoadable(70, 15, [10, 5])).toBe(65); // lige langt til 65 og 75 → den letteste
  });

  it('bruger en gemt testet 1RM i stedet for estimatet, og falder tilbage når den ryddes', () => {
    let s = withBench('100');
    s = reducer(s, { type: 'SET_TESTED_1RM', exerciseId: 'bench', weight: 120 });
    expect(tableOneRM(s, 'bench')).toEqual({ oneRM: 120, source: 'tested' });
    expect(row(s, 50).weight).toBe(60);
    s = reducer(s, { type: 'SET_TESTED_1RM', exerciseId: 'bench' });
    expect(s.exercises.find((e) => e.id === 'bench')!.testedOneRM).toBeUndefined();
    expect(tableOneRM(s, 'bench')).toEqual({ oneRM: 100, source: 'estimated' });
    expect(reducer(s, { type: 'SET_TESTED_1RM', exerciseId: 'bench', weight: -5 })).toBe(s);
  });

  it('testet 1RM gemmes og indlæses igen; gamle data uden feltet indlæses', () => {
    const s = reducer(withBench('100'), { type: 'SET_TESTED_1RM', exerciseId: 'bench', weight: 110 });
    expect(loadState(JSON.stringify(s)).exercises.find((e) => e.id === 'bench')!.testedOneRM).toBe(110);
    const old = loadState(JSON.stringify(withBench('100')));
    expect(old.exercises.find((e) => e.id === 'bench')!.testedOneRM).toBeUndefined();
    expect(row(old, 80).weight).toBe(80);
  });

  it('ingen historik og ingen testet 1RM → ingen rækker; tidsøvelser har ingen tabel', () => {
    expect(percentTable(initialState(), 'bench')).toEqual([]);
    const s = reducer(initialState(), { type: 'SET_TESTED_1RM', exerciseId: 'plank', weight: 100 });
    expect(percentTable(s, 'plank')).toEqual([]);
  });
});

describe('formatPlates (#251)', () => {
  it('viser skiverne pr. side som tekst', () => {
    expect(formatPlates(85)).toBe('25 + 5 + 2,5 pr. side');
    expect(formatPlates(82.5)).toBe('25 + 5 + 1,25 pr. side');
    expect(formatPlates(20)).toBe('Kun stangen');
    expect(formatPlates(10)).toBe('Under stangens vægt');
    expect(formatPlates(81, 20, [20, 10])).toBe('20 + 10 pr. side (mangler 1 kg)');
  });
});

describe('testet 1RM i backup og synk (#252)', () => {
  it('en testet 1RM sat på én enhed vinder ved fletning, og en backup beholder den', () => {
    const phone = initialState();
    const pc = stampChanges(phone, reducer(phone, { type: 'SET_TESTED_1RM', exerciseId: 'bench', weight: 120 }), 1000);
    const merged = mergeStates(phone, pc);
    expect(merged.exercises.find((e) => e.id === 'bench')!.testedOneRM).toBe(120);
    const cleared = stampChanges(pc, reducer(pc, { type: 'SET_TESTED_1RM', exerciseId: 'bench' }), 2000);
    expect(mergeStates(pc, cleared).exercises.find((e) => e.id === 'bench')!.testedOneRM).toBeUndefined();
    const restored = loadState(JSON.stringify(pc));
    expect(restored.exercises.find((e) => e.id === 'bench')!.testedOneRM).toBe(120);
  });
});

describe('styrkegraf (#213)', () => {
  const DAY = 86_400_000;
  let n = 0;
  const set = (weight: string, reps: string, extra: Partial<SetEntry> = {}): SetEntry => ({
    id: `s${n++}`, weight, reps, rpe: '', done: true, ...extra,
  });
  const wo = (id: string, daysAgo: number, exerciseId: string, sets: SetEntry[]): Workout => ({
    id, name: 'X', startedAt: T0 - daysAgo * DAY, finishedAt: T0 - daysAgo * DAY + 3_600_000,
    exercises: [{ id: `we-${id}`, exerciseId, sets }],
  });
  const withHistory = (history: Workout[]): AppState => ({ ...initialState(), history });

  // Historikken er nyeste først, som i appen
  const s = withHistory([
    wo('c', 2, 'bench', [set('100', '3'), set('60', '10', { warmup: true })]),
    wo('b', 10, 'bench', [set('80', '5'), set('85', '2'), set('140', '1', { done: false })]),
    wo('a', 400, 'bench', [set('20', '10', { warmup: true }), set('90', '5')]),
  ]);

  it('giver alle tre målinger pr. træning, ældste først, uden opvarmning', () => {
    const e = exerciseProgress(s, 'bench', '1rm', 'all', T0);
    expect(e.map((p) => p.workoutId)).toEqual(['a', 'b', 'c']);
    expect(e.map((p) => p.value)).toEqual([105, 93.3, 110]);
    expect(e[1].set).toEqual({ weight: 80, reps: 5 });
    const h = exerciseProgress(s, 'bench', 'heaviest', 'all', T0);
    expect(h.map((p) => p.value)).toEqual([90, 85, 100]);
    expect(h[1].set).toEqual({ weight: 85, reps: 2 });
    const v = exerciseProgress(s, 'bench', 'volume', 'all', T0);
    expect(v.map((p) => p.value)).toEqual([450, 570, 300]);
    expect(v[0].set).toBeUndefined();
  });

  it('interval filtrerer gamle træninger; rekord kun når alle tidligere slås', () => {
    expect(exerciseProgress(s, 'bench', '1rm', '3m', T0).map((p) => p.workoutId)).toEqual(['b', 'c']);
    expect(exerciseProgress(s, 'bench', '1rm', '1y', T0).map((p) => p.workoutId)).toEqual(['b', 'c']);
    expect(exerciseProgress(s, 'bench', '1rm', 'all', T0).map((p) => p.record)).toEqual([false, false, true]);
    // Rekorden måles mod hele historikken, også træninger uden for intervallet
    expect(exerciseProgress(s, 'bench', 'volume', '3m', T0).map((p) => p.record)).toEqual([true, false]);
    // Samme som 🏆 i træningen
    expect(workoutRecords(s, 'c').bench).toContain('1rm');
    expect(workoutRecords(s, 'b').bench ?? []).not.toContain('1rm');
    expect(exerciseProgress(withHistory([]), 'bench', '1rm', 'all', T0)).toEqual([]);
    expect(exerciseProgress(s, 'squat', '1rm', 'all', T0)).toEqual([]);
  });

  it('tidsøvelser giver længste hold; kropsvægt tæller med', () => {
    const t = withHistory([
      wo('y', 1, 'plank', [set('', '', { seconds: '75' }), set('', '', { seconds: '60' })]),
      wo('x', 5, 'plank', [set('', '', { seconds: '45' })]),
    ]);
    const p = exerciseProgress(t, 'plank', '1rm', 'all', T0);
    expect(p.map((x) => x.value)).toEqual([45, 75]);
    expect(p[1].set?.seconds).toBe(75);
    expect(p.map((x) => x.record)).toEqual([false, true]);
    const bw = { ...withHistory([wo('p', 1, 'pullup', [set('10', '5')])]), bodyWeight: 80 };
    expect(exerciseProgress(bw, 'pullup', 'heaviest', 'all', T0)[0].value).toBe(90);
  });

  it('gamle data indlæses uændret', () => {
    expect(loadState(JSON.stringify(s)).history).toEqual(s.history);
  });
});

describe('punkt-tekst i styrkegrafen (#215)', () => {
  const date = new Date(2026, 10, 12, 18).getTime();
  it('viser dato, sæt og est. 1RM, og markerer rekorder', () => {
    const p = { workoutId: 'w', date, value: 116.7, set: { weight: 100, reps: 5 }, record: true };
    expect(describeProgressPoint(p, 'reps', '1rm')).toBe('12. nov. · 100 kg × 5 · est. 1RM 116,7 kg · 🏆 rekord');
    expect(describeProgressPoint({ ...p, value: 100, record: false }, 'reps', 'heaviest')).toBe('12. nov. · 100 kg × 5');
    expect(describeProgressPoint({ workoutId: 'w', date, value: 1500, record: false }, 'reps', 'volume')).toBe('12. nov. · volumen 1.500 kg');
    expect(describeProgressPoint({ workoutId: 'w', date, value: 75, record: false }, 'time', '1rm')).toBe('12. nov. · 75 sek.');
    expect(describeProgressPoint({ workoutId: 'w', date, value: 402.5, record: false }, 'distance', '1rm')).toBe('12. nov. · 402,5 m');
  });
});

describe('fortryd sletning (#221)', () => {
  type A = Parameters<typeof reducer>[1];
  /** Kører en handling som appen gør (med gravsten) og fortryder den med det samme */
  const delThenUndo = (s: AppState, action: A) => {
    const after = trackedReducer(s, { ...action, at: T0 + 1000 });
    const d = lastDeletion(s, action, after);
    expect(d).not.toBeNull();
    const back = trackedReducer(after, { type: 'UNDO_DELETE', deletion: d!, at: T0 + 2000 });
    return { after, d: d!, back };
  };
  const strip = (s: AppState) => JSON.parse(JSON.stringify(s, (k, v) => (k === 'updatedAt' || k === 'settingsAt' ? undefined : v)));

  function workoutState(): AppState {
    let s = startWith(initialState(), 'tpl-push');
    const ex = s.active!.exercises;
    s = reducer(s, { type: 'UPDATE_SET', weId: ex[0].id, setId: ex[0].sets[1].id, patch: { weight: '80', reps: '5', warmup: true } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: ex[0].id, setId: ex[0].sets[1].id, now: T0 });
    s = reducer(s, { type: 'LINK_SUPERSET', weId: ex[1].id });
    return { ...s, rest: null };
  }

  it('lægger et slettet sæt tilbage på samme plads med værdier og flag', () => {
    const s = workoutState();
    const we = s.active!.exercises[0];
    const { after, d, back } = delThenUndo(s, { type: 'REMOVE_SET', weId: we.id, setId: we.sets[1].id });
    expect(d.label).toBe('Sæt slettet');
    expect(after.active!.exercises[0].sets).toHaveLength(2);
    expect(back.active).toEqual(s.active);
  });

  it('lægger en fjernet øvelse tilbage med supersættet intakt', () => {
    const s = workoutState();
    const ex = s.active!.exercises;
    expect(ex[1].supersetId).toBeTruthy();
    const { after, d, back } = delThenUndo(s, { type: 'REMOVE_EXERCISE', weId: ex[2].id });
    expect(d.label).toBe('Øvelse fjernet');
    // Supersættet med kun én øvelse tilbage opløses ved fjernelsen …
    expect(after.active!.exercises[1].supersetId).toBeUndefined();
    // … og samles igen ved fortryd
    expect(back.active).toEqual(s.active);
  });

  it('genskaber en annulleret træning', () => {
    const s = workoutState();
    const { after, d, back } = delThenUndo(s, { type: 'CANCEL_WORKOUT' });
    expect(after.active).toBeNull();
    expect(d.label).toBe('Træning annulleret');
    expect(strip(back)).toEqual(strip(s));
  });

  function finishedState(): AppState {
    let s = workoutState();
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 + 3_600_000 });
    s = reducer(s, { type: 'ADD_MEASUREMENT', id: 'm1', date: T0, weight: 80 });
    s = reducer(s, { type: 'ADD_MEASUREMENT', id: 'm2', date: T0 - 86_400_000, weight: 81 });
    return { ...s, lastFinishedId: null };
  }

  it.each([
    ['træning', (s: AppState): A => ({ type: 'DELETE_WORKOUT', workoutId: s.history[0].id }), 'Træning slettet', (s: AppState) => s.history[0].id],
    ['skabelon', (s: AppState): A => ({ type: 'DELETE_TEMPLATE', templateId: s.templates[1].id }), 'Skabelon slettet', (s: AppState) => s.templates[1].id],
    ['måling', (): A => ({ type: 'DELETE_MEASUREMENT', id: 'm1' }), 'Måling slettet', () => 'm1'],
  ])('genskaber en slettet %s uden gravsten, også efter fletning', (_n, act, label, idOf) => {
    const s = finishedState();
    const id = idOf(s);
    const { after, d, back } = delThenUndo(s, act(s));
    expect(d.label).toBe(label);
    expect(after.deleted[id]).toBeDefined();
    expect(back.deleted[id]).toBeUndefined();
    expect(strip(back)).toEqual(strip(s));
    // Serveren har en kopi uden tingen (fx fra før den blev oprettet) – den overlever fletningen
    const remote = { ...initialState(), history: [], templates: [], bodyLog: [] };
    const merged = mergeStates(back, remote);
    expect(strip(merged)).toEqual(strip(back));
  });

  it('gør intet, hvis det slettede ikke længere har et sted at være', () => {
    const s = workoutState();
    const we = s.active!.exercises[0];
    const action: A = { type: 'REMOVE_SET', weId: we.id, setId: we.sets[0].id };
    const after = reducer(s, action);
    const d = lastDeletion(s, action, after)!;
    const finished = reducer(after, { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    expect(reducer(finished, { type: 'UNDO_DELETE', deletion: d })).toBe(finished);
    // Ny træning med andet id
    const other = startWith(finished);
    expect(reducer(other, { type: 'UNDO_DELETE', deletion: d })).toBe(other);
    // Fjernet øvelse kan heller ikke komme tilbage efter afslutning
    const action2: A = { type: 'REMOVE_EXERCISE', weId: we.id };
    const after2 = reducer(s, action2);
    const d2 = lastDeletion(s, action2, after2)!;
    const fin2 = reducer(after2, { type: 'FINISH_WORKOUT', now: T0 + 1000 });
    expect(reducer(fin2, { type: 'UNDO_DELETE', deletion: d2 })).toBe(fin2);
    // Annulleret træning overskriver ikke en ny træning
    const a3 = reducer(s, { type: 'CANCEL_WORKOUT' });
    const d3 = lastDeletion(s, { type: 'CANCEL_WORKOUT' }, a3)!;
    const fresh = startWith(a3);
    expect(reducer(fresh, { type: 'UNDO_DELETE', deletion: d3 })).toBe(fresh);
  });

  it('genkender ikke andre handlinger som sletninger', () => {
    const s = workoutState();
    const action: A = { type: 'ADD_SET', weId: s.active!.exercises[0].id };
    expect(lastDeletion(s, action, reducer(s, action))).toBeNull();
    expect(lastDeletion(s, { type: 'DELETE_WORKOUT', workoutId: 'nope' }, s)).toBeNull();
  });

  it('virker også i kladden af en rettet træning', () => {
    let s = finishedState();
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: s.history[0].id });
    const we = s.editing!.exercises[0];
    const action: A = { type: 'REMOVE_SET', weId: we.id, setId: we.sets[0].id, edit: true };
    const after = reducer(s, action);
    const d = lastDeletion(s, action, after)!;
    expect(reducer(after, { type: 'UNDO_DELETE', deletion: d }).editing).toEqual(s.editing);
  });
});

describe('søg i historik (#230)', () => {
  const set = (weight: string, reps: string, warmup = false): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup });
  const wk = (id: string, t: number, name: string, ex: [string, SetEntry[], string?][], extra: Partial<Workout> = {}): Workout => ({
    id,
    name,
    startedAt: t,
    finishedAt: t + 1000,
    exercises: ex.map(([exerciseId, sets, note]) => ({ id: `${id}-${exerciseId}`, exerciseId, sets, note })),
    ...extra,
  });
  const legs = wk('legs', 1000, 'Ben', [['squat', [set('140', '3', true), set('100', '5'), set('110', '3')]], ['legpress', [set('200', '10')]]], { templateId: 'tpl-legs' });
  const push = wk('push', 3000, 'Push', [['bench', [set('80', '5')], 'skulder ømt']], { templateId: 'tpl-push', note: 'Sov dårligt' });
  const pull = wk('pull', 2000, 'Pull', [['row', [set('60', '8')]]], { templateId: 'tpl-pull' });
  const st: AppState = { ...initialState(), history: [push, pull, legs] };

  it('"squat" finder kun træninger med Squat og giver bedste arbejdssæt', () => {
    const r = searchHistory(st, { query: 'squat' });
    expect(r.map((m) => m.workout.id)).toEqual(['legs']);
    expect(r[0].matched).toHaveLength(1);
    expect(r[0].matched[0].exerciseId).toBe('squat');
    expect(r[0].matched[0].best).toMatchObject({ weight: '110', reps: '3' }); // opvarmningen på 140 ignoreres
  });

  it('matcher træningens navn, noter og ÆØÅ uanset store/små bogstaver', () => {
    expect(searchHistory(st, { query: '  PUSH ' }).map((m) => m.workout.id)).toEqual(['push']);
    expect(searchHistory(st, { query: 'sov  dårligt' }).map((m) => m.workout.id)).toEqual(['push']);
    expect(searchHistory(st, { query: 'skulder' }).map((m) => m.workout.id)).toEqual(['push']);
    const r = searchHistory(st, { query: 'BÆNK' });
    expect(r.map((m) => m.workout.id)).toEqual(['push']);
    expect(r[0].matched.map((m) => m.exerciseId)).toEqual(['bench']);
    expect(searchHistory(st, { query: 'findes ikke' })).toEqual([]);
    expect(normalizeSearch(' ÆbLe  Ø ')).toBe('æble ø');
  });

  it('tom søgning giver alle (nyeste først), og templateId filtrerer alene og sammen med tekst', () => {
    expect(searchHistory(st, { query: '' }).map((m) => m.workout.id)).toEqual(['push', 'pull', 'legs']);
    expect(searchHistory(st).every((m) => m.matched.length === 0)).toBe(true);
    expect(searchHistory(st, { templateId: 'tpl-pull' }).map((m) => m.workout.id)).toEqual(['pull']);
    expect(searchHistory(st, { query: 'squat', templateId: 'tpl-legs' }).map((m) => m.workout.id)).toEqual(['legs']);
    expect(searchHistory(st, { query: 'squat', templateId: 'tpl-push' })).toEqual([]);
  });
});

describe('skabelon-filtre i historik (#232)', () => {
  it('giver kun skabeloner med træninger, i skabelonernes rækkefølge', () => {
    const base = initialState();
    const w = (id: string, templateId?: string): Workout => ({ id, name: id, startedAt: 1, finishedAt: 2, exercises: [], templateId });
    const st = { ...base, history: [w('a', 'tpl-legs'), w('b', 'tpl-push'), w('c'), w('d', 'tpl-slettet'), w('e', 'tpl-push')] };
    expect(historyTemplates(st)).toEqual([
      { id: 'tpl-push', name: 'Push' },
      { id: 'tpl-legs', name: 'Ben' },
    ]);
    expect(historyTemplates({ ...base, history: [] })).toEqual([]);
  });
});

describe('RPE (#237)', () => {
  function logged(sets: [string, string, string][], exerciseId = 'bench'): AppState {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: [exerciseId] });
    const weId = s.active!.exercises[0].id;
    sets.forEach(([weight, reps, rpe], i) => {
      if (i > 0) s = reducer(s, { type: 'ADD_SET', weId });
      const set = s.active!.exercises[0].sets[i];
      s = reducer(s, { type: 'UPDATE_SET', weId, setId: set.id, patch: { weight, reps, rpe } });
      s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: T0 });
    });
    return reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
  }

  it('"Vis RPE" er slået til som standard, også for gamle data, og kan slås fra', () => {
    expect(initialState().showRpe).toBe(true);
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.showRpe;
    expect(loadState(JSON.stringify(old)).showRpe).toBe(true);
    const off = reducer(initialState(), { type: 'SET_SHOW_RPE', on: false });
    expect(off.showRpe).toBe(false);
    expect(loadState(JSON.stringify(off)).showRpe).toBe(false);
    expect(reducer(off, { type: 'SET_SHOW_RPE', on: true }).showRpe).toBe(true);
  });

  it('Stor tekst: slået fra som standard, også for gamle data; kan slås til og fra (#295)', () => {
    expect(initialState().largeText).toBe(false);
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.largeText;
    expect(loadState(JSON.stringify(old)).largeText).toBe(false);
    expect(loadState(JSON.stringify({ ...old, largeText: 'ja' })).largeText).toBe(false);
    const on = reducer(initialState(), { type: 'SET_LARGE_TEXT', on: true });
    expect(on.largeText).toBe(true);
    expect(loadState(JSON.stringify(on)).largeText).toBe(true);
    expect(reducer(on, { type: 'SET_LARGE_TEXT', on: true })).toBe(on);
    expect(reducer(on, { type: 'SET_LARGE_TEXT', on: false }).largeText).toBe(false);
  });

  it('Tema: mørk som standard, også for gamle data; ugyldige værdier ignoreres (#293)', () => {
    expect(initialState().theme).toBe('dark');
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.theme;
    expect(loadState(JSON.stringify(old)).theme).toBe('dark');
    expect(loadState(JSON.stringify({ ...old, theme: 'pink' })).theme).toBe('dark');
    const light = reducer(initialState(), { type: 'SET_THEME', theme: 'light' });
    expect(light.theme).toBe('light');
    expect(loadState(JSON.stringify(light)).theme).toBe('light');
    expect(reducer(light, { type: 'SET_THEME', theme: 'system' }).theme).toBe('system');
    expect(reducer(light, { type: 'SET_THEME', theme: 'pink' as never })).toBe(light);
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme(undefined, true)).toBe('dark');
  });

  it('"Vis tid tilbage" er slået til som standard, også for gamle data, og kan slås fra (#281)', () => {
    expect(initialState().showTimeLeft).toBe(true);
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.showTimeLeft;
    expect(loadState(JSON.stringify(old)).showTimeLeft).toBe(true);
    const off = reducer(initialState(), { type: 'SET_SHOW_TIME_LEFT', on: false });
    expect(off.showTimeLeft).toBe(false);
    expect(loadState(JSON.stringify(off)).showTimeLeft).toBe(false);
    expect(reducer(off, { type: 'SET_SHOW_TIME_LEFT', on: true }).showTimeLeft).toBe(true);
  });

  it('læser 6–10 i halve trin med komma eller punktum', () => {
    expect(parseRpe('8,5')).toBe(8.5);
    expect(parseRpe('8.5')).toBe(8.5);
    expect(parseRpe(' 10 ')).toBe(10);
    expect(parseRpe('6')).toBe(6);
    for (const bad of ['5', '11', '8,3', '', 'abc', '8,5,1', '-7', undefined]) expect(parseRpe(bad)).toBeNull();
  });

  it('RPE 10 på tungeste sæt → samme vægt; RPE 6,5 → dobbelt skridt; uden RPE → som før', () => {
    expect(progressionHint(logged([['100', '5', '8'], ['100', '5', '10']]), 'bench')).toMatchObject({
      next: { weight: 100, reps: 5 },
      increase: false,
      rpe: 10,
    });
    expect(progressionHint(logged([['100', '5', '9,5']]), 'bench')).toMatchObject({ next: { weight: 100 }, increase: false });
    expect(progressionHint(logged([['100', '5', '6,5']]), 'bench')).toMatchObject({ next: { weight: 105, reps: 5 }, increase: true, rpe: 6.5 });
    expect(progressionHint(logged([['20', '10', '7']], 'curl'), 'curl')).toMatchObject({ next: { weight: 22 }, rpe: 7 });
    const plain = progressionHint(logged([['100', '5', '']]), 'bench');
    expect(plain).toEqual({ last: { sets: 1, reps: 5, weight: 100, repsList: [5] }, next: { weight: 102.5, reps: 5 }, increase: true });
    expect(progressionHint(logged([['100', '5', '8']]), 'bench')).not.toHaveProperty('rpe');
    // Ugyldig RPE ignoreres
    expect(progressionHint(logged([['100', '5', '12']]), 'bench')!.next.weight).toBe(102.5);
  });

  it('formatRpe viser gyldig RPE med komma og skjuler ugyldig (#238)', () => {
    expect(formatRpe('8.5')).toBe('8,5');
    expect(formatRpe('8,5')).toBe('8,5');
    expect(formatRpe('10')).toBe('10');
    for (const bad of ['', '12', 'x', undefined]) expect(formatRpe(bad)).toBe('');
  });

  it('RPE kommer med i CSV og overlever backup → gendan', () => {
    const s = logged([['100', '5', '8,5']]);
    expect(toCsv(s).split('\n')[1]).toContain(',100,5,"8,5"');
    const restored = loadState(JSON.stringify(s));
    expect(restored.history[0].exercises[0].sets[0].rpe).toBe('8,5');
  });
});

describe('sæt-mærker: drop-sæt, failure og AMRAP (#243)', () => {
  /** Træning med Bænkpres: [vægt, reps, mærke?] – alle sæt udført */
  function workout(sets: [string, string, ('drop' | 'failure' | 'amrap')?][], base = initialState(), at = T0): AppState {
    let s = reducer(base, { type: 'START_WORKOUT', now: at });
    s = { ...s, active: { ...s.active!, templateId: 'tpl-tags' } };
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const weId = s.active!.exercises[0].id;
    sets.forEach(([weight, reps, tag], i) => {
      if (i > 0) s = reducer(s, { type: 'ADD_SET', weId });
      const set = s.active!.exercises[0].sets[i];
      s = reducer(s, { type: 'UPDATE_SET', weId, setId: set.id, patch: { weight, reps } });
      if (tag) s = reducer(s, { type: 'SET_SET_TAG', weId, setId: set.id, tag });
      s = reducer(s, { type: 'TOGGLE_SET', weId, setId: set.id, now: at });
    });
    return s;
  }
  const finish = (s: AppState, at = T0) => reducer(s, { type: 'FINISH_WORKOUT', now: at + 3_600_000 });

  it('"tilføj drop-sæt" efter 100 kg indsætter et drop-sæt lige under med 80 kg', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'ADD_SET', weId: we.id });
    const [first, second] = s.active!.exercises[0].sets;
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: first.id, patch: { weight: '100', reps: '5' } });
    s = reducer(s, { type: 'ADD_DROP_SET', weId: we.id, setId: first.id });
    const sets = s.active!.exercises[0].sets;
    expect(sets).toHaveLength(3);
    expect(sets[0].id).toBe(first.id);
    expect(sets[1]).toMatchObject({ weight: '80', reps: '', tag: 'drop', done: false });
    expect(sets[2].id).toBe(second.id);
  });

  it('drop-vægt: ~20 % lettere, rundet til 2,5 kg, aldrig under 0', () => {
    expect(dropSetWeight('100')).toBe('80');
    expect(dropSetWeight('62,5')).toBe('50');
    expect(dropSetWeight('47,5')).toBe('37,5');
    expect(dropSetWeight('2')).toBe('2,5');
    expect(dropSetWeight('1')).toBe('0');
    expect(dropSetWeight('-10')).toBe('0');
    expect(dropSetWeight('')).toBe('');
  });

  it('et tungt drop-sæt bliver aldrig rekord, men tæller i volumen', () => {
    const before = finish(workout([['100', '5']]), T0 - 86_400_000);
    const s = workout([['100', '5'], ['120', '5', 'drop']], before);
    const drop = s.active!.exercises[0].sets[1];
    expect(recordsBrokenBy(s, 'bench', drop)).toEqual([]);
    const done = finish(s);
    const r = personalRecords(done, 'bench');
    expect(r.heaviest?.weight).toBe(100);
    expect(r.best1RM?.weight).toBe(100);
    expect(workoutVolume(done.history[0])).toBe(100 * 5 + 120 * 5);
  });

  it('forslag, "Forrige" og "vs. sidst" ignorerer drop-sæt fra sidste gang', () => {
    const s = finish(workout([['100', '5'], ['100', '5'], ['60', '12', 'drop']]));
    expect(progressionHint(s, 'bench')).toMatchObject({ last: { sets: 2, reps: 5, weight: 100 }, next: { weight: 102.5 }, increase: true });
    expect(previousSetsFor(s.history, null, 'bench').map((x) => x.weight)).toEqual(['100', '100']);
    // Samme to hovedsæt i dag + et drop-sæt → "vs. sidst" er det samme
    const today = workout([['100', '5'], ['100', '5'], ['40', '10', 'drop']], s, T0 + 86_400_000);
    const vs = vsLastTime(today, today.active)!;
    expect(vs.rows[0]).toMatchObject({ complete: true, status: 'same', now: 1000, last: 1000 });
  });

  it('mærk, skift og fjern et mærke; et mærket sæt er ikke opvarmning', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    const id = we.sets[0].id;
    const tagOf = (st: AppState) => st.active!.exercises[0].sets[0].tag;
    s = reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: 'failure' });
    expect(tagOf(s)).toBe('failure');
    s = reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: 'amrap' });
    expect(tagOf(s)).toBe('amrap');
    expect(reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: 'amrap' }).active).toEqual(s.active);
    s = reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: null });
    expect(s.active!.exercises[0].sets[0]).not.toHaveProperty('tag');
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: id, patch: { warmup: true } });
    s = reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: 'drop' });
    expect(s.active!.exercises[0].sets[0]).toMatchObject({ tag: 'drop' });
    expect(s.active!.exercises[0].sets[0].warmup).toBeUndefined();
  });

  it('opvarmning fra menuen fjerner mærket, og tilbage igen (#244)', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    const id = we.sets[0].id;
    const set0 = (st: AppState) => st.active!.exercises[0].sets[0];
    s = reducer(s, { type: 'SET_SET_TAG', weId: we.id, setId: id, tag: 'failure' });
    s = reducer(s, { type: 'SET_SET_WARMUP', weId: we.id, setId: id, warmup: true });
    expect(set0(s).warmup).toBe(true);
    expect(set0(s)).not.toHaveProperty('tag');
    expect(reducer(s, { type: 'SET_SET_WARMUP', weId: we.id, setId: id, warmup: true }).active).toEqual(s.active);
    s = reducer(s, { type: 'SET_SET_WARMUP', weId: we.id, setId: id, warmup: false });
    expect(set0(s)).not.toHaveProperty('warmup');
  });

  it('sæt-numre: opvarmning og drop-sæt tælles for sig, mærker viser bogstav (#244)', () => {
    const sets: SetEntry[] = [
      { id: 'w', weight: '', reps: '', rpe: '', done: false, warmup: true },
      { id: 'a', weight: '', reps: '', rpe: '', done: false },
      { id: 'd', weight: '', reps: '', rpe: '', done: false, tag: 'drop' },
      { id: 'b', weight: '', reps: '', rpe: '', done: false, tag: 'failure' },
      { id: 'c', weight: '', reps: '', rpe: '', done: false },
    ];
    expect(sets.map((_, i) => setLabel(sets, i))).toEqual([
      { kind: 'warmup', no: 1, text: 'O' },
      { kind: 'work', no: 1, text: '1' },
      { kind: 'drop', no: 1, text: 'D' },
      { kind: 'work', no: 2, text: 'F' },
      { kind: 'work', no: 3, text: '3' },
    ]);
  });

  it('CSV har kolonnen "Mærke", og backup → gendan beholder mærkerne (#245)', () => {
    const s = finish(workout([['100', '5', 'failure'], ['80', '8', 'drop'], ['60', '12', 'amrap'], ['100', '5']]));
    const lines = toCsv(s).split('\n');
    expect(lines[0].split(',').at(-1)).toBe('Mærke');
    expect(lines.slice(1).map((l) => l.split(',').at(-1))).toEqual(['Til failure', 'Drop-sæt', 'AMRAP', '']);
    const restored = loadState(JSON.stringify(s));
    expect(restored.history[0].exercises[0].sets.map((x) => x.tag)).toEqual(['failure', 'drop', 'amrap', undefined]);
  });

  it('historik-tekst og øvelsens bedste 1RM uden drop-sæt (#245)', () => {
    const s = finish(workout([['100', '5'], ['120', '5', 'drop']]));
    const sets = s.history[0].exercises[0].sets;
    expect(sets.map(setTagSuffix)).toEqual(['', ' (drop-sæt)']);
    expect(setTagSuffix({ ...sets[0], tag: 'failure' })).toBe(' (til failure)');
    expect(setTagSuffix({ ...sets[0], tag: 'amrap' })).toBe(' (AMRAP)');
    const [h] = exerciseHistory(s.history, 'bench');
    expect(h.sets).toHaveLength(2);
    expect(h.best1RM).toBeCloseTo(estimate1RM(100, 5));
  });

  it('bogstav og navn pr. mærke', () => {
    expect(setTagInfo('drop')).toEqual({ letter: 'D', name: 'Drop-sæt' });
    expect(setTagInfo('failure')).toEqual({ letter: 'F', name: 'Til failure' });
    expect(setTagInfo('amrap')).toEqual({ letter: 'A', name: 'AMRAP' });
    expect(setTagInfo(undefined)).toBeNull();
  });

  it('gamle data uden mærker indlæses med de samme træninger; mærker overlever gem → indlæs', () => {
    const old = finish(workout([['100', '5'], ['100', '5']]));
    const restored = loadState(JSON.stringify(old));
    expect(restored.history).toEqual(old.history);
    const tagged = finish(workout([['100', '5'], ['80', '8', 'drop']]));
    expect(loadState(JSON.stringify(tagged)).history[0].exercises[0].sets[1].tag).toBe('drop');
  });
});

describe('rep-intervaller i skabeloner (#257)', () => {
  const setReps = (s: ReturnType<typeof initialState>, index: number, min: number | null, max: number | null) =>
    reducer(s, { type: 'SET_TEMPLATE_REPS', templateId: 'tpl-push', index, min, max });

  it('gemmer 8–12 på øvelsen og fjerner det igen', () => {
    const s = initialState();
    const out = setReps(s, 0, 8, 12);
    expect(out.templates[0].exercises[0]).toEqual({ ...s.templates[0].exercises[0], repMin: 8, repMax: 12 });
    expect(out.templates[0].exercises.slice(1)).toEqual(s.templates[0].exercises.slice(1));
    expect(out.templates.slice(1)).toEqual(s.templates.slice(1));
    const cleared = setReps(out, 0, null, null);
    expect(cleared.templates[0].exercises[0]).toEqual(s.templates[0].exercises[0]);
    expect('repMin' in cleared.templates[0].exercises[0]).toBe(false);
    // At fjerne et interval, der ikke findes, ændrer intet
    expect(setReps(s, 0, null, null)).toBe(s);
  });

  it('afviser ugyldige intervaller, ukendte skabeloner og øvelser', () => {
    const s = initialState();
    expect(setReps(s, 0, 12, 8)).toBe(s);
    expect(setReps(s, 0, 0, 8)).toBe(s);
    expect(setReps(s, 0, 8, 51)).toBe(s);
    expect(setReps(s, 0, 8, null)).toBe(s);
    expect(setReps(s, 0, 8.5, 10)).toBe(s);
    expect(setReps(s, 99, 8, 12)).toBe(s);
    expect(reducer(s, { type: 'SET_TEMPLATE_REPS', templateId: 'nej', index: 0, min: 8, max: 12 })).toBe(s);
    expect(validRepRange(1, 50)).toBe(true);
    expect(validRepRange(5, 5)).toBe(true);
  });

  it('en træning fra skabelonen – og en gentagelse af den – får intervallet med', () => {
    const s = setReps(initialState(), 0, 8, 12);
    const started = reducer(s, { type: 'START_WORKOUT', templateId: 'tpl-push', now: T0 });
    const ex = started.active!.exercises;
    expect(ex[0]).toMatchObject({ repMin: 8, repMax: 12 });
    expect(ex[0].sets).toHaveLength(s.templates[0].exercises[0].sets);
    expect(ex[1].repMin).toBeUndefined();
    // Afslut med ét udfyldt sæt og gentag træningen
    const w = { ...started, active: { ...started.active!, exercises: started.active!.exercises.map((e, i) => (i === 0 ? { ...e, sets: [{ ...e.sets[0], weight: '60', reps: '10', done: true }] } : e)) } };
    const done = reducer(w, { type: 'FINISH_WORKOUT', now: T0 + 3600_000 });
    expect(done.history[0].exercises[0]).toMatchObject({ repMin: 8, repMax: 12 });
    const again = reducer(done, { type: 'REPEAT_WORKOUT', workoutId: done.history[0].id, now: T0 + 86_400_000 });
    expect(again.active!.exercises[0]).toMatchObject({ exerciseId: done.history[0].exercises[0].exerciseId, repMin: 8, repMax: 12 });
    // Gem som skabelon beholder intervallet
    const saved = reducer(done, { type: 'SAVE_TEMPLATE_FROM_WORKOUT', workoutId: done.history[0].id, name: 'Ny' });
    expect(saved.templates.at(-1)!.exercises[0]).toMatchObject({ repMin: 8, repMax: 12 });
  });

  it('ændringen tidsstemples, så den nyeste vinder ved synk', () => {
    const prev = initialState();
    const out = stampChanges(prev, setReps(prev, 0, 8, 12), 500);
    expect(out.templates[0].updatedAt).toBe(500);
    expect(out.templates[1].updatedAt).toBe(prev.templates[1].updatedAt);
  });

  it('gamle data uden intervaller indlæses uændret', () => {
    const old = { ...initialState(), templates: [{ id: 't1', name: 'Gammel', exercises: [{ exerciseId: 'bench', sets: 3 }] }] };
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.templates).toEqual(old.templates);
    const started = reducer(loaded, { type: 'START_WORKOUT', templateId: 't1', now: T0 });
    expect(started.active!.exercises[0].repMin).toBeUndefined();
  });

  it('formatTemplateLine viser "3 × 8–12" eller "3 sæt"', () => {
    const bench = { name: 'Bænkpres' };
    expect(formatTemplateLine(bench, { exerciseId: 'bench', sets: 3, repMin: 8, repMax: 12 })).toBe('Bænkpres 3 × 8–12');
    expect(formatTemplateLine(bench, { exerciseId: 'bench', sets: 3 })).toBe('Bænkpres 3 sæt');
    expect(formatTemplateLine(bench, { exerciseId: 'bench', sets: 5, repMin: 5, repMax: 5 })).toBe('Bænkpres 5 × 5');
    expect(formatTemplateLine(undefined, { exerciseId: 'x', sets: 2 })).toBe('? 2 sæt');
  });
});

describe('årets træningskort (#264)', () => {
  let n = 0;
  const done = (weight = '50', reps = '5') => ({ id: `s${++n}`, weight, reps, rpe: '', done: true });
  const w = (date: Date, sets: number, extra: Partial<Workout> = {}): Workout => ({
    id: `w${++n}`,
    name: 'Træning',
    startedAt: date.getTime(),
    finishedAt: date.getTime() + 3600_000,
    exercises: [
      { id: `we${n}`, exerciseId: 'bench', sets: [...Array.from({ length: sets }, () => done()), { ...done(), warmup: true }] },
    ],
    ...extra,
  });

  it('3 træningsdage giver 3 felter med niveau ≥ 1; gitteret starter mandag og dækker 1. jan–31. dec', () => {
    const h = yearHeatmap(
      [w(new Date(2025, 0, 1, 10), 3), w(new Date(2025, 5, 15, 10), 3), w(new Date(2025, 11, 31, 18), 3), w(new Date(2024, 11, 31, 10), 3)],
      2025,
    );
    expect(h.days.filter((d) => d.level >= 1)).toHaveLength(3);
    expect(h.days.filter((d) => d.inYear && d.level === 0)).toHaveLength(362);
    expect(new Date(h.days[0].date).getDay()).toBe(1);
    expect(new Date(h.days[h.days.length - 1].date).getDay()).toBe(0);
    expect(h.days.length % 7).toBe(0);
    const inYear = h.days.filter((d) => d.inYear);
    expect(inYear).toHaveLength(365);
    expect(new Date(inYear[0].date)).toEqual(new Date(2025, 0, 1));
    expect(new Date(inYear[364].date)).toEqual(new Date(2025, 11, 31));
    // Udfyldningsdage fra 2024 tæller ikke, selvom der blev trænet 31. dec 2024
    expect(h.days.filter((d) => !d.inYear).every((d) => d.level === 0)).toBe(true);
    expect(h.trainingDays).toBe(3);
  });

  it('to træninger samme dag lægges sammen; niveauer skaleres, så den travleste dag er 4', () => {
    const h = yearHeatmap(
      [
        w(new Date(2025, 2, 3, 8), 2),
        w(new Date(2025, 2, 3, 18), 4),
        w(new Date(2025, 2, 5, 8), 1),
        w(new Date(2025, 2, 7, 8), 3),
        w(new Date(2025, 2, 9, 8), 2),
      ],
      2025,
    );
    const day = (d: number) => h.days.find((x) => x.date === new Date(2025, 2, d).getTime())!;
    expect(day(3)).toMatchObject({ workSets: 6, volume: 6 * 250, level: 4 });
    expect(day(3).workoutIds).toHaveLength(2);
    expect(day(5).level).toBe(1);
    expect(day(9).level).toBe(2);
    expect(day(7).level).toBe(3);
    expect(h.trainingDays).toBe(4);
    // Alle dage lige travle → alle niveau 4
    expect(yearHeatmap([w(new Date(2025, 0, 6), 3), w(new Date(2025, 0, 8), 3)], 2025).days.filter((d) => d.level === 4)).toHaveLength(2);
  });

  it('længste ugerække og travleste måned, også med et hul; et tomt år giver nul', () => {
    const h = yearHeatmap(
      [
        // 3 uger i træk i januar (uge 2, 3, 4 – mandag 6., 13., 20. jan 2025)
        w(new Date(2025, 0, 6), 1),
        w(new Date(2025, 0, 15), 1),
        w(new Date(2025, 0, 26), 1),
        // hul, så 2 uger i træk i maj med 3 dage → maj og januar har 3 dage hver
        w(new Date(2025, 4, 5), 1),
        w(new Date(2025, 4, 7), 1),
        w(new Date(2025, 4, 12), 1),
      ],
      2025,
    );
    expect(h.longestWeekStreak).toBe(3);
    expect(h.busiestMonth).toBe(0); // lighed → den tidligste
    expect(yearHeatmap([w(new Date(2025, 4, 5), 1), w(new Date(2025, 4, 7), 1), w(new Date(2025, 0, 6), 1)], 2025).busiestMonth).toBe(4);
    const empty = yearHeatmap([w(new Date(2025, 4, 5), 1)], 2026);
    expect(empty).toMatchObject({ year: 2026, trainingDays: 0, longestWeekStreak: 0, busiestMonth: null });
    expect(empty.days.every((d) => d.level === 0)).toBe(true);
  });

  it('årene med træninger, nyeste først, altid med indeværende år', () => {
    const now = new Date(2026, 5, 1).getTime();
    expect(heatmapYears([w(new Date(2024, 1, 1), 1), w(new Date(2025, 1, 1), 1), w(new Date(2024, 3, 1), 1)], now)).toEqual([2026, 2025, 2024]);
    expect(heatmapYears([], now)).toEqual([2026]);
  });
});

describe('gennem tiden (#272)', () => {
  const NOW = new Date('2026-11-20T18:00:00').getTime();
  const DAY = 86_400_000;
  let n = 0;
  const set = (weight: string, reps: string, extra: Partial<SetEntry> = {}): SetEntry => ({ id: `lt${++n}`, weight, reps, rpe: '', done: true, ...extra });
  const workout = (startedAt: number, ex: Record<string, SetEntry[]>): Workout => ({
    id: `lw${++n}`,
    name: 'Træning',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    exercises: Object.entries(ex).map(([exerciseId, sets], i) => ({ id: `lwe${n}-${i}`, exerciseId, sets })),
  });

  it('lægger sæt, reps og vægt sammen over flere træninger; opvarmning og ikke-afkrydsede sæt tæller ikke', () => {
    const first = NOW - 30 * DAY;
    const last = NOW - 2 * DAY;
    const history = [
      workout(last, { bench: [set('20', '10', { warmup: true }), set('80', '5'), set('80', '5'), set('60', '8', { tag: 'drop' })] }),
      workout(NOW - 10 * DAY, { squat: [set('100', '5')] }),
      workout(first, { bench: [set('70', '8'), set('70', '8'), set('75', '6', { done: false })] }),
    ];
    expect(lifetimeStats(history, 'bench')).toEqual({
      firstDate: first,
      lastDate: last,
      workouts: 2,
      sets: 5,
      reps: 5 + 5 + 8 + 8 + 8,
      volumeKg: 80 * 5 * 2 + 60 * 8 + 70 * 8 * 2,
    });
  });

  it('en øvelse, der aldrig er lavet (eller kun som opvarmning), giver null', () => {
    const history = [workout(NOW, { bench: [set('20', '10', { warmup: true })] })];
    expect(lifetimeStats(history, 'bench')).toBeNull();
    expect(lifetimeStats(history, 'squat')).toBeNull();
    expect(lifetimeStats([], 'squat')).toBeNull();
  });

  it('tidsøvelser tæller træninger og sæt, men ingen reps eller vægt', () => {
    const history = [workout(NOW, { plank: [set('', '', { seconds: '60' }), set('', '', { seconds: '45' })] })];
    expect(lifetimeStats(history, 'plank')).toMatchObject({ workouts: 1, sets: 2, reps: 0, volumeKg: 0 });
  });

  it('mostLiftedExercises rangerer efter samlet vægt, springer tidsøvelser over og respekterer n', () => {
    const state: AppState = {
      ...initialState(),
      history: [
        workout(NOW - DAY, { squat: [set('100', '5'), set('100', '5')], bench: [set('80', '5')], plank: [set('', '', { seconds: '60' })] }),
        workout(NOW - 3 * DAY, { bench: [set('80', '5')], deadlift: [set('120', '3')] }),
      ],
    };
    const ids = (s: AppState, k?: number) => mostLiftedExercises(s, k).map((r) => r.exerciseId);
    const exists = (id: string) => state.exercises.some((e) => e.id === id);
    expect(['squat', 'bench', 'deadlift', 'plank'].every(exists)).toBe(true);
    expect(ids(state, 10)).toEqual(['squat', 'bench', 'deadlift']);
    expect(ids(state)).toHaveLength(3);
    expect(ids(state, 1)).toEqual(['squat']);
    expect(mostLiftedExercises(state, 3)[1]).toMatchObject({ exerciseId: 'bench', volumeKg: 800, workouts: 2 });
    expect(mostLiftedExercises(initialState(), 3)).toEqual([]);
  });

  it('formatTons og daysAgoText', () => {
    expect(formatTons(850)).toBe('850 kg');
    expect(formatTons(0)).toBe('0 kg');
    expect(formatTons(86_400)).toBe('86,4 tons');
    expect(formatTons(1_240_000)).toBe('1.240 tons');
    expect(formatTons(1000)).toBe('1 ton');
    expect(daysAgoText(NOW - 60_000, NOW)).toBe('i dag');
    expect(daysAgoText(new Date('2026-11-19T23:30:00').getTime(), NOW)).toBe('i går');
    expect(daysAgoText(NOW - 12 * DAY, NOW)).toBe('for 12 dage siden');
  });
});

describe('estimeret træningstid (#279)', () => {
  const MIN = 60_000;
  function doneWorkout(id: string, startedAt: number, minutes: number, templateId = 'tpl-push'): Workout {
    return { id, name: 'Push', startedAt, finishedAt: startedAt + minutes * MIN, templateId, exercises: [] };
  }

  it('bruger gennemsnittet af de seneste træninger fra skabelonen', () => {
    const s: AppState = {
      ...initialState(),
      history: [doneWorkout('a', T0, 40), doneWorkout('b', T0 + 86_400_000, 50), doneWorkout('c', T0 + 2 * 86_400_000, 60)],
    };
    expect(templateDurationEstimate(s, 'tpl-push')).toEqual({ minutes: 50, basis: 'history' });
  });

  it('trækker pauser fra og bruger kun de seneste 5', () => {
    const old = Array.from({ length: 5 }, (_, i) => doneWorkout(`n${i}`, T0 + (10 + i) * 86_400_000, 30));
    const paused = { ...doneWorkout('p', T0 + 20 * 86_400_000, 60), pausedMs: 30 * MIN };
    const s: AppState = { ...initialState(), history: [doneWorkout('x', T0, 120), ...old.slice(1), paused] };
    expect(templateDurationEstimate(s, 'tpl-push')).toEqual({ minutes: 30, basis: 'history' });
  });

  it('ignorerer udsving under 5 min og over 4 timer', () => {
    const s: AppState = {
      ...initialState(),
      history: [doneWorkout('a', T0, 2), doneWorkout('b', T0 + 1, 300), doneWorkout('c', T0 + 2, 45)],
    };
    expect(templateDurationEstimate(s, 'tpl-push')).toEqual({ minutes: 45, basis: 'history' });
  });

  it('regner ud fra sæt × (40 sek + pausetid) uden historik, rundet til 5 min', () => {
    const s = initialState();
    const tpl = s.templates.find((t) => t.id === 'tpl-push')!;
    const secs = tpl.exercises.reduce((n, e) => n + e.sets * (SET_WORK_SECONDS + restFor(s, e.exerciseId)), 0);
    const est = templateDurationEstimate(s, 'tpl-push')!;
    expect(est.basis).toBe('estimate');
    expect(est.minutes % 5).toBe(0);
    expect(est.minutes).toBe(Math.round(secs / 60 / 5) * 5);
    // Træninger fra andre skabeloner tæller ikke
    const other = { ...s, history: [doneWorkout('a', T0, 50, 'tpl-legs')] };
    expect(templateDurationEstimate(other, 'tpl-push')!.basis).toBe('estimate');
    expect(templateDurationEstimate(s, 'findes-ikke')).toBeNull();
  });

  it('et supersæt har kun én pause pr. runde', () => {
    const base = initialState();
    const s: AppState = {
      ...base,
      templates: [
        { id: 't1', name: 'A', exercises: [{ exerciseId: 'bench', sets: 3 }, { exerciseId: 'squat', sets: 3 }] },
        { id: 't2', name: 'B', exercises: [{ exerciseId: 'bench', sets: 3, supersetId: 'g' }, { exerciseId: 'squat', sets: 3, supersetId: 'g' }] },
      ],
    };
    expect(templateDurationEstimate(s, 't2')!.minutes).toBeLessThan(templateDurationEstimate(s, 't1')!.minutes);
  });

  it('tid tilbage falder, når sæt bliver udført, og er null når alt er udført', () => {
    let s = startWith(initialState());
    expect(timeLeftEstimate(s, T0)).toBeNull(); // tom træning
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    for (let i = 0; i < 4; i++) s = reducer(s, { type: 'ADD_SET', weId: s.active!.exercises[0].id });
    const we = () => s.active!.exercises[0];
    expect(we().sets).toHaveLength(5);
    // Ingen udførte sæt: 5 × (40 sek + 3 min bænkpres-pause) = 18,3 min
    expect(timeLeftEstimate(s, T0)).toBe(18);
    const tick = (i: number, at: number) => {
      s = reducer(s, { type: 'UPDATE_SET', weId: we().id, setId: we().sets[i].id, patch: { weight: '80', reps: '5' } });
      s = reducer(s, { type: 'TOGGLE_SET', weId: we().id, setId: we().sets[i].id, now: at });
    };
    tick(0, T0 + 2 * MIN);
    expect(timeLeftEstimate(s, T0 + 2 * MIN)).toBe(15);
    tick(1, T0 + 6 * MIN);
    tick(2, T0 + 9 * MIN);
    // 3 sæt på 9 min → 3 min pr. sæt × 2 tilbage
    expect(timeLeftEstimate(s, T0 + 9 * MIN)).toBe(6);
    tick(3, T0 + 12 * MIN);
    expect(timeLeftEstimate(s, T0 + 12 * MIN)).toBe(3);
    tick(4, T0 + 15 * MIN);
    expect(timeLeftEstimate(s, T0 + 15 * MIN)).toBeNull();
  });
});

describe('ugentlige sætmål pr. muskelgruppe (#300)', () => {
  // Fredag 20. nov. 2026; ugen starter mandag 16. nov.
  const NOW = new Date('2026-11-20T18:00:00').getTime();
  const sets = (n: number, extra: Partial<SetEntry> = {}): SetEntry[] =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, weight: '60', reps: '8', rpe: '', done: true, ...extra }));
  const workout = (id: string, startedAt: number, ex: Record<string, SetEntry[]>, finished = true): Workout => ({
    id,
    name: id,
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : undefined,
    exercises: Object.entries(ex).map(([exerciseId, s], i) => ({ id: `${id}-${i}`, exerciseId, sets: s })),
  });
  const row = (s: AppState, m: string) => weeklySetProgress(s, NOW).find((r) => r.muscle === m)!;

  it('sæt fra mandag tæller, sæt fra søndagen før tæller ikke', () => {
    const s: AppState = {
      ...initialState(),
      history: [
        workout('sun', new Date('2026-11-15T23:30:00').getTime(), { bench: sets(5) }),
        workout('mon', new Date('2026-11-16T00:30:00').getTime(), { bench: sets(3) }),
        workout('thu', new Date('2026-11-19T17:00:00').getTime(), { bench: sets(2), squat: sets(4) }),
      ],
    };
    expect(row(s, 'Bryst')).toEqual({ muscle: 'Bryst', done: 5, target: 12, reached: false });
    expect(row(s, 'Ben').done).toBe(4);
    expect(row(s, 'Ryg').done).toBe(0);
    expect(weeklySetProgress(s, NOW).map((r) => r.muscle)).toEqual(['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave']);
  });

  it('opvarmning og ikke-afkrydsede sæt tæller ikke; afkrydsede sæt i den aktive træning gør', () => {
    const warm = workout('a', NOW - 86_400_000, { bench: [...sets(2), ...sets(3, { warmup: true }), ...sets(4, { done: false })] });
    const active = workout('b', NOW - 600_000, { bench: [...sets(3), ...sets(2, { done: false })] }, false);
    expect(row({ ...initialState(), history: [warm] }, 'Bryst').done).toBe(2);
    expect(row({ ...initialState(), history: [warm], active }, 'Bryst').done).toBe(5);
  });

  it('SET_SET_TARGET sætter, afgrænser (1–40) og slår et mål fra; "nået" præcis ved målet', () => {
    const base = initialState();
    expect(base.setTargets).toEqual(DEFAULT_SET_TARGETS);
    const ryg = reducer(base, { type: 'SET_SET_TARGET', muscle: 'Ryg', value: 16 });
    expect(ryg.setTargets.Ryg).toBe(16);
    expect(ryg.setTargets.Bryst).toBe(12);
    expect(reducer(base, { type: 'SET_SET_TARGET', muscle: 'Ryg', value: 0 }).setTargets.Ryg).toBe(1);
    expect(reducer(base, { type: 'SET_SET_TARGET', muscle: 'Ryg', value: 99 }).setTargets.Ryg).toBe(40);
    const off = reducer(base, { type: 'SET_SET_TARGET', muscle: 'Mave', value: null });
    expect(off.setTargets.Mave).toBeNull();
    expect(reducer(off, { type: 'SET_SET_TARGET', muscle: 'Mave', value: null })).toBe(off);
    expect(row(off, 'Mave')).toMatchObject({ target: null, reached: false });

    const three = reducer(base, { type: 'SET_SET_TARGET', muscle: 'Bryst', value: 3 });
    const at = (n: number) => row({ ...three, history: [workout('a', NOW - 3_600_000, { bench: sets(n) })] }, 'Bryst').reached;
    expect(at(2)).toBe(false);
    expect(at(3)).toBe(true);
    expect(at(4)).toBe(true);
  });

  it('målene synkroniseres som andre indstillinger (stempler settingsAt)', () => {
    const phone = trackedReducer(initialState(), { type: 'SET_SET_TARGET', muscle: 'Ryg', value: 18, at: 500 });
    expect(phone.settingsAt).toBe(500);
    expect(mergeStates(initialState(), phone).setTargets.Ryg).toBe(18);
  });

  it('gamle data uden setTargets får standardmålene; ugyldige værdier rettes', () => {
    const old = JSON.parse(JSON.stringify(initialState()));
    delete old.setTargets;
    expect(loadState(JSON.stringify(old)).setTargets).toEqual(DEFAULT_SET_TARGETS);
    const odd = loadState(JSON.stringify({ ...old, setTargets: { Ryg: 99, Mave: null, Ben: 'x' } }));
    expect(odd.setTargets).toEqual({ ...DEFAULT_SET_TARGETS, Ryg: 40, Mave: null });
  });
});

describe('dit træningsår (#307)', () => {
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
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

  it('tæller træninger, timer, volumen, favoritøvelse og stærkeste måned pr. år', () => {
    const s = withHistory(
      w('old', at(2025, 11, 30), 60, [['squat', [ws('200', '5'), ws('200', '5')]]]),
      w('a', at(2026, 1, 3), 60, [['bench', [ws('80', '5'), ws('80', '5')]], ['squat', [ws('100', '5'), ws('60', '5', true)]]]),
      w('b', at(2026, 4, 10), 90, [['bench', [ws('80', '5')]], ['squat', [ws('120', '5'), ws('120', '5'), ws('120', '5')]]]),
      w('c', at(2026, 4, 12), 30, [['bench', [ws('90', '3')]]]),
    );
    const r = yearReview(s, 2026);
    expect(r.year).toBe(2026);
    expect(r.workouts).toBe(3);
    expect(r.durationMs).toBe(180 * MIN);
    expect(r.volume).toBe(800 + 500 + 400 + 1800 + 270);
    expect(r.trainingDays).toBe(3);
    // bænk i 3 træninger, squat i 2 (selvom squat har flere sæt)
    expect(r.favourite).toEqual({ exerciseId: 'bench', name: 'Bænkpres', workouts: 3, sets: 4 });
    expect(r.strongestMonth).toEqual({ month: 4, name: 'maj', volume: 2470 });

    const old = yearReview(s, 2025);
    expect(old.workouts).toBe(1);
    expect(old.volume).toBe(2000);
    expect(old.favourite?.exerciseId).toBe('squat');
    expect(old.strongestMonth?.name).toBe('december');
  });

  it('ved lige mange træninger vinder øvelsen med flest sæt', () => {
    const s = withHistory(w('a', at(2026, 2, 1), 30, [['bench', [ws('80', '5')]], ['squat', [ws('100', '5'), ws('100', '5')]]]));
    expect(yearReview(s, 2026).favourite?.exerciseId).toBe('squat');
  });

  it('sammenligner volumen med noget sjovt', () => {
    expect(volumeComparison(21_000)).toMatchObject({ count: 4, name: 'elefanter', text: '= 4 elefanter' });
    expect(volumeComparison(300_000)?.name).toBe('blåhvaler');
    expect(volumeComparison(1_500)).toMatchObject({ count: 1, name: 'bil' });
    expect(volumeComparison(60)?.name).toBe('vaskemaskine');
    expect(volumeComparison(3)).toBeNull();
    expect(volumeComparison(0)).toBeNull();
  });

  it('et år uden træning giver nul og ingen favorit; år er nyeste først', () => {
    const s = withHistory(w('a', at(2024, 5, 1), 30, [['bench', [ws('80', '5')]]]), w('b', at(2026, 5, 1), 30, [['bench', [ws('80', '5')]]]));
    expect(yearReview(s, 2025)).toMatchObject({ workouts: 0, durationMs: 0, volume: 0, trainingDays: 0, favourite: null, strongestMonth: null, comparison: null });
    expect(yearsWithWorkouts(s)).toEqual([2026, 2024]);
    expect(yearsWithWorkouts(initialState())).toEqual([]);
  });

  it('gamle gemte data indlæses uændret (ingen ændring i datamodellen)', () => {
    const old = JSON.stringify({ ...initialState(), history: [w('a', at(2026, 5, 1), 30, [['bench', [ws('80', '5')]]])] });
    expect(yearReview(loadState(old), 2026).workouts).toBe(1);
  });
});

describe('dit træningsår: rekorder, stime og fremgang (#308)', () => {
  const ws = (weight: string, reps: string): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup: false });
  const w = (id: string, at: number, exercises: [string, SetEntry[]][]): Workout => ({
    id,
    name: id,
    startedAt: at,
    finishedAt: at + 3_600_000,
    exercises: exercises.map(([exerciseId, sets]) => ({ id: uid(), exerciseId, sets })),
  });
  const withHistory = (...list: Workout[]): AppState => ({ ...initialState(), history: [...list].sort((a, b) => b.startedAt - a.startedAt) });
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

  it('tæller kun årets rekorder, og den største er det største 1RM-spring', () => {
    const s = withHistory(
      w('a', at(2025, 10, 1), [['bench', [ws('80', '5')]], ['squat', [ws('100', '5')]]]),
      w('b', at(2025, 11, 1), [['bench', [ws('85', '5')]]]), // 2025: tungeste + 1RM
      w('c', at(2026, 1, 1), [['bench', [ws('87.5', '5')]]]), // +2,5 kg: tungeste + 1RM
      w('d', at(2026, 3, 1), [['squat', [ws('120', '5')]]]), // +20 kg: tungeste + 1RM
      w('e', at(2026, 4, 1), [['bench', [ws('80', '5')]]]), // ingen rekord
    );
    const r = yearReview(s, 2026);
    expect(r.records).toBe(4);
    expect(r.biggestRecord).toMatchObject({ exerciseId: 'squat', name: 'Squat', from: estimate1RM(100, 5), to: estimate1RM(120, 5) });
    expect(yearReview(s, 2025).records).toBe(2);
    // samme optælling som 🏆 i hver træning
    expect(r.records).toBe(['c', 'd', 'e'].reduce((n, id) => n + recordCount(workoutRecords(s, id)), 0));
  });

  it('træning i uge 10, 11, 12 og 20 giver en stime på 3 uger', () => {
    const week = (n: number) => new Date(2026, 0, 5 + (n - 2) * 7, 12).getTime(); // 5. jan 2026 er mandag i uge 2
    const s = withHistory(...[10, 11, 12, 20].map((n) => w(`w${n}`, week(n), [['bench', [ws('80', '5')]]])));
    expect([10, 11, 12, 20].map((n) => isoWeek(week(n)))).toEqual([10, 11, 12, 20]);
    expect(yearReview(s, 2026).longestWeekStreak).toBe(3);
  });

  it('bænk 80 × 5 i januar og 100 × 5 i november vokser fra ~93 til ~117 kg (+25 %)', () => {
    const s = withHistory(
      w('jan', at(2026, 0, 10), [['bench', [ws('80', '5')]], ['squat', [ws('100', '5')]]]),
      w('nov', at(2026, 10, 10), [['bench', [ws('100', '5')]]]),
    );
    const g = yearReview(s, 2026).liftGrowth;
    // squat er kun trænet én gang → ingen række
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ exerciseId: 'bench', name: 'Bænkpres', pct: 25 });
    expect(g[0].start).toBeCloseTo(93.3, 1);
    expect(g[0].end).toBeCloseTo(116.7, 1);
  });

  it('højst 3 løft, højeste først; tids- og distanceøvelser er udeladt', () => {
    const plank = initialState().exercises.find((e) => e.kind === 'time');
    const s = withHistory(
      ...[0, 5].map((m) =>
        w(`m${m}`, at(2026, m, 3), [
          ['bench', [ws('80', '5')]],
          ['squat', [ws('120', '5')]],
          ['deadlift', [ws('150', '5')]],
          ['ohp', [ws('50', '5')]],
          ...(plank ? [[plank.id, [{ ...ws('', ''), seconds: '60' }]] as [string, SetEntry[]]] : []),
        ]),
      ),
    );
    expect(yearReview(s, 2026).liftGrowth.map((g) => g.exerciseId)).toEqual(['deadlift', 'squat', 'bench']);
  });

  it('et år uden træning har ingen rekorder, stime eller fremgang', () => {
    expect(yearReview(initialState(), 2026)).toMatchObject({ records: 0, biggestRecord: null, longestWeekStreak: 0, liftGrowth: [] });
  });
});

describe('dit træningsår: kortet og historien (#309)', () => {
  const ws = (weight: string, reps: string): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup: false });
  const w = (id: string, at: number, exercises: [string, SetEntry[]][]): Workout => ({
    id,
    name: id,
    startedAt: at,
    finishedAt: at + 3_600_000,
    exercises: exercises.map(([exerciseId, sets]) => ({ id: uid(), exerciseId, sets })),
  });
  const withHistory = (...list: Workout[]): AppState => ({ ...initialState(), history: [...list].sort((a, b) => b.startedAt - a.startedAt) });
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

  it('kortet vises i december og januar for året med træninger, ellers ikke', () => {
    const s = withHistory(w('a', at(2026, 2, 1), [['bench', [ws('80', '5')]]]));
    expect(yearReviewCardYear(s, at(2026, 11, 5))).toBe(2026);
    expect(yearReviewCardYear(s, at(2027, 0, 20))).toBe(2026);
    expect(yearReviewCardYear(s, at(2026, 5, 1))).toBeNull();
    expect(yearReviewCardYear(s, at(2026, 10, 30))).toBeNull();
    expect(yearReviewCardYear(s, at(2027, 11, 5))).toBeNull(); // ingen træninger i 2027
  });

  it('"Skjul" husker året, og gamle data uden feltet indlæses', () => {
    let s = withHistory(w('a', at(2026, 2, 1), [['bench', [ws('80', '5')]]]));
    s = reducer(s, { type: 'HIDE_YEAR_REVIEW', year: 2026 });
    expect(s.yearReviewHidden).toEqual([2026]);
    expect(reducer(s, { type: 'HIDE_YEAR_REVIEW', year: 2026 })).toBe(s);
    expect(yearReviewCardYear(s, at(2026, 11, 5))).toBeNull();
    const old = JSON.parse(JSON.stringify(s));
    delete old.yearReviewHidden;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.yearReviewHidden).toEqual([]);
    expect(loaded.history).toHaveLength(1);
    expect(loadState(JSON.stringify(s)).yearReviewHidden).toEqual([2026]);
  });

  it('historien har alle slides med data og springer tomme over', () => {
    const s = withHistory(
      w('jan', at(2026, 0, 10), [['bench', [ws('80', '5')]]]),
      w('nov', at(2026, 10, 10), [['bench', [ws('100', '5')]]]),
    );
    const slides = yearReviewSlides(yearReview(s, 2026));
    expect(slides.map((x) => x.id)).toEqual(['intro', 'volume', 'favourite', 'records', 'streak', 'month', 'growth', 'end']);
    expect(slides[0]).toMatchObject({ title: 'Dit træningsår 2026', big: '2 træninger' });
    expect(slides[2].big).toBe('Bænkpres');
    expect(slides.find((x) => x.id === 'growth')?.lines[0]).toBe('Bænkpres: 93 kg → 117 kg (+25 %)');
    expect(slides.at(-1)?.title).toBe('Godt gået!');

    // én enkelt træning: ingen rekorder og ingen fremgang
    const one = yearReviewSlides(yearReview(withHistory(w('a', at(2026, 3, 1), [['bench', [ws('80', '5')]]])), 2026));
    expect(one.map((x) => x.id)).toEqual(['intro', 'volume', 'favourite', 'streak', 'month', 'end']);
  });
});

describe('dit træningsår: delebillede (#310)', () => {
  const ws = (weight: string, reps: string): SetEntry => ({ id: uid(), weight, reps, rpe: '', done: true, warmup: false });
  const w = (id: string, at: number, exercises: [string, SetEntry[]][]): Workout => ({
    id,
    name: id,
    startedAt: at,
    finishedAt: at + 90 * 60_000,
    exercises: exercises.map(([exerciseId, sets]) => ({ id: uid(), exerciseId, sets })),
  });
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 12).getTime();

  it('linjerne på billedet har årets tal med dansk formatering', () => {
    // 1200 træninger er urealistisk, men viser tusindtalsseparator
    const list = Array.from({ length: 1200 }, (_, i) => w(`w${i}`, at(2026, 0, 1) + i * 6 * 3_600_000, [['squat', [ws('100', '5')]]]));
    const s: AppState = { ...initialState(), history: list.sort((a, b) => b.startedAt - a.startedAt) };
    const card = yearShareCardLines(yearReview(s, 2026));
    expect(card.title).toBe('Mit træningsår 2026');
    expect(card.stats).toEqual([
      { label: 'Træninger', value: '1.200' },
      { label: 'Tid', value: '1800 t' },
      { label: 'Løftet', value: '600 tons' },
      { label: 'Længste stime', value: expect.stringMatching(/^\d+ uger$/) },
    ]);
    expect(card.lines[0]).toBe('❤️ Favoritøvelse: Squat');
    expect(card.lines.at(-1)).toBe('🐋 Det svarer til 4 blåhvaler');
    expect(card.fileName).toBe('loeft-traeningsaar-2026.png');
  });

  it('et lille år: kommatal i tons og ingen rekordlinje', () => {
    const s: AppState = { ...initialState(), history: [w('a', at(2026, 3, 1), [['bench', [ws('80', '5'), ws('80', '5'), ws('80', '5')]]])] };
    const card = yearShareCardLines(yearReview(s, 2026));
    expect(card.stats.map((x) => x.value)).toEqual(['1', '1 t 30 min', '1,2 tons', '1 uge']);
    expect(card.lines).toEqual(['❤️ Favoritøvelse: Bænkpres', '🚗 Det svarer til 1 bil']);
  });
});

describe('reelle pauser (#315)', () => {
  /** Bænkpres med 3 sæt, krydset af på de givne tidspunkter (ms efter T0) */
  function benchWorkout(base: AppState, times: number[], pause?: { at: number; ms: number }) {
    let s = reducer(base, { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    for (let i = 1; i < times.length; i++) s = reducer(s, { type: 'ADD_SET', weId: s.active!.exercises[0].id });
    const we = s.active!.exercises[0];
    we.sets.forEach((set, i) => {
      s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: set.id, patch: { weight: '60', reps: '8' } });
      if (pause && pause.at <= times[i] && !s.active!.pausedAt && !s.active!.pausedMs) {
        s = reducer(s, { type: 'PAUSE_WORKOUT', now: T0 + pause.at });
        s = reducer(s, { type: 'RESUME_WORKOUT', now: T0 + pause.at + pause.ms });
      }
      s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: set.id, now: T0 + times[i] + (pause && pause.at <= times[i] ? pause.ms : 0) });
    });
    return s;
  }

  it('husker hvornår et sæt krydses af og glemmer det igen', () => {
    let s = benchWorkout(initialState(), [5000]);
    const we = s.active!.exercises[0];
    expect(we.sets[0]).toMatchObject({ done: true, doneAt: T0 + 5000, donePausedMs: 0 });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 + 9000 });
    expect(s.active!.exercises[0].sets[0].done).toBe(false);
    expect('doneAt' in s.active!.exercises[0].sets[0]).toBe(false);
    expect('donePausedMs' in s.active!.exercises[0].sets[0]).toBe(false);
  });

  it('regner pauser mellem afkrydsede sæt', () => {
    const s = benchWorkout(initialState(), [0, 160_000, 300_000]);
    const w = s.active!;
    expect(actualRests(w).map((r) => r.seconds)).toEqual([160, 140]);
    expect(actualRestBefore(w, w.exercises[0].sets[0].id)).toBeNull();
    expect(actualRestBefore(w, w.exercises[0].sets[1].id)).toBe(160);
  });

  it('trækker tid sat på pause fra', () => {
    // 5 min pause mellem sæt 1 og 2: sættet krydses af 160 s + 300 s efter sæt 1
    const s = benchWorkout(initialState(), [0, 160_000], { at: 60_000, ms: 300_000 });
    expect(actualRests(s.active!).map((r) => r.seconds)).toEqual([160]);
  });

  it('ignorerer sæt krydset af i ét hug (under 5 s)', () => {
    const s = benchWorkout(initialState(), [0, 2000, 90_000]);
    expect(actualRests(s.active!).map((r) => r.seconds)).toEqual([88]);
  });

  it('ignorerer huller over 15 min', () => {
    const s = benchWorkout(initialState(), [0, 20 * 60_000, 20 * 60_000 + 90_000]);
    expect(actualRests(s.active!).map((r) => r.seconds)).toEqual([90]);
  });

  it('opsummerer pauser for en træning', () => {
    let s = benchWorkout(initialState(), [0, 120_000, 270_000]);
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['curl'] });
    const we = s.active!.exercises[1];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: '10', reps: '10' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 + 330_000 });
    const sum = restSummary(s.active!, s)!;
    expect(sum.count).toBe(3);
    expect(sum.average).toBe(110); // (120 + 150 + 60) / 3
    expect(sum.planned).toBe(Math.round((180 + 180 + restFor(s, 'curl')) / 3));
    expect(sum.longest).toEqual({ exerciseId: 'bench', seconds: 135 });
    expect(restSummary(benchWorkout(initialState(), [0]).active!, s)).toBeNull();
  });

  it('finder den typiske pause for en øvelse', () => {
    let s = initialState();
    expect(typicalRest(s, 'bench')).toBeNull();
    s = reducer(benchWorkout(s, [0, 100_000, 220_000]), { type: 'FINISH_WORKOUT', now: T0 + 300_000 });
    expect(typicalRest(s, 'bench')).toBeNull(); // kun 2 pauser
    s = reducer(benchWorkout(s, [0, 150_000]), { type: 'FINISH_WORKOUT', now: T0 + 300_000 });
    expect(typicalRest(s, 'bench')).toBe(120); // median af 100, 120, 150
  });

  it('afrunder den typiske pause til 15 s (#317)', () => {
    expect(roundRestTo15(127)).toBe(120);
    expect(roundRestTo15(143)).toBe(150);
    expect(roundRestTo15(7)).toBe(0);
    expect(roundRestTo15(5000)).toBe(600);
  });

  it('gamle træninger uden tidsstempler loader og giver ingen pauser', () => {
    const old = {
      ...initialState(),
      history: [
        {
          id: 'w1', name: 'Gammel', startedAt: T0, finishedAt: T0 + 3_600_000,
          exercises: [{ id: 'e1', exerciseId: 'bench', sets: [
            { id: 's1', weight: '60', reps: '8', rpe: '', done: true },
            { id: 's2', weight: '60', reps: '8', rpe: '', done: true },
          ] }],
        },
      ],
    };
    const s = loadState(JSON.stringify(old));
    expect(s.history).toHaveLength(1);
    expect(actualRests(s.history[0])).toEqual([]);
    expect(typicalRest(s, 'bench')).toBeNull();
  });
});

describe('ugeplan (#322)', () => {
  const at = (d: number, h = 17) => new Date(2026, 10, 16 + d, h).getTime(); // 16/11-2026 er en mandag
  const w = (t: number, id: string) => ({ id, name: 'T', startedAt: t, finishedAt: t + 3_600_000, exercises: [] });

  it('viser planlagte og trænede dage i ugen', () => {
    let s = reducer(initialState(), { type: 'SET_TRAINING_DAYS', days: [4, 0, 2, 2] });
    expect(s.trainingDays).toEqual([0, 2, 4]);
    s = { ...s, history: [w(at(0), 'a'), w(at(0, 19), 'a2'), w(at(1), 'b'), w(at(-1), 'old')] };
    const p = weekPlan(s, at(2, 9));
    expect(p.days[0]).toMatchObject({ planned: true, done: true, today: false });
    expect(p.days[1]).toMatchObject({ planned: false, done: true });
    expect(p.days[2]).toMatchObject({ planned: true, done: false, today: true });
    expect(p.plannedCount).toBe(3);
    expect(p.doneCount).toBe(2);
    expect(p.missing).toBe(1);
    expect(p.todayIsTrainingDay).toBe(true);
    expect(p.daysLeft).toBe(4);
  });

  it('påminder sidst på ugen kun når det stadig kan nås (#324)', () => {
    const s = { ...reducer(initialState(), { type: 'SET_TRAINING_DAYS', days: [0, 2, 4, 6] }), history: [w(at(0), 'a'), w(at(2), 'b')] };
    expect(weekPlanNudge(weekPlan(s, at(2, 20)))).toBeNull(); // onsdag: for tidligt
    expect(weekPlanNudge(weekPlan(s, at(4, 9)))).toEqual({ missing: 2, daysAvailable: 3 }); // fredag, ikke trænet endnu
    expect(weekPlanNudge(weekPlan({ ...s, history: [...s.history, w(at(4), 'c')] }, at(4, 20)))).toEqual({ missing: 1, daysAvailable: 2 });
    expect(weekPlanNudge(weekPlan(s, at(6, 9)))).toBeNull(); // søndag: 2 mangler, kun 1 dag
    const done = { ...s, history: [...s.history, w(at(4), 'c'), w(at(5), 'd')] };
    expect(weekPlanNudge(weekPlan(done, at(5, 20)))).toBeNull(); // planen er nået
  });

  it('ignorerer ugyldige dage og tom plan', () => {
    const s = reducer(initialState(), { type: 'SET_TRAINING_DAYS', days: [7, -1, 1.5, 3] });
    expect(s.trainingDays).toEqual([3]);
    const empty = weekPlan(initialState(), at(3));
    expect(empty.plannedCount).toBe(0);
    expect(empty.todayIsTrainingDay).toBe(false);
    expect(empty.missing).toBe(0);
    expect(reducer(s, { type: 'SET_TRAINING_DAYS', days: [3] })).toBe(s);
  });

  it('gamle data uden ugeplan loader uændret', () => {
    const old = { ...initialState(), history: [w(at(0), 'a')] } as Partial<AppState>;
    delete old.trainingDays;
    const s = loadState(JSON.stringify(old));
    expect(s.trainingDays).toEqual([]);
    expect(s.history).toHaveLength(1);
    expect(loadState(JSON.stringify({ ...old, trainingDays: [1, 9, 'x', 1] })).trainingDays).toEqual([1]);
  });

  it('ugeplanen flettes som de andre indstillinger', () => {
    const local = initialState();
    const remote = { ...initialState(), trainingDays: [0, 3], settingsAt: 5 };
    expect(mergeStates(local, remote).trainingDays).toEqual([0, 3]);
  });
});

describe('teknik-tips (#337)', () => {
  const withCustom = () =>
    reducer(initialState(), { type: 'ADD_CUSTOM_EXERCISE', id: 'my-ex', name: 'Hip thrust', muscle: 'Ben', equipment: 'Stang' });

  it('hver indbygget øvelse har 3–4 korte tips', () => {
    for (const ex of SEED_EXERCISES) {
      const cues = BUILT_IN_CUES[ex.id];
      expect(cues, ex.id).toBeDefined();
      expect(cues.length, ex.id).toBeGreaterThanOrEqual(3);
      expect(cues.length, ex.id).toBeLessThanOrEqual(4);
      for (const c of cues) {
        expect(c.trim().length, `${ex.id}: ${c}`).toBeGreaterThan(0);
        expect(c.length, `${ex.id}: ${c}`).toBeLessThanOrEqual(40);
      }
    }
    expect(exerciseCues(initialState(), 'bench')).toContain('Fødderne plantet i gulvet');
    expect(exerciseCues(initialState(), 'ukendt')).toEqual([]);
  });

  it('SET_EXERCISE_CUES gemmer trimmet tekst på en egen øvelse, og tom tekst fjerner den', () => {
    let s = withCustom();
    expect(exerciseCues(s, 'my-ex')).toEqual([]);
    s = reducer(s, { type: 'SET_EXERCISE_CUES', exerciseId: 'my-ex', cues: '  Skuldre på bænken \n\n  Pres gennem hælene  \n' });
    const ex = s.exercises.find((e) => e.id === 'my-ex')!;
    expect(ex.cues).toBe('Skuldre på bænken\nPres gennem hælene');
    expect(exerciseCues(s, 'my-ex')).toEqual(['Skuldre på bænken', 'Pres gennem hælene']);
    expect(reducer(s, { type: 'SET_EXERCISE_CUES', exerciseId: 'my-ex', cues: 'Skuldre på bænken\nPres gennem hælene' })).toBe(s);
    s = reducer(s, { type: 'SET_EXERCISE_CUES', exerciseId: 'my-ex', cues: '   \n ' });
    expect('cues' in s.exercises.find((e) => e.id === 'my-ex')!).toBe(false);
    expect(exerciseCues(s, 'my-ex')).toEqual([]);
  });

  it('indbyggede øvelser kan ikke få egne tips', () => {
    const s = initialState();
    expect(reducer(s, { type: 'SET_EXERCISE_CUES', exerciseId: 'bench', cues: 'Hej' })).toBe(s);
    expect(cleanCues('x'.repeat(2000)).length).toBeLessThanOrEqual(600);
  });

  it('ændringen stemples og overlever fletning og backup', () => {
    const phone = withCustom();
    const pc = trackedReducer(phone, { type: 'SET_EXERCISE_CUES', exerciseId: 'my-ex', cues: 'Hagen ind', at: 5000 });
    expect(pc.exercises.find((e) => e.id === 'my-ex')).toMatchObject({ cues: 'Hagen ind', updatedAt: 5000 });
    const merged = mergeStates(phone, pc);
    expect(exerciseCues(merged, 'my-ex')).toEqual(['Hagen ind']);
    const cleared = trackedReducer(pc, { type: 'SET_EXERCISE_CUES', exerciseId: 'my-ex', cues: '', at: 6000 });
    expect(exerciseCues(mergeStates(pc, cleared), 'my-ex')).toEqual([]);
    expect(exerciseCues(loadState(JSON.stringify(pc)), 'my-ex')).toEqual(['Hagen ind']);
  });

  it('gamle gemte data uden tips indlæses uændret', () => {
    const old = withCustom();
    const raw = JSON.stringify(old);
    const s = loadState(raw);
    expect(s.exercises).toEqual(old.exercises);
    expect(s.exercises.every((e) => e.cues === undefined)).toBe(true);
    expect(exerciseCues(s, 'squat').length).toBeGreaterThan(0);
  });
});

describe('pund (#344)', () => {
  it('omregner kg ↔ lb og afrunder visningen til 0,1', () => {
    expect(toDisplay(100, 'lb')).toBe(220.5);
    expect(toDisplay(100, 'kg')).toBe(100);
    expect(formatWeight(100, 'lb')).toBe('220,5 lb');
    expect(formatWeight(102.5, 'kg')).toBe('102,5 kg');
    expect(fromDisplay(80, 'kg')).toBe(80);
  });

  it('hele og halve pund kommer tilbage som samme tal', () => {
    for (let lb = 0.5; lb <= 1000; lb += 0.5) {
      expect(toDisplay(fromDisplay(lb, 'lb'), 'lb')).toBe(lb);
    }
    expect(formatWeight(fromDisplay(225, 'lb'), 'lb')).toBe('225 lb');
  });

  it('formatSet viser pund, og kg er uændret', () => {
    const set = { id: 's', weight: String(fromDisplay(225, 'lb')), reps: '5', done: true, rpe: '' };
    expect(formatSet(set, false, 'lb')).toBe('225 lb × 5');
    const kg = { id: 'k', weight: '102.5', reps: '5', done: true, rpe: '' };
    expect(formatSet(kg)).toBe('102,5 kg × 5');
    expect(formatSet(kg, false, 'kg')).toBe('102,5 kg × 5');
    expect(formatSet({ id: 'r', weight: '', reps: '12', done: true, rpe: '' }, false, 'lb')).toBe('12 reps');
    expect(formatSet({ id: 'b', weight: '10', reps: '8', done: true, rpe: '' }, true, 'lb')).toBe('KV +22 × 8');
  });

  it('SET_UNIT ændrer indstillingen, stempler settingsAt, og gamle data læses som kg', () => {
    const s0 = initialState();
    expect(s0.unit).toBe('kg');
    const s1 = reducer(s0, { type: 'SET_UNIT', unit: 'lb' });
    expect(s1.unit).toBe('lb');
    expect(stampChanges(s0, s1, 1234).settingsAt).toBe(1234);
    expect(reducer(s1, { type: 'SET_UNIT', unit: 'lb' })).toBe(s1);
    expect(loadState(JSON.stringify(s1)).unit).toBe('lb');
    const old = JSON.parse(JSON.stringify(s0));
    delete old.unit;
    expect(loadState(JSON.stringify(old)).unit).toBe('kg');
    expect(loadState(JSON.stringify({ ...old, unit: 'stone' })).unit).toBe('kg');
  });
});

describe('vægtfeltet i pund (#345)', () => {
  it('lb indtastes som kg og vises som samme tal igen', () => {
    const kg = weightFromInput('225', 'lb');
    expect(kg).toBe('102.0583');
    expect(weightInputText(kg, 'lb')).toBe('225');
    expect(weightInputText(kg, 'kg')).toBe('102,1');
    expect(weightInputText(weightFromInput('132,5', 'lb'), 'lb')).toBe('132,5');
  });

  it('kg-indtastninger gemmes og vises som skrevet', () => {
    expect(weightFromInput('102,5', 'kg')).toBe('102,5');
    expect(weightInputText('102,5', 'kg')).toBe('102,5');
    expect(weightInputText('100', 'kg')).toBe('100');
    expect(weightInputText('100', 'lb')).toBe('220,5');
  });

  it('tomme felter og kropsvægt-assistance (−) virker i begge enheder', () => {
    expect(weightFromInput('', 'lb')).toBe('');
    expect(weightInputText('', 'lb')).toBe('');
    expect(weightInputText(weightFromInput('-45', 'lb'), 'lb')).toBe('-45');
    expect(weightFromInput('abc', 'lb')).toBe('abc');
  });
});

describe('pund uden for træningen (#346)', () => {
  it('samlet vægt, grafpunkter og delebillede vises i lb', () => {
    expect(formatTons(850)).toBe('850 kg');
    expect(formatTons(1000, 'lb')).toBe('2.205 lb');
    const p = { workoutId: 'w', date: new Date(2026, 10, 12, 18).getTime(), value: 116.7, set: { weight: 102.0583, reps: 5 }, record: false };
    expect(describeProgressPoint(p, 'reps', '1rm', 'lb')).toBe('12. nov. · 225 lb × 5 · est. 1RM 257,3 lb');
    const card = shareCardLines(
      {
        workoutId: 'w1', name: 'Bryst', startedAt: T0, durationMs: 0, volume: 1000, sets: 1,
        records: [], recordCount: 0, volumeChangePct: null, previousVolume: null,
        goals: [{ goalId: 'g1', exerciseId: 'bench', name: 'Bænkpres', weight: 142.8816, reps: 1 }],
      },
      'lb',
    );
    expect(card.stats.find((x) => x.label === 'Volumen')?.value).toBe('2204,6 lb');
    expect(card.records).toEqual(['🎯 Mål nået: Bænkpres 315 lb × 1']);
  });

  it('"Mod sidst" viser lb for vægtøvelser, men sek. og m uændret', () => {
    const row = { weId: 'a', exerciseId: 'bench', name: 'Bænkpres', unit: 'kg' as const, doneSets: 1, complete: true, now: 100, last: 90, lastTotal: 90, status: null };
    expect(vsRowCells(row, 'lb')).toEqual({ now: '220,5 lb', last: '198,4 lb' });
    expect(vsRowCells({ ...row, unit: 'sek' }, 'lb').now).toBe('100 sek.');
  });

  it('CSV-eksport er altid i kg, uanset enhed', () => {
    let s = startWith(initialState());
    s = reducer(s, { type: 'ADD_EXERCISES', exerciseIds: ['bench'] });
    const we = s.active!.exercises[0];
    s = reducer(s, { type: 'UPDATE_SET', weId: we.id, setId: we.sets[0].id, patch: { weight: weightFromInput('225', 'lb'), reps: '5' } });
    s = reducer(s, { type: 'TOGGLE_SET', weId: we.id, setId: we.sets[0].id, now: T0 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: T0 });
    const kg = toCsv(s);
    const lb = toCsv(reducer(s, { type: 'SET_UNIT', unit: 'lb' }));
    expect(lb).toBe(kg);
    expect(lb.split('\n')[0]).toContain('Vægt (kg)');
    expect(lb).toContain('Bænkpres,1,102.0583,5,');
  });
});

describe('lb-skiver og -stang (#347)', () => {
  const lb = (n: number) => fromDisplay(n, 'lb');

  it('225 lb = 45 lb stang + 45 + 45 pr. side', () => {
    const s = initialState();
    expect(platesText(lb(225), s, 'lb')).toBe('45 + 45 pr. side');
    expect(platesText(lb(135), s, 'lb')).toBe('45 pr. side');
    expect(plateSetup(s, 'lb')).toEqual({ bar: 45, plates: DEFAULT_PLATES_LB });
    // kg er uændret
    expect(platesText(100, s, 'kg')).toBe('25 + 15 pr. side');
  });

  it('nærmeste vægt med lb-skiver runder til 5 lb', () => {
    const s = initialState();
    expect(toDisplay(nearestLoadableKg(lb(227), s, 'lb'), 'lb')).toBe(225);
    expect(toDisplay(nearestLoadableKg(lb(233), s, 'lb'), 'lb')).toBe(235);
    expect(toDisplay(nearestLoadableKg(lb(30), s, 'lb'), 'lb')).toBe(45);
  });

  it('opvarmning i lb bruger lb-stangen og spring på 5 lb', () => {
    const s = initialState();
    const sets = warmupSetsFor(lb(225), s, 'lb').map((w) => [toDisplay(w.weight, 'lb'), w.reps]);
    expect(sets).toEqual([
      [45, 10],
      [90, 5],
      [135, 3],
      [180, 2],
    ]);
  });

  it('stang og skiver ændres for den valgte enhed, uden at røre den anden', () => {
    let s = reducer(initialState(), { type: 'SET_UNIT', unit: 'lb' });
    s = reducer(s, { type: 'SET_BAR_WEIGHT', weight: 35 });
    s = reducer(s, { type: 'TOGGLE_PLATE', plate: 35 });
    expect(s.barWeightLb).toBe(35);
    expect(s.platesLb).not.toContain(35);
    expect(s.barWeight).toBe(20);
    expect(s.plates).toContain(15);
    s = reducer(s, { type: 'SET_UNIT', unit: 'kg' });
    s = reducer(s, { type: 'SET_BAR_WEIGHT', weight: 15 });
    expect(s.barWeight).toBe(15);
    expect(s.barWeightLb).toBe(35);
  });

  it('gamle stang- og skiveindstillinger indlæses uændret som kg', () => {
    const old = { ...initialState(), barWeight: 15, plates: [20, 10, 5] } as Record<string, unknown>;
    delete old.barWeightLb;
    delete old.platesLb;
    const s = loadState(JSON.stringify(old));
    expect(s.barWeight).toBe(15);
    expect(s.plates).toEqual([20, 10, 5]);
    expect(s.barWeightLb).toBe(45);
    expect(s.platesLb).toEqual(DEFAULT_PLATES_LB);
  });

  it('kropsvægt 180 lb gemmes præcist og vises som 81,6 kg', () => {
    const s = reducer(initialState(), { type: 'SET_BODY_WEIGHT', kg: lb(180) });
    expect(toDisplay(s.bodyWeight!, 'lb')).toBe(180);
    expect(toDisplay(s.bodyWeight!, 'kg')).toBe(81.6);
  });
});

describe('rep-maks-tabel (#354)', () => {
  const set = (w: number, r: number, warmup = false) =>
    ({ id: `s${w}x${r}${warmup}`, weight: String(w), reps: String(r), done: true, ...(warmup ? { warmup: true } : {}) }) as AppState['history'][number]['exercises'][number]['sets'][number];
  const wk = (id: string, t: number, sets: ReturnType<typeof set>[]) => ({
    id,
    name: 'Bryst',
    startedAt: t,
    finishedAt: t + 1,
    exercises: [{ id: `e-${id}`, exerciseId: 'bench', sets }],
  });
  const base = () => ({ ...initialState(), history: [wk('w1', 1000, [set(60, 10, true), set(100, 6), set(110, 3), set(120, 1)])] });

  it('100×6, 110×3, 120×1 → 1RM 120, 2RM/3RM 110, 5RM 100, 8RM–12RM tomme', () => {
    const rows = repMaxTable(base(), 'bench');
    const best = Object.fromEntries(rows.map((r) => [r.reps, r.best?.weight ?? null]));
    expect(best).toEqual({ 1: 120, 2: 110, 3: 110, 5: 100, 8: null, 10: null, 12: null });
    expect(rows[0].best?.workoutId).toBe('w1');
    expect(rows[0].best?.date).toBe(1000);
  });

  it('opvarmning ignoreres, og estimatet for 5 reps følger e1RM-formlen', () => {
    const rows = repMaxTable(base(), 'bench');
    // 60×10 er opvarmning → 10RM er stadig tom
    expect(rows.find((r) => r.reps === 10)?.best).toBeNull();
    const e1rm = Math.max(estimate1RM(100, 6), estimate1RM(110, 3), estimate1RM(120, 1));
    const five = rows.find((r) => r.reps === 5)!;
    expect(estimate1RM(five.estimated, 5)).toBeCloseTo(e1rm, 0);
    expect(five.estimated % 0.5).toBe(0);
    expect(rows[0].estimated).toBe(Math.round(e1rm * 2) / 2);
  });

  it('105×5 efter træningen ovenfor slår 5RM, men ikke 1–3RM; første gang er ingen rekord', () => {
    const s = base();
    s.history = [...s.history, wk('w2', 2000, [set(105, 5)])];
    expect(repMaxesBeaten(s, 'w2', 'bench')).toEqual([5]);
    expect(repMaxesBeaten(s, 'w1', 'bench')).toEqual([]);
  });

  it('tidsøvelser har ingen rækker, og gamle data indlæses uændret', () => {
    expect(repMaxTable(base(), 'plank')).toEqual([]);
    const s = base();
    expect(loadState(JSON.stringify(s)).history).toEqual(s.history);
  });

  it('workoutRepMaxes: kun det højeste slåede rep-antal pr. øvelse, med linjen "Ny 5RM" (#356)', () => {
    const s = { ...initialState(), history: [wk('w1', 1000, [set(100, 5)]), wk('w2', 2000, [set(105, 5), set(80, 8, true)])] };
    // 105×5 slår 1-, 2-, 3- og 5RM, men kun 5RM vises
    expect(workoutRepMaxes(s, 'w2')).toEqual([{ exerciseId: 'bench', name: 'Bænkpres', reps: 5, weight: 105 }]);
    expect(workoutRepMaxes(s, 'w1')).toEqual([]);
    expect(repMaxLine(workoutRepMaxes(s, 'w2')[0])).toBe('🏆 Ny 5RM i Bænkpres: 105 kg');
  });

  it('"stærk" når det faktiske sæt er over estimatet (#355)', () => {
    const rows = repMaxTable(base(), 'bench');
    // e1RM kommer fra 110×3 / 120×1 → 5RM-estimatet er højere end 100 → ikke stærk; tom række er aldrig stærk
    expect(isStrongRepMax(rows.find((r) => r.reps === 5)!)).toBe(false);
    expect(isStrongRepMax(rows.find((r) => r.reps === 8)!)).toBe(false);
    expect(isStrongRepMax({ reps: 5, best: { weight: 105, reps: 5, date: 1, workoutId: 'w' }, estimated: 100 })).toBe(true);
  });
});

describe('står stille (#360)', () => {
  const set = (w: number, r: number, extra: Partial<AppState['history'][number]['exercises'][number]['sets'][number]> = {}) =>
    ({ id: uid(), weight: String(w), reps: String(r), done: true, ...extra }) as AppState['history'][number]['exercises'][number]['sets'][number];
  const wk = (n: number, sets: ReturnType<typeof set>[], exerciseId = 'bench') => ({
    id: `w${n}`,
    name: 'Bryst',
    startedAt: n * 86400000,
    finishedAt: n * 86400000 + 3600000,
    exercises: [{ id: `e${n}`, exerciseId, sets }],
  });
  const stateWith = (...workouts: ReturnType<typeof wk>[]): AppState => ({ ...initialState(), history: [...workouts].reverse() });
  const flat = (n: number) => Array.from({ length: n }, (_, i) => wk(i + 1, [set(40, 10, { warmup: true }), set(100, 5), set(100, 5), set(100, 5)]));

  it('4 træninger med bænkpres 100 kg × 5 uden ny bedste → står stille, let uge 90 kg', () => {
    const s = stateWith(...flat(4));
    const st = exerciseStall(s, 'bench');
    expect(st).toMatchObject({ exerciseId: 'bench', name: 'Bænkpres', sessions: 4, lastWeight: 100, lightWeight: 90 });
    expect(st!.best).toBe(estimate1RM(100, 5));
    expect(stalledExercises(s).map((x) => x.exerciseId)).toEqual(['bench']);
  });

  it('ny bedste e1RM i en af de seneste 3 → står ikke stille; under 4 træninger → står ikke stille', () => {
    const w = flat(4);
    w[2] = wk(3, [set(102.5, 5)]);
    expect(exerciseStall(stateWith(...w), 'bench')).toBeNull();
    expect(exerciseStall(stateWith(...flat(3)), 'bench')).toBeNull();
  });

  it('samme topvægt og færre reps hver gang → står stille, selv om der var en ny bedste for nylig', () => {
    const s = stateWith(wk(1, [set(90, 5)]), wk(2, [set(100, 6), set(100, 6)]), wk(3, [set(100, 6), set(100, 5)]), wk(4, [set(100, 5), set(100, 4)]));
    const st = exerciseStall(s, 'bench');
    expect(st).not.toBeNull();
    expect(st!.sessions).toBe(3);
  });

  it('opvarmning og drop-sæt tæller ikke; let uge rundes til 2,5 kg (1 kg for håndvægte)', () => {
    const w = flat(4);
    w[3] = wk(4, [set(100, 5), set(150, 10, { warmup: true }), set(130, 8, { tag: 'drop' })]);
    expect(exerciseStall(stateWith(...w), 'bench')?.lightWeight).toBe(90);
    const odd = Array.from({ length: 4 }, (_, i) => wk(i + 1, [set(87.5, 5)]));
    expect(exerciseStall(stateWith(...odd), 'bench')?.lightWeight).toBe(80); // 78,75 → 80
    const db = initialState().exercises.find((e) => e.equipment === 'Håndvægt')!;
    const dbw = Array.from({ length: 4 }, (_, i) => wk(i + 1, [set(27, 8)], db.id));
    expect(exerciseStall(stateWith(...dbw), db.id)?.lightWeight).toBe(24); // 24,3 → 24
  });

  it('kropsvægts- og tidsøvelser står aldrig stille', () => {
    const bw = initialState().exercises.find((e) => e.equipment === 'Kropsvægt' && (e.kind ?? 'reps') === 'reps')!;
    const w = Array.from({ length: 5 }, (_, i) => wk(i + 1, [set(0, 8)], bw.id));
    expect(exerciseStall(stateWith(...w), bw.id)).toBeNull();
  });

  it('"Skjul" skjuler den; ny bedste eller 3 træninger mere får den frem igen', () => {
    let s = stateWith(...flat(4));
    s = reducer(s, { type: 'DISMISS_STALL', exerciseId: 'bench' });
    expect(s.stallDismissed.bench).toEqual({ best: estimate1RM(100, 5), sessions: 4 });
    expect(isStallDismissed(s, 'bench')).toBe(true);
    expect(stalledExercises(s)).toEqual([]);
    // 2 træninger mere uden fremgang: stadig skjult; den 3. får den frem igen
    const more = (n: number) => ({ ...s, history: [...flat(4 + n)].reverse() });
    expect(stalledExercises(more(2))).toEqual([]);
    expect(stalledExercises(more(3)).map((x) => x.exerciseId)).toEqual(['bench']);
    // Ny bedste e1RM, og bagefter står den stille igen → vises
    const again = [...flat(4), wk(5, [set(105, 5)]), ...[6, 7, 8].map((n) => wk(n, [set(100, 5)]))];
    expect(stalledExercises({ ...s, history: again.reverse() }).map((x) => x.exerciseId)).toEqual(['bench']);
  });

  it('"Skjul" følger med i synk-indstillingerne', () => {
    const s = trackedReducer(stateWith(...flat(4)), { type: 'DISMISS_STALL', exerciseId: 'bench', at: 5000 });
    expect(s.settingsAt).toBe(5000);
    const merged = mergeStates(stateWith(...flat(4)), s);
    expect(merged.stallDismissed.bench).toBeDefined();
  });

  it('gamle data uden feltet indlæses med de samme træninger', () => {
    const s = stateWith(...flat(4));
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.stallDismissed;
    const loaded = loadState(JSON.stringify(old));
    expect(loaded.history).toEqual(s.history);
    expect(loaded.stallDismissed).toEqual({});
    expect(loadState(JSON.stringify({ ...old, stallDismissed: { bench: { best: 'x' }, squat: { best: 100, sessions: 4 } } })).stallDismissed).toEqual({
      squat: { best: 100, sessions: 4 },
    });
  });
});

describe('let uge (#361)', () => {
  const set = (w: string, r: string, extra: Partial<AppState['history'][number]['exercises'][number]['sets'][number]> = {}) =>
    ({ id: uid(), weight: w, reps: r, rpe: '', done: false, ...extra }) as AppState['history'][number]['exercises'][number]['sets'][number];
  const withActive = (sets: ReturnType<typeof set>[]): AppState => ({
    ...initialState(),
    active: { id: 'a', name: 'Bryst', startedAt: 1, exercises: [{ id: 'we1', exerciseId: 'bench', sets }, { id: 'we2', exerciseId: 'squat', sets: [set('', '')] }] },
  });

  it('"Let uge" fylder kun tomme arbejdssæt og sætter deload-flaget', () => {
    const s = withActive([
      set('40', '10', { warmup: true }),
      set('100', '5', { done: true }),
      set('', ''),
      set('', '3'),
      set('95', ''),
      set('', '', { tag: 'drop' }),
    ]);
    const next = reducer(s, { type: 'APPLY_DELOAD', weId: 'we1', weight: '90', reps: 5 });
    const sets = next.active!.exercises[0].sets;
    expect(sets.map((x) => [x.weight, x.reps])).toEqual([
      ['40', '10'],
      ['100', '5'],
      ['90', '5'],
      ['90', '3'],
      ['95', ''],
      ['', ''],
    ]);
    expect(next.active!.deload).toBe(true);
    // Andre øvelser røres ikke
    expect(next.active!.exercises[1].sets[0].weight).toBe('');
  });

  it('deload-flaget bevares, når træningen afsluttes', () => {
    let s = reducer(withActive([set('', '')]), { type: 'APPLY_DELOAD', weId: 'we1', weight: '90', reps: 5 });
    s = reducer(s, { type: 'TOGGLE_SET', weId: 'we1', setId: s.active!.exercises[0].sets[0].id, now: 2 });
    s = reducer(s, { type: 'FINISH_WORKOUT', now: 3 });
    expect(s.history[0].deload).toBe(true);
    // gamle træninger uden flaget indlæses uændret
    const old = { ...initialState(), history: [{ id: 'o', name: 'x', startedAt: 1, finishedAt: 2, exercises: [] }] };
    expect(loadState(JSON.stringify(old)).history[0]).toEqual(old.history[0]);
  });

  it('let vægt i kg og lb, og teksten til kortet', () => {
    const stall = { exerciseId: 'bench', name: 'Bænkpres', best: 116.7, sessions: 4, lastWeight: 100, lastReps: 5, lightWeight: 90 };
    expect(deloadWeightInput(stall)).toBe('90');
    expect(deloadWeightInput({ ...stall, lightWeight: 92.5 })).toBe('92,5');
    expect(deloadWeightText(stall, 'lb')).toBe('200 lb'); // 220,5 lb × 0,9 = 198,4 → 200
    expect(stallText(stall)).toBe('Bænkpres står stille (4 træninger) – prøv en let uge med 90 kg');
  });
});
