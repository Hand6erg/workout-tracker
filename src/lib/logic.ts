import { SEED_EXERCISES, SEED_TEMPLATES } from './seed';
import { MUSCLES } from './types';
import type {
  AppState,
  Equipment,
  Exercise,
  ExerciseKind,
  Muscle,
  SetEntry,
  Template,
  Workout,
  WorkoutExercise,
} from './types';

let counter = 0;
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_BAR = 20;
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function initialState(): AppState {
  return {
    version: 1,
    exercises: SEED_EXERCISES,
    templates: SEED_TEMPLATES,
    history: [],
    active: null,
    editing: null,
    lastFinishedId: null,
    rest: null,
    restSeconds: 90,
    barWeight: DEFAULT_BAR,
    plates: [...DEFAULT_PLATES],
    bodyLog: [],
    weeklyGoal: 2,
    showHints: true,
    restSound: true,
    restVibrate: true,
    keepAwake: true,
    recapDismissed: null,
    program: [],
    programSkip: { after: null, n: 0 },
    settingsAt: 0,
    deleted: {},
  };
}

/* ---------- Beregninger ---------- */

export function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Estimeret 1RM med Epley-formlen. 1 rep = selve vægten. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Udført arbejdssæt (ikke opvarmning) */
export function isWorkSet(s: SetEntry): boolean {
  return s.done && !s.warmup;
}

/** Tids- eller distancesæt (#133): har sekunder eller meter, men ingen reps */
export function isTimedSet(s: SetEntry): boolean {
  return !s.reps.trim() && ((s.seconds ?? '').trim() !== '' || (s.meters ?? '').trim() !== '');
}

/** Løftet vægt i et sæt. Tids- og distancesæt tæller ikke med (#136). */
export function setVolume(s: SetEntry): number {
  if (isTimedSet(s)) return 0;
  return num(s.weight) * num(s.reps);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(isWorkSet).reduce((a, s) => a + setVolume(s), 0),
    0,
  );
}

export function doneSetCount(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
}

/** Hvordan en øvelse logges (#133). Ukendte øvelser og øvelser uden type er vægt × reps. */
export function exerciseKind(state: Pick<AppState, 'exercises'>, exerciseId: string): ExerciseKind {
  const kind = state.exercises.find((e) => e.id === exerciseId)?.kind;
  return kind === 'time' || kind === 'distance' ? kind : 'reps';
}

/** Er sættets hovedfelt udfyldt? Reps for vægt × reps, sekunder for tid, meter for distance. */
export function isSetFilled(s: SetEntry, kind: ExerciseKind = 'reps'): boolean {
  const v = kind === 'time' ? s.seconds : kind === 'distance' ? s.meters : s.reps;
  return (v ?? '').trim() !== '';
}

/** Sæt der er udfyldt, men som ikke er krydset af */
export function uncheckedFilledCount(w: Workout, state?: Pick<AppState, 'exercises'>): number {
  return w.exercises.reduce(
    (n, ex) => n + ex.sets.filter((s) => !s.done && isSetFilled(s, state ? exerciseKind(state, ex.exerciseId) : 'reps')).length,
    0,
  );
}

/** Bedste sæt (højeste estimerede 1RM) for en øvelse i en træning */
export function bestSet(sets: SetEntry[]): SetEntry | null {
  let best: SetEntry | null = null;
  let bestScore = -1;
  for (const s of sets) {
    if (!isWorkSet(s)) continue;
    const score = estimate1RM(num(s.weight), num(s.reps)) || num(s.reps) || num(s.meters ?? '') || num(s.seconds ?? '');
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatKg(n: number): string {
  return `${Math.round(n * 10) / 10} kg`.replace('.', ',');
}

/** Sekunder som m:ss (fx 125 → "2:05") */
export function formatClock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Læser en tid skrevet som "2:05" (m:ss) eller "125" (sekunder). Tom/ugyldig = null. */
export function parseClock(text: string): number | null {
  const m = /^\s*(\d+)\s*(?:[:.,]\s*(\d{0,2}))?\s*$/.exec(text);
  if (!m) return null;
  return m[2] === undefined ? Number(m[1]) : Number(m[1]) * 60 + Number(m[2] || 0);
}

/** Sekunder et kørende stopur har talt (0 hvis det ikke kører) */
export function stopwatchSeconds(s: SetEntry, now: number): number {
  return s.timerStartedAt ? Math.max(0, Math.round((now - s.timerStartedAt) / 1000)) : 0;
}

/** Stopper et kørende stopur: sekunderne skrives i sættet */
function stopTimer(s: SetEntry, now: number): SetEntry {
  if (!s.timerStartedAt) return s;
  const { timerStartedAt: _t, ...rest } = s;
  return { ...rest, seconds: String(stopwatchSeconds(s, now)) };
}

/** Sættet som tekst. Typen følger de udfyldte felter, så gamle sæt (kun reps) vises som før. */
export function formatSet(s: SetEntry): string {
  if ((s.meters ?? '').trim()) {
    const sec = num(s.seconds ?? '');
    return `${s.meters!.trim().replace('.', ',')} m${sec > 0 ? ` · ${formatClock(sec)}` : ''}`;
  }
  if ((s.seconds ?? '').trim() && !s.reps.trim()) return `${num(s.seconds!)} sek.`;
  const w = num(s.weight);
  return w ? `${s.weight.replace('.', ',')} kg × ${s.reps}` : `${s.reps} reps`;
}

/** De seneste udførte sæt for en øvelse (fra historikken, nyeste først) */
export function previousSets(history: Workout[], exerciseId: string): SetEntry[] {
  for (const w of history) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) {
      const done = ex.sets.filter(isWorkSet);
      if (done.length) return done;
    }
  }
  return [];
}

/** "Forrige" sæt for en øvelse i en træning: fra den gentagne træning (#149), ellers seneste gang */
export function previousSetsFor(history: Workout[], w: Pick<Workout, 'id' | 'repeatOf'> | null | undefined, exerciseId: string): SetEntry[] {
  if (w?.repeatOf) {
    const src = history.find((h) => h.id === w.repeatOf && h.id !== w.id);
    const sets = src?.exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter(isWorkSet) ?? [];
    if (sets.length) return sets;
  }
  return previousSets(history, exerciseId);
}

/* ---------- Rekorder ---------- */

export type RecordKind = 'heaviest' | '1rm' | 'reps' | 'hold' | 'distance' | 'pace';

export interface PersonalRecords {
  /** Tungeste vægt løftet (med reps og dato) */
  heaviest?: { weight: number; reps: number; date: number };
  /** Højeste estimerede 1RM */
  best1RM?: { value: number; weight: number; reps: number; date: number };
  /** Flest reps pr. vægt, nøgle = vægt i kg */
  repsAtWeight: Record<string, { reps: number; date: number }>;
  /** Længste hold for tidsøvelser (#136) */
  longestHold?: { seconds: number; date: number };
  /** Længste distance for distanceøvelser (#136) */
  longestDistance?: { meters: number; seconds: number; date: number };
  /** Hurtigste tempo (sekunder pr. meter) for distanceøvelser med tid (#136) */
  fastest?: { meters: number; seconds: number; pace: number; date: number };
}

interface ScoredSet {
  weight: number;
  reps: number;
  seconds: number;
  meters: number;
  date: number;
}

/** Arbejdssæt der kan give rekorder. Typen afgør hvilke felter der tæller, så et tidssæt aldrig giver en vægtrekord. */
function validSets(sets: SetEntry[], date: number, kind: ExerciseKind = 'reps'): ScoredSet[] {
  return sets
    .filter(isWorkSet)
    .map((s) =>
      kind === 'reps'
        ? { weight: num(s.weight), reps: isTimedSet(s) ? 0 : num(s.reps), seconds: 0, meters: 0, date }
        : kind === 'time'
          ? { weight: 0, reps: 0, seconds: num(s.seconds ?? ''), meters: 0, date }
          : { weight: 0, reps: 0, seconds: num(s.seconds ?? ''), meters: num(s.meters ?? ''), date },
    )
    .filter((s) => s.reps > 0 || (kind === 'time' && s.seconds > 0) || (kind === 'distance' && s.meters > 0));
}

function recordsFrom(sets: ScoredSet[]): PersonalRecords {
  const r: PersonalRecords = { repsAtWeight: {} };
  for (const s of sets) {
    if (s.meters > 0) {
      if (!r.longestDistance || s.meters > r.longestDistance.meters) r.longestDistance = { meters: s.meters, seconds: s.seconds, date: s.date };
      const pace = s.seconds / s.meters;
      if (s.seconds > 0 && (!r.fastest || pace < r.fastest.pace)) r.fastest = { meters: s.meters, seconds: s.seconds, pace, date: s.date };
      continue;
    }
    if (s.seconds > 0) {
      if (!r.longestHold || s.seconds > r.longestHold.seconds) r.longestHold = { seconds: s.seconds, date: s.date };
      continue;
    }
    if (s.reps <= 0) continue;
    if (s.weight > 0 && (!r.heaviest || s.weight > r.heaviest.weight)) r.heaviest = { ...s };
    const e = estimate1RM(s.weight, s.reps);
    if (e > 0 && (!r.best1RM || e > r.best1RM.value)) r.best1RM = { value: e, ...s };
    const key = String(s.weight);
    if (!r.repsAtWeight[key] || s.reps > r.repsAtWeight[key].reps) r.repsAtWeight[key] = { reps: s.reps, date: s.date };
  }
  return r;
}

function historySets(history: Workout[], exerciseId: string, kind: ExerciseKind): ScoredSet[] {
  return history.flatMap((w) =>
    w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => validSets(e.sets, w.startedAt, kind)),
  );
}

/** Rekorder for en øvelse ud fra afsluttede træninger */
export function personalRecords(state: AppState, exerciseId: string): PersonalRecords {
  return recordsFrom(historySets(state.history, exerciseId, exerciseKind(state, exerciseId)));
}

/**
 * Hvilke rekorder slår et udført sæt? Sammenlignes med afsluttede træninger og
 * de udførte sæt før det i den aktive træning. Første gang en øvelse laves er ingen rekord.
 */
export function recordsBrokenBy(state: AppState, exerciseId: string, set: SetEntry): RecordKind[] {
  const kind = exerciseKind(state, exerciseId);
  const [candidate] = validSets([set], 0, kind);
  if (!candidate) return [];
  const earlier: ScoredSet[] = historySets(state.history, exerciseId, kind);
  outer: for (const we of state.active?.exercises ?? []) {
    if (we.exerciseId !== exerciseId) continue;
    for (const s of we.sets) {
      if (s.id === set.id) break outer;
      earlier.push(...validSets([s], 0, kind));
    }
  }
  if (!earlier.length) return [];
  const prev = recordsFrom(earlier);
  const broken: RecordKind[] = [];
  if (kind !== 'reps') {
    const { seconds, meters } = candidate;
    if (kind === 'time' && prev.longestHold && seconds > prev.longestHold.seconds) broken.push('hold');
    if (kind === 'distance' && prev.longestDistance && meters > prev.longestDistance.meters) broken.push('distance');
    if (kind === 'distance' && seconds > 0 && prev.fastest && seconds / meters < prev.fastest.pace) broken.push('pace');
    return broken;
  }
  if (candidate.weight > 0 && prev.heaviest && candidate.weight > prev.heaviest.weight) broken.push('heaviest');
  const e = estimate1RM(candidate.weight, candidate.reps);
  if (e > 0 && prev.best1RM && e > prev.best1RM.value) broken.push('1rm');
  const atWeight = prev.repsAtWeight[String(candidate.weight)];
  if (atWeight && candidate.reps > atWeight.reps) broken.push('reps');
  return broken;
}

/** Rekorder slået i en afsluttet træning (pr. øvelse), sammenlignet med træninger før den */
export function workoutRecords(state: AppState, workoutId: string): Record<string, RecordKind[]> {
  const w = state.history.find((x) => x.id === workoutId);
  if (!w) return {};
  const before: AppState = { ...state, history: state.history.filter((x) => x.startedAt < w.startedAt), active: w };
  const out: Record<string, RecordKind[]> = {};
  for (const we of w.exercises) {
    const kinds = new Set<RecordKind>(out[we.exerciseId] ?? []);
    for (const s of we.sets) for (const k of recordsBrokenBy(before, we.exerciseId, s)) kinds.add(k);
    if (kinds.size) out[we.exerciseId] = [...kinds];
  }
  return out;
}

/** Antal rekorder i en træning (hver type tæller én gang pr. øvelse) */
export function recordCount(records: Record<string, RecordKind[]>): number {
  return Object.values(records).reduce((n, k) => n + k.length, 0);
}

/* ---------- Rekordvæg (#162) ---------- */

/** Én række på rekordvæggen: de bedste resultater for én øvelse */
export interface RecordsWallRow {
  exerciseId: string;
  name: string;
  muscle: Muscle;
  kind: ExerciseKind;
  /** Tungeste vægt løftet */
  heaviest?: { weight: number; reps: number; date: number };
  /** Højeste estimerede 1RM */
  best1RM?: { value: number; weight: number; reps: number; date: number };
  /** Mest volumen i ét sæt (vægt × reps) */
  bestVolume?: { volume: number; weight: number; reps: number; date: number };
  /** Flest reps i ét sæt (fx kropsvægtsøvelser uden ekstra vægt) */
  mostReps?: { reps: number; weight: number; date: number };
  /** Længste hold (tidsøvelser) */
  longestHold?: { seconds: number; date: number };
  /** Længste distance (distanceøvelser) */
  longestDistance?: { meters: number; seconds: number; date: number };
  /** Datoen for den nyeste af rækkens rekorder */
  latest: number;
}

/**
 * Alle dine rekorder samlet (#162): én række pr. øvelse med udførte arbejdssæt
 * (opvarmning tæller aldrig), nyeste rekord først. Valgfrit filter på muskelgruppe.
 */
export function recordsWall(state: AppState, muscle?: Muscle): RecordsWallRow[] {
  const rows: RecordsWallRow[] = [];
  for (const ex of state.exercises) {
    if (muscle && ex.muscle !== muscle) continue;
    const kind = exerciseKind(state, ex.id);
    const sets = historySets(state.history, ex.id, kind);
    if (!sets.length) continue;
    const r = recordsFrom(sets);
    const row: RecordsWallRow = { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, kind, latest: 0 };
    if (kind === 'reps') {
      if (r.heaviest) row.heaviest = { weight: r.heaviest.weight, reps: r.heaviest.reps, date: r.heaviest.date };
      if (r.best1RM) row.best1RM = { value: r.best1RM.value, weight: r.best1RM.weight, reps: r.best1RM.reps, date: r.best1RM.date };
      for (const s of sets) {
        const volume = s.weight * s.reps;
        if (volume > 0 && (!row.bestVolume || volume > row.bestVolume.volume)) row.bestVolume = { volume, weight: s.weight, reps: s.reps, date: s.date };
        if (s.reps > 0 && (!row.mostReps || s.reps > row.mostReps.reps)) row.mostReps = { reps: s.reps, weight: s.weight, date: s.date };
      }
    }
    if (r.longestHold) row.longestHold = r.longestHold;
    if (r.longestDistance) row.longestDistance = r.longestDistance;
    const dates = [row.heaviest, row.best1RM, row.bestVolume, row.mostReps, row.longestHold, row.longestDistance].map((x) => x?.date ?? 0);
    row.latest = Math.max(...dates);
    rows.push(row);
  }
  return rows.sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name, 'da'));
}

/** Træninger i en kalendermåned (0 = januar) */
function workoutsInMonth(state: AppState, year: number, month: number): Workout[] {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return state.history.filter((w) => w.startedAt >= start && w.startedAt < end);
}

/** Antal rekorder sat i indeværende kalendermåned (#162) – samme optælling som 🏆 under træningen */
export function newRecordsInMonth(state: AppState, now: number): number {
  const d = new Date(now);
  return recordsInMonth(state, d.getFullYear(), d.getMonth());
}

function recordsInMonth(state: AppState, year: number, month: number): number {
  return workoutsInMonth(state, year, month).reduce((n, w) => n + recordCount(workoutRecords(state, w.id)), 0);
}

/* ---------- Månedens opsummering (#168) ---------- */

export interface MonthStats {
  workouts: number;
  /** Samlet træningstid i ms (pauser tæller ikke med) */
  durationMs: number;
  /** Løftet vægt i kg (udførte arbejdssæt) */
  volume: number;
  /** Rekorder 🏆 sat i måneden */
  records: number;
  /** Muskelgruppen med flest arbejdssæt (null = ingen sæt) */
  topMuscle: Muscle | null;
  /** Øvelsen med flest arbejdssæt */
  favourite: { exerciseId: string; name: string; sets: number } | null;
  /** Flest træningsdage i træk */
  longestStreak: number;
}

export interface MonthRecap extends MonthStats {
  year: number;
  /** 0 = januar */
  month: number;
  /** "2026-10" */
  key: string;
  /** Samme tal for måneden før */
  previous: MonthStats;
  /** Træninger i forhold til måneden før (+3 / -1) */
  workoutsDiff: number;
  /** Ændring i volumen i hele procent (null når måneden før var tom) */
  volumeChangePct: number | null;
}

/** "2026-10" for oktober 2026 (month: 0 = januar) */
export function monthKey(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStats(state: AppState, year: number, month: number): MonthStats {
  const list = workoutsInMonth(state, year, month);
  const ex = new Map(state.exercises.map((e) => [e.id, e]));
  const muscleSets = new Map<Muscle, number>();
  const exSets = new Map<string, number>();
  const days = new Set<number>();
  let durationMs = 0;
  let volume = 0;
  for (const w of list) {
    durationMs += workoutDuration(w, w.finishedAt ?? w.startedAt);
    volume += workoutVolume(w);
    days.add(new Date(w.startedAt).getDate());
    for (const we of w.exercises) {
      const n = we.sets.filter(isWorkSet).length;
      if (!n) continue;
      exSets.set(we.exerciseId, (exSets.get(we.exerciseId) ?? 0) + n);
      const m = ex.get(we.exerciseId)?.muscle;
      if (m) muscleSets.set(m, (muscleSets.get(m) ?? 0) + n);
    }
  }
  const top = <K>(m: Map<K, number>): [K, number] | null =>
    [...m.entries()].reduce<[K, number] | null>((best, e) => (!best || e[1] > best[1] ? e : best), null);
  const topMuscle = top(muscleSets);
  const fav = top(exSets);
  let longestStreak = 0;
  let run = 0;
  for (let day = 1; day <= 31; day++) {
    run = days.has(day) ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }
  return {
    workouts: list.length,
    durationMs,
    volume,
    records: recordsInMonth(state, year, month),
    topMuscle: topMuscle?.[0] ?? null,
    favourite: fav ? { exerciseId: fav[0], name: ex.get(fav[0])?.name ?? fav[0], sets: fav[1] } : null,
    longestStreak,
  };
}

/** Månedens opsummering (#168): tal for måneden (0 = januar) og sammenligning med måneden før */
export function monthRecap(state: AppState, year: number, month: number): MonthRecap {
  const d = new Date(year, month, 1);
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const stats = monthStats(state, d.getFullYear(), d.getMonth());
  const previous = monthStats(state, prev.getFullYear(), prev.getMonth());
  return {
    ...stats,
    year: d.getFullYear(),
    month: d.getMonth(),
    key: monthKey(d.getFullYear(), d.getMonth()),
    previous,
    workoutsDiff: stats.workouts - previous.workouts,
    volumeChangePct: previous.volume > 0 ? Math.round(((stats.volume - previous.volume) / previous.volume) * 100) : null,
  };
}

/* ---------- Opsummering af en træning (#142) ---------- */

export interface WorkoutSummary {
  workoutId: string;
  name: string;
  startedAt: number;
  /** Varighed i ms (pauser tæller ikke med) */
  durationMs: number;
  /** Løftet vægt i kg (udførte arbejdssæt) */
  volume: number;
  /** Udførte sæt */
  sets: number;
  /** Nye rekorder pr. øvelse i denne træning */
  records: { exerciseId: string; name: string; kinds: RecordKind[] }[];
  recordCount: number;
  /** Ændring i volumen i hele procent siden sidste træning fra samme skabelon (null = intet at sammenligne med) */
  volumeChangePct: number | null;
  previousVolume: number | null;
}

/** Den seneste afsluttede træning fra samme skabelon før `w` */
function previousFromTemplate(history: Workout[], w: Workout): Workout | null {
  if (!w.templateId) return null;
  return (
    history
      .filter((x) => x.id !== w.id && x.templateId === w.templateId && x.finishedAt && x.startedAt < w.startedAt)
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

/** Opsummering af en afsluttet træning: varighed, volumen, sæt, nye rekorder og sammenligning med sidst */
export function workoutSummary(state: AppState, workoutId: string): WorkoutSummary | null {
  const w = state.history.find((x) => x.id === workoutId);
  if (!w) return null;
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const recs = workoutRecords(state, w.id);
  const records = Object.entries(recs).map(([exerciseId, kinds]) => ({ exerciseId, name: names.get(exerciseId) ?? exerciseId, kinds }));
  const volume = workoutVolume(w);
  const prev = previousFromTemplate(state.history, w);
  const previousVolume = prev ? workoutVolume(prev) : null;
  const volumeChangePct = previousVolume ? Math.round(((volume - previousVolume) / previousVolume) * 100) : null;
  return {
    workoutId: w.id,
    name: w.name,
    startedAt: w.startedAt,
    durationMs: workoutDuration(w, w.finishedAt ?? w.startedAt),
    volume,
    sets: doneSetCount(w),
    records,
    recordCount: recordCount(recs),
    volumeChangePct,
    previousVolume: previousVolume || null,
  };
}

const MONTHS_DA = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

/** Navne på rekordtyper, som de vises for brugeren */
export const RECORD_NAMES: Record<RecordKind, string> = {
  heaviest: 'tungeste vægt',
  '1rm': 'estimeret 1RM',
  reps: 'flest reps',
  hold: 'længste hold',
  distance: 'længste distance',
  pace: 'hurtigste tid',
};

/** "+25 % volumen siden sidst" (null når der ikke er noget at sammenligne med) */
export function volumeChangeText(pct: number | null): string | null {
  if (pct === null) return null;
  return `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)} % volumen siden sidst`;
}

export interface ShareCard {
  app: string;
  date: string;
  title: string;
  stats: { label: string; value: string }[];
  change: string | null;
  records: string[];
  fileName: string;
}

/** Teksten til delebilledet af en opsummering (#144) – ren funktion, så den kan testes */
export function shareCardLines(s: WorkoutSummary): ShareCard {
  const d = new Date(s.startedAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    app: 'Løft',
    date: `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${d.getFullYear()}`,
    title: s.name,
    stats: [
      { label: 'Tid', value: formatDuration(s.durationMs) },
      { label: 'Volumen', value: formatKg(s.volume) },
      { label: 'Sæt', value: `${s.sets} sæt` },
      { label: 'Rekorder', value: String(s.recordCount) },
    ],
    change: volumeChangeText(s.volumeChangePct),
    records: s.records.map((r) => `🏆 ${r.name} – ${r.kinds.map((k) => RECORD_NAMES[k]).join(', ')}`),
    fileName: `loeft-${iso}.png`,
  };
}

/* ---------- Statistik til grafer ---------- */

const DAY_MS = 86_400_000;

/** Mandag kl. 00:00 (lokal tid) i ugen der indeholder `t` */
export function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** ISO-ugenummer */
export function isoWeek(t: number): number {
  const d = new Date(startOfWeek(t));
  d.setDate(d.getDate() + 3); // torsdag i samme uge afgør året
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round((d.getTime() - startOfWeek(jan4.getTime())) / (7 * DAY_MS) - 3 / 7);
}

export interface WeekVolume {
  weekStart: number;
  week: number;
  volume: number;
}

/** Samlet løftet vægt pr. uge for de seneste `weeks` uger (ældste først, også uger med 0) */
export function weeklyVolume(state: AppState, weeks: number, now: number): WeekVolume[] {
  const starts: number[] = [];
  let ws = startOfWeek(now);
  for (let i = 0; i < weeks; i++) {
    starts.unshift(ws);
    ws = startOfWeek(ws - DAY_MS); // et døgn før mandag = forrige uge (tåler sommertid)
  }
  const out = starts.map((weekStart) => ({ weekStart, week: isoWeek(weekStart), volume: 0 }));
  for (const w of state.history) {
    const i = starts.indexOf(startOfWeek(w.startedAt));
    if (i >= 0) out[i].volume += workoutVolume(w);
  }
  return out;
}

/** Dage i en måned (0 = januar) med afsluttede træninger: dag → træningernes id (ældste først) */
export function trainingDays(state: AppState, year: number, month: number): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (const w of [...state.history].sort((a, b) => a.startedAt - b.startedAt)) {
    const d = new Date(w.startedAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    (out[d.getDate()] ??= []).push(w.id);
  }
  return out;
}

export interface Streak {
  /** Uger i træk med mindst `perWeek` træninger (denne uge tæller først, når målet er nået) */
  weeks: number;
  /** Antal træninger i denne uge */
  thisWeek: number;
}

export function weekStreak(state: AppState, perWeek: number, now: number): Streak {
  const counts = new Map<number, number>();
  for (const w of state.history) {
    const k = startOfWeek(w.startedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const current = startOfWeek(now);
  const thisWeek = counts.get(current) ?? 0;
  let weeks = thisWeek >= perWeek ? 1 : 0;
  let ws = startOfWeek(current - DAY_MS);
  while ((counts.get(ws) ?? 0) >= perWeek) {
    weeks++;
    ws = startOfWeek(ws - DAY_MS);
  }
  return { weeks, thisWeek };
}

export interface MuscleShare {
  muscle: Muscle;
  sets: number;
  volume: number;
}

/** Udførte sæt og volumen pr. muskelgruppe for træninger fra `sinceMs` (0 = alt) */
export function muscleDistribution(state: AppState, sinceMs: number): MuscleShare[] {
  const muscleOf = new Map(state.exercises.map((e) => [e.id, e.muscle]));
  const out = new Map<Muscle, MuscleShare>(MUSCLES.map((m) => [m, { muscle: m, sets: 0, volume: 0 }]));
  for (const w of state.history) {
    if (w.startedAt < sinceMs) continue;
    for (const we of w.exercises) {
      const share = out.get(muscleOf.get(we.exerciseId) as Muscle);
      if (!share) continue;
      for (const s of we.sets) {
        if (!isWorkSet(s)) continue;
        share.sets++;
        share.volume += setVolume(s);
      }
    }
  }
  return [...out.values()];
}

/* ---------- Plader og opvarmning ---------- */

export interface PlateResult {
  /** Skiver på HVER side, tungeste først */
  perSide: number[];
  /** Vægt (i alt) der ikke kan rammes med de tilgængelige skiver */
  remainder: number;
  /** true hvis målet er under stangvægten */
  belowBar: boolean;
}

/** Hvilke skiver skal på hver side af stangen for at ramme `target` kg? */
export function platesPerSide(target: number, barWeight = DEFAULT_BAR, plates = DEFAULT_PLATES): PlateResult {
  if (target < barWeight) return { perSide: [], remainder: 0, belowBar: true };
  // Regn i gram for at undgå afrundingsfejl med 1,25 kg
  let side = Math.round(((target - barWeight) / 2) * 1000);
  const perSide: number[] = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    const g = Math.round(p * 1000);
    while (g > 0 && side >= g) {
      perSide.push(p);
      side -= g;
    }
  }
  return { perSide, remainder: (side * 2) / 1000, belowBar: false };
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** Forslag til opvarmning før et arbejdssæt: tom stang × 10, 40 % × 5, 60 % × 3, 80 % × 2 */
export function warmupSets(workingWeight: number, barWeight = DEFAULT_BAR): WarmupSet[] {
  if (workingWeight <= barWeight) return [];
  const steps: [number, number][] = [
    [0, 10],
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of steps) {
    const w = pct === 0 ? barWeight : Math.max(barWeight, Math.round((workingWeight * pct) / 2.5) * 2.5);
    if (w >= workingWeight) continue;
    if (out.length && out[out.length - 1].weight === w) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

/**
 * Vægten opvarmningen regnes ud fra: første arbejdssæt med en indtastet vægt,
 * ellers sidste gangs vægt (den grå forslagsvægt i feltet). 0 = ingen vægt kendt.
 */
export function warmupBaseWeight(history: Workout[], we: WorkoutExercise): number {
  const work = we.sets.filter((x) => !x.warmup);
  const typed = work.find((x) => num(x.weight) > 0);
  if (typed) return num(typed.weight);
  const prev = previousSets(history, we.exerciseId).find((x) => num(x.weight) > 0);
  return prev ? num(prev.weight) : 0;
}

/* ---------- Supersæt ---------- */

/**
 * Rydder op i supersæt: en gruppe er øvelser i træk med samme supersetId.
 * Grupper der er blevet delt får nyt id, og grupper med kun én øvelse opløses.
 */
export function normalizeSupersets<T extends { supersetId?: string }>(list: T[]): T[] {
  const out = list.map((e) => ({ ...e }));
  const seen = new Set<string>();
  let i = 0;
  while (i < out.length) {
    const id = out[i].supersetId;
    let j = i + 1;
    while (id && j < out.length && out[j].supersetId === id) j++;
    if (id) {
      const runId = seen.has(id) ? uid() : id;
      seen.add(runId);
      for (let k = i; k < j; k++) {
        if (j - i < 2) delete out[k].supersetId;
        else out[k].supersetId = runId;
      }
    }
    i = j;
  }
  return out;
}

/** Bygger nye øvelser og giver hvert supersæt et nyt id (så to træninger fra samme skabelon ikke deler id) */
function withFreshSupersetIds<T extends { supersetId?: string }, R extends object>(list: T[], make: (e: T) => R): R[] {
  const ids = new Map<string, string>();
  return list.map((e) => {
    const r = make(e);
    if (!e.supersetId) return r;
    if (!ids.has(e.supersetId)) ids.set(e.supersetId, uid());
    return { ...r, supersetId: ids.get(e.supersetId) };
  });
}

/** Øvelserne grupperet i rækkefølge: hvert supersæt er én gruppe, andre øvelser står alene */
export function supersetGroups<T extends { supersetId?: string }>(list: T[]): T[][] {
  const groups: T[][] = [];
  for (const e of list) {
    const last = groups[groups.length - 1];
    if (last && e.supersetId && last[0].supersetId === e.supersetId) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** Nummer blandt arbejdssættene (opvarmning tæller ikke) for sættet på plads `idx` */
function workIdxOf(we: WorkoutExercise, idx: number): number {
  return we.sets.slice(0, idx).filter((x) => !x.warmup).length;
}

/**
 * Er runden færdig? For en øvelse uden supersæt altid ja. I et supersæt først når
 * arbejdssæt nr. `k` er udført i alle øvelserne (øvelser med færre sæt tæller som færdige).
 */
export function roundComplete(w: Workout, we: WorkoutExercise, k: number): boolean {
  if (!we.supersetId) return true;
  return w.exercises
    .filter((e) => e.supersetId === we.supersetId)
    .every((e) => {
      const work = e.sets.filter((x) => !x.warmup);
      return k >= work.length || work[k].done;
    });
}

/* ---------- Pausetid pr. øvelse (#119) ---------- */

export const DEFAULT_REST = 90;
export const MAX_REST = 600;

/** Fornuftigt forslag ud fra øvelsestypen: tunge stangløft længst, isolation/kabel/maskine kortest. */
export function suggestedRest(ex: Pick<Exercise, 'muscle' | 'equipment'>): number {
  if (ex.equipment === 'Stang' && (ex.muscle === 'Ben' || ex.muscle === 'Ryg' || ex.muscle === 'Bryst')) return 180;
  if (ex.muscle === 'Arme' || ex.muscle === 'Mave' || ex.equipment === 'Kabel' || ex.equipment === 'Maskine') return 60;
  return 120;
}

/** Hvor pausetiden for en øvelse kommer fra */
export type RestSource = 'own' | 'suggested' | 'global';

/**
 * Pausetiden for en øvelse: øvelsens egen tid, ellers et forslag (kun så længe den fælles
 * pausetid i Profil står på standard), ellers den fælles pausetid.
 */
export function restInfo(state: AppState, exerciseId: string): { seconds: number; source: RestSource } {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (ex?.restSeconds !== undefined) return { seconds: ex.restSeconds, source: 'own' };
  if (ex && state.restSeconds === DEFAULT_REST) return { seconds: suggestedRest(ex), source: 'suggested' };
  return { seconds: state.restSeconds, source: 'global' };
}

export function restFor(state: AppState, exerciseId: string): number {
  return restInfo(state, exerciseId).seconds;
}

/**
 * Pausen efter et udført sæt: længste pause i supersættet. Opvarmning beholder en kort pause
 * (højst den fælles pausetid, som før #119).
 */
function restAfterSet(state: AppState, w: Workout, we: WorkoutExercise, warmup: boolean): number {
  const group = we.supersetId ? w.exercises.filter((e) => e.supersetId === we.supersetId) : [we];
  const longest = Math.max(...group.map((e) => restFor(state, e.exerciseId)));
  return warmup ? Math.min(longest, state.restSeconds) : longest;
}

/* ---------- Forslag til progression ---------- */

export interface ProgressionHint {
  /** Sidste gang: antal arbejdssæt, reps i første sæt og tungeste vægt */
  last: { sets: number; reps: number; weight: number; repsList: number[] };
  /** Forslag til i dag */
  next: { weight: number; reps: number };
  /** true hvis forslaget er et skridt op */
  increase: boolean;
  /** Tids- og distanceøvelser (#136): sidste og foreslåede sekunder/meter */
  timed?: { kind: 'time' | 'distance'; last: { seconds: number; meters: number }; next: { seconds: number; meters: number } };
}

/** Forslag for tids- og distanceøvelser: +5 sek. på holdet, eller samme distance lidt hurtigere. Hellere intet forslag end et forkert. */
function timedHint(state: AppState, exerciseId: string, kind: 'time' | 'distance'): ProgressionHint | null {
  const sets = previousSets(state.history, exerciseId);
  const empty = { sets: 0, reps: 0, weight: 0, repsList: [] };
  if (kind === 'time') {
    const best = Math.max(0, ...sets.map((s) => num(s.seconds ?? '')));
    if (!best) return null;
    const last = { seconds: best, meters: 0 };
    return { last: empty, next: { weight: 0, reps: 0 }, increase: true, timed: { kind, last, next: { seconds: best + 5, meters: 0 } } };
  }
  const timed = sets.filter((s) => num(s.meters ?? '') > 0 && num(s.seconds ?? '') > 0);
  if (!timed.length) return null;
  const longest = timed.reduce((a, b) => (num(b.meters!) > num(a.meters!) ? b : a));
  const meters = num(longest.meters!);
  const seconds = num(longest.seconds!);
  const faster = Math.max(1, Math.round(seconds * 0.02));
  if (seconds - faster < 1) return null;
  return {
    last: empty,
    next: { weight: 0, reps: 0 },
    increase: true,
    timed: { kind, last: { seconds, meters }, next: { seconds: seconds - faster, meters } },
  };
}

/**
 * Enkel progression: nåede alle sæt sidst mindst samme reps som første sæt, foreslås et skridt op
 * (+2,5 kg for stang/maskine/kabel, +1 kg for håndvægt, +1 rep for kropsvægt). Ellers samme igen.
 */
export function progressionHint(state: AppState, exerciseId: string): ProgressionHint | null {
  const kind = exerciseKind(state, exerciseId);
  if (kind !== 'reps') return timedHint(state, exerciseId, kind);
  const sets = previousSets(state.history, exerciseId).filter((s) => num(s.reps) > 0);
  if (!sets.length) return null;
  const reps = num(sets[0].reps);
  const weight = Math.max(...sets.map((s) => num(s.weight)));
  const last = { sets: sets.length, reps, weight, repsList: sets.map((s) => num(s.reps)) };
  const allHit = sets.every((s) => num(s.reps) >= reps);
  if (!allHit) return { last, next: { weight, reps }, increase: false };
  const equipment = state.exercises.find((e) => e.id === exerciseId)?.equipment;
  if (equipment === 'Kropsvægt' || weight === 0) return { last, next: { weight, reps: reps + 1 }, increase: true };
  const step = equipment === 'Håndvægt' ? 1 : 2.5;
  return { last, next: { weight: weight + step, reps }, increase: true };
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  date: number;
  sets: SetEntry[];
  best1RM: number;
  volume: number;
}

export function exerciseHistory(history: Workout[], exerciseId: string): ExerciseHistoryEntry[] {
  const out: ExerciseHistoryEntry[] = [];
  for (const w of history) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const sets = ex.sets.filter(isWorkSet);
      if (!sets.length) continue;
      out.push({
        workoutId: w.id,
        date: w.startedAt,
        sets,
        best1RM: Math.max(0, ...sets.map((s) => estimate1RM(num(s.weight), num(s.reps)))),
        volume: sets.reduce((a, s) => a + setVolume(s), 0),
      });
    }
  }
  return out;
}

/* ---------- Noter (#81) ---------- */

/** Højeste antal tegn i en note */
export const NOTE_MAX = 300;

/** Renser en note: fjerner mellemrum i enderne og afkorter. Tom streng = ingen note. */
export function cleanNote(note: string): string {
  return note.trim().slice(0, NOTE_MAX).trim();
}

/** Sætter eller fjerner (tom) noten på en træning eller øvelse */
function withNote<T extends { note?: string }>(item: T, note: string): T {
  const clean = cleanNote(note);
  if (clean === (item.note ?? '')) return item;
  const { note: _old, ...rest } = item;
  return (clean ? { ...rest, note: clean } : rest) as T;
}

/** Den seneste note til en øvelse fra afsluttede træninger (historikken er nyeste først) */
export function lastExerciseNote(history: Workout[], exerciseId: string): { note: string; date: number } | null {
  let best: { note: string; date: number } | null = null;
  for (const w of history) {
    for (const ex of w.exercises) {
      const note = ex.exerciseId === exerciseId ? ex.note?.trim() : '';
      if (note && (!best || w.startedAt > best.date)) best = { note, date: w.startedAt };
    }
  }
  return best;
}

/* ---------- Program (#106) ---------- */

/** Programmets skabeloner i rækkefølge – slettede skabeloner springes over */
export function programTemplates(state: AppState): Template[] {
  const byId = new Map(state.templates.map((t) => [t.id, t]));
  return (state.program ?? []).map((id) => byId.get(id)).filter((t): t is Template => !!t);
}

/** Den seneste træning fra programmet, og hvor mange gange der er sprunget over siden */
function programPosition(state: AppState): { lastWorkoutId: string | null; lastTemplateId: string | null; skips: number } {
  const ids = new Set(programTemplates(state).map((t) => t.id));
  const last = state.history.find((w) => w.templateId && ids.has(w.templateId)) ?? null; // historikken er nyeste først
  const lastWorkoutId = last?.id ?? null;
  const skip = state.programSkip ?? { after: null, n: 0 };
  return { lastWorkoutId, lastTemplateId: last?.templateId ?? null, skips: skip.after === lastWorkoutId ? skip.n : 0 };
}

/**
 * Næste skabelon i programmet: den efter skabelonen fra den seneste træning i programmet (starter forfra efter
 * den sidste), flyttet med antallet af "Spring over". Uden træninger endnu er det den første. Null uden program.
 * Træninger fra skabeloner uden for programmet flytter ikke rækkefølgen.
 */
export function nextInProgram(state: AppState): Template | null {
  const list = programTemplates(state);
  if (!list.length) return null;
  const { lastTemplateId, skips } = programPosition(state);
  const start = lastTemplateId ? list.findIndex((t) => t.id === lastTemplateId) + 1 : 0;
  return list[(start + skips) % list.length];
}

/* ---------- Byt øvelse (#126) ---------- */

/** Kan et byt i den aktive træning gemmes i skabelonen, den blev startet fra? (#128) */
export function canSwapInTemplate(state: AppState, templateId: string | undefined, fromExerciseId: string): boolean {
  const tpl = templateId ? state.templates.find((t) => t.id === templateId) : undefined;
  return !!tpl && tpl.exercises.some((e) => e.exerciseId === fromExerciseId);
}

/** Højst så mange forslag, når en øvelse byttes */
export const SWAP_SUGGESTIONS_MAX = 6;

/**
 * Forslag til en øvelse at bytte til: samme muskelgruppe, helst andet udstyr, derefter dem brugeren har
 * logget flest gange. Aldrig øvelsen selv eller øvelser, der allerede er med i træningen.
 */
export function swapSuggestions(state: AppState, exerciseId: string, workout: Workout | null = state.active): Exercise[] {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex) return [];
  const taken = new Set((workout?.exercises ?? []).map((e) => e.exerciseId));
  taken.add(exerciseId);
  const logged = new Map<string, number>();
  for (const w of state.history) {
    for (const id of new Set(w.exercises.map((e) => e.exerciseId))) logged.set(id, (logged.get(id) ?? 0) + 1);
  }
  return state.exercises
    .filter((e) => e.muscle === ex.muscle && !taken.has(e.id))
    .map((e) => ({ e, other: e.equipment !== ex.equipment ? 1 : 0, n: logged.get(e.id) ?? 0 }))
    .sort((a, b) => b.other - a.other || b.n - a.n || a.e.name.localeCompare(b.e.name, 'da'))
    .slice(0, SWAP_SUGGESTIONS_MAX)
    .map((x) => x.e);
}

/* ---------- Reducer ---------- */

/** Handlinger på en træning, der også virker på kladden (`edit: true`) i stedet for den aktive træning */
export type WorkoutChange =
  | { type: 'RENAME_WORKOUT'; name: string }
  | { type: 'SET_EXERCISE_NOTE'; weId: string; note: string }
  | { type: 'SET_WORKOUT_NOTE'; note: string }
  | { type: 'ADD_EXERCISES'; exerciseIds: string[] }
  | { type: 'REMOVE_EXERCISE'; weId: string }
  | { type: 'SWAP_EXERCISE'; weId: string; exerciseId: string }
  | { type: 'LINK_SUPERSET'; weId: string }
  | { type: 'UNLINK_SUPERSET'; weId: string }
  | { type: 'ADD_SET'; weId: string }
  | { type: 'ADD_WARMUP_SETS'; weId: string; barWeight?: number }
  | { type: 'APPLY_HINT'; weId: string; weight: number; reps: number; seconds?: number; meters?: number }
  | { type: 'REMOVE_SET'; weId: string; setId: string }
  | { type: 'UPDATE_SET'; weId: string; setId: string; patch: Partial<Omit<SetEntry, 'id'>> }
  | { type: 'TOGGLE_SET'; weId: string; setId: string; now: number }
  | { type: 'START_SET_TIMER'; weId: string; setId: string; now: number }
  | { type: 'STOP_SET_TIMER'; weId: string; setId: string; now: number };

const WORKOUT_CHANGES = new Set<string>([
  'RENAME_WORKOUT',
  'SET_EXERCISE_NOTE',
  'SET_WORKOUT_NOTE',
  'ADD_EXERCISES',
  'REMOVE_EXERCISE',
  'SWAP_EXERCISE',
  'LINK_SUPERSET',
  'UNLINK_SUPERSET',
  'ADD_SET',
  'ADD_WARMUP_SETS',
  'APPLY_HINT',
  'REMOVE_SET',
  'UPDATE_SET',
  'TOGGLE_SET',
  'START_SET_TIMER',
  'STOP_SET_TIMER',
] satisfies WorkoutChange['type'][]);

export type Action =
  | (WorkoutChange & { edit?: boolean })
  | { type: 'START_WORKOUT'; templateId?: string; now: number }
  | { type: 'REPEAT_WORKOUT'; workoutId: string; now: number; replace?: boolean }
  | { type: 'CANCEL_WORKOUT' }
  | { type: 'FINISH_WORKOUT'; now: number; includeUnchecked?: boolean }
  | { type: 'PAUSE_WORKOUT'; now: number }
  | { type: 'RESUME_WORKOUT'; now: number }
  | { type: 'EDIT_WORKOUT'; workoutId: string }
  | { type: 'SAVE_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SET_EDIT_TIMING'; startedAt: number; durationMin: number; now: number }
  | { type: 'ADJUST_REST'; delta: number }
  | { type: 'SKIP_REST' }
  | { type: 'SET_REST_SECONDS'; seconds: number }
  | { type: 'SET_EXERCISE_REST'; exerciseId: string; seconds?: number }
  | { type: 'SET_BAR_WEIGHT'; weight: number }
  | { type: 'SET_WEEKLY_GOAL'; goal: number }
  | { type: 'SET_SHOW_HINTS'; on: boolean }
  | { type: 'SET_REST_SOUND'; on: boolean }
  | { type: 'SET_REST_VIBRATE'; on: boolean }
  | { type: 'SET_KEEP_AWAKE'; on: boolean }
  | { type: 'SET_PROGRAM'; templateIds: string[] }
  | { type: 'SKIP_PROGRAM' }
  | { type: 'ADD_MEASUREMENT'; id: string; date: number; weight?: number; bodyFat?: number; waist?: number }
  | { type: 'DELETE_MEASUREMENT'; id: string }
  | { type: 'TOGGLE_PLATE'; plate: number }
  | { type: 'ADD_CUSTOM_EXERCISE'; id: string; name: string; muscle: Muscle; equipment: Equipment; kind?: ExerciseKind }
  | { type: 'SAVE_TEMPLATE_FROM_WORKOUT'; workoutId: string; name: string }
  | { type: 'DELETE_TEMPLATE'; templateId: string }
  | { type: 'SWAP_IN_TEMPLATE'; templateId: string; fromExerciseId: string; toExerciseId: string }
  | { type: 'DELETE_WORKOUT'; workoutId: string }
  | { type: 'IMPORT_STATE'; state: AppState }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'DISMISS_RECAP'; key: string }
  | { type: 'MERGE_REMOTE'; remote: AppState };

function emptySet(): SetEntry {
  return { id: uid(), weight: '', reps: '', rpe: '', done: false };
}

function newWorkoutExercise(exerciseId: string, sets = 1): WorkoutExercise {
  return { id: uid(), exerciseId, sets: Array.from({ length: Math.max(1, sets) }, emptySet) };
}

function defaultWorkoutName(now: number): string {
  const h = new Date(now).getHours();
  if (h < 5) return 'Nattræning';
  if (h < 11) return 'Morgentræning';
  if (h < 17) return 'Eftermiddagstræning';
  return 'Aftentræning';
}

function mapActive(state: AppState, fn: (w: Workout) => Workout): AppState {
  if (!state.active) return state;
  const active = fn(state.active);
  return active === state.active ? state : { ...state, active };
}

/** Afslutter en igangværende pause og lægger den til den samlede pausetid */
function endPause(w: Workout, now: number): Workout {
  if (!w.pausedAt) return w;
  const { pausedAt, ...rest } = w;
  return { ...rest, pausedMs: (w.pausedMs ?? 0) + Math.max(0, now - pausedAt) };
}

/** Træningens varighed i ms – tid sat på pause tæller ikke med */
export function workoutDuration(w: Workout, now: number): number {
  const end = w.finishedAt ?? w.pausedAt ?? now;
  return Math.max(0, end - w.startedAt - (w.pausedMs ?? 0));
}

/** Længste tilladte varighed for en træning, når den rettes bagefter (#93) */
export const MAX_DURATION_MIN = 24 * 60;

/**
 * Tjekker navn, starttid og varighed for en rettet træning (#93).
 * Returnerer en dansk fejlbesked, eller null hvis alt er i orden.
 */
export function workoutTimingError(name: string, startedAt: number, durationMin: number, now: number): string | null {
  if (!name.trim()) return 'Træningen skal have et navn.';
  if (!Number.isFinite(startedAt)) return 'Vælg en gyldig dato og starttid.';
  if (startedAt > now) return 'Datoen kan ikke ligge i fremtiden.';
  if (!Number.isFinite(durationMin) || durationMin <= 0) return 'Varigheden skal være mindst 1 minut.';
  if (durationMin > MAX_DURATION_MIN) return 'Varigheden kan højst være 24 timer.';
  return null;
}

/** Dyb kopi af en træning, så kladden aldrig deler objekter med historikken */
function structuredCloneWorkout(w: Workout): Workout {
  return { ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })) };
}

function mapExercise(w: Workout, weId: string, fn: (e: WorkoutExercise) => WorkoutExercise): Workout {
  return { ...w, exercises: w.exercises.map((e) => (e.id === weId ? fn(e) : e)) };
}

/**
 * Udfører en træningshandling på kladden (#90): kladden lægges midlertidigt ind som "aktiv" træning,
 * så alle sæt-/øvelseshandlinger kan genbruges. Kun kladden tages med tilbage – den aktive træning,
 * pausetimeren og resten af tilstanden røres aldrig. Historikken før kladden bruges til "forrige".
 */
function reduceDraft(state: AppState, action: WorkoutChange): AppState {
  const draft = state.editing;
  if (!draft) return state;
  const scratch: AppState = {
    ...state,
    history: state.history.filter((w) => w.id !== draft.id && w.startedAt < draft.startedAt),
    active: draft,
    rest: null,
  };
  const editing = reducer(scratch, action).active;
  return !editing || editing === draft ? state : { ...state, editing };
}

export function reducer(state: AppState, action: Action): AppState {
  if ('edit' in action && action.edit && WORKOUT_CHANGES.has(action.type)) {
    const { edit: _edit, ...change } = action;
    return reduceDraft(state, change as WorkoutChange);
  }
  switch (action.type) {
    case 'EDIT_WORKOUT': {
      const w = state.history.find((x) => x.id === action.workoutId);
      return w ? { ...state, editing: structuredCloneWorkout(w) } : state;
    }
    case 'CANCEL_EDIT':
      return state.editing ? { ...state, editing: null } : state;
    case 'SET_EDIT_TIMING': {
      // Ny dato/starttid og varighed for kladden (#93). Pausetid nulstilles, så varigheden er præcis den indtastede.
      const draft = state.editing;
      if (!draft) return state;
      const { startedAt, durationMin, now } = action;
      if (workoutTimingError(draft.name || '-', startedAt, durationMin, now)) return state;
      const { pausedAt: _p, pausedMs: _m, ...rest } = draft;
      const finishedAt = startedAt + Math.round(durationMin * 60_000);
      return { ...state, editing: { ...rest, startedAt, finishedAt } };
    }
    case 'SAVE_EDIT': {
      const draft = state.editing;
      if (!draft) return state;
      if (!state.history.some((w) => w.id === draft.id)) return { ...state, editing: null }; // slettet imens
      if (!draft.name.trim()) return state; // en træning skal have et navn (#93)
      const exercises = draft.exercises
        .map((e) => {
          const kind = exerciseKind(state, e.exerciseId);
          return { ...e, sets: e.sets.filter((s) => s.done || isSetFilled(s, kind)).map((s) => ({ ...s, done: true })) };
        })
        .filter((e) => e.sets.length > 0);
      if (!exercises.length) return state; // en tom træning gemmes ikke – brug "Slet" i stedet
      const saved: Workout = { ...draft, name: draft.name.trim(), exercises: normalizeSupersets(exercises) };
      const history = state.history.map((w) => (w.id === saved.id ? saved : w)).sort((a, b) => b.startedAt - a.startedAt);
      return { ...state, history, editing: null };
    }
    case 'START_WORKOUT': {
      if (state.active) return state;
      const tpl = state.templates.find((t) => t.id === action.templateId);
      const active: Workout = {
        id: uid(),
        name: tpl?.name ?? defaultWorkoutName(action.now),
        startedAt: action.now,
        ...(tpl ? { templateId: tpl.id } : {}),
        exercises: tpl ? withFreshSupersetIds(tpl.exercises, (e) => newWorkoutExercise(e.exerciseId, e.sets)) : [],
      };
      return { ...state, active, rest: null, lastFinishedId: null };
    }
    case 'REPEAT_WORKOUT': {
      // Start en ny træning med samme øvelser, antal arbejdssæt og supersæt som en afsluttet træning (#149)
      if (state.active && !action.replace) return state;
      const src = state.history.find((h) => h.id === action.workoutId);
      if (!src) return state;
      const active: Workout = {
        id: uid(),
        name: src.name,
        startedAt: action.now,
        repeatOf: src.id,
        exercises: withFreshSupersetIds(src.exercises, (e) =>
          newWorkoutExercise(e.exerciseId, e.sets.filter((x) => !x.warmup).length),
        ),
      };
      return { ...state, active, rest: null, lastFinishedId: null };
    }
    case 'CANCEL_WORKOUT':
      return { ...state, active: null, rest: null };
    case 'CLOSE_SUMMARY':
      return state.lastFinishedId ? { ...state, lastFinishedId: null } : state;
    case 'FINISH_WORKOUT': {
      if (!state.active) return state;
      // Kørende stopure stoppes, så tiden kommer med
      const exercises = state.active.exercises
        .map((e) => ({ ...e, sets: e.sets.map((s) => stopTimer(s, action.now)) }))
        .map((e) => {
          const kind = exerciseKind(state, e.exerciseId);
          return {
            ...e,
            sets: e.sets
              .filter((s) => s.done || (action.includeUnchecked && isSetFilled(s, kind)))
              .map((s) => ({ ...s, done: true })),
          };
        })
        .filter((e) => e.sets.length > 0);
      if (!exercises.length) return { ...state, active: null, rest: null, lastFinishedId: null };
      // Hvis en øvelse i et supersæt ikke blev lavet, kan supersættet være opløst
      const done: Workout = { ...endPause(state.active, action.now), exercises: normalizeSupersets(exercises), finishedAt: action.now };
      return { ...state, active: null, rest: null, history: [done, ...state.history], lastFinishedId: done.id };
    }
    case 'PAUSE_WORKOUT':
      return mapActive(state, (w) => (w.pausedAt ? w : { ...w, pausedAt: action.now }));
    case 'RESUME_WORKOUT':
      return mapActive(state, (w) => endPause(w, action.now));
    case 'RENAME_WORKOUT':
      return mapActive(state, (w) => ({ ...w, name: action.name }));
    case 'SET_EXERCISE_NOTE':
      return mapActive(state, (w) => mapExercise(w, action.weId, (e) => withNote(e, action.note)));
    case 'SET_WORKOUT_NOTE':
      return mapActive(state, (w) => withNote(w, action.note));
    case 'ADD_EXERCISES':
      return mapActive(state, (w) => ({
        ...w,
        exercises: [...w.exercises, ...action.exerciseIds.map((id) => newWorkoutExercise(id))],
      }));
    case 'REMOVE_EXERCISE':
      return mapActive(state, (w) => ({
        ...w,
        exercises: normalizeSupersets(w.exercises.filter((e) => e.id !== action.weId)),
      }));
    case 'SWAP_EXERCISE': {
      // Sæt, supersæt og note bliver; "forrige", forslag og rekorder følger den nye øvelse via exerciseId
      if (!state.exercises.some((e) => e.id === action.exerciseId)) return state;
      return mapActive(state, (w) => {
        const cur = w.exercises.find((e) => e.id === action.weId);
        if (!cur || cur.exerciseId === action.exerciseId) return w;
        return mapExercise(w, action.weId, (e) => ({ ...e, exerciseId: action.exerciseId }));
      });
    }
    case 'LINK_SUPERSET':
      return mapActive(state, (w) => {
        const i = w.exercises.findIndex((e) => e.id === action.weId);
        const cur = w.exercises[i];
        const next = w.exercises[i + 1];
        if (!cur || !next) return w;
        if (cur.supersetId && cur.supersetId === next.supersetId) return w;
        const id = cur.supersetId ?? next.supersetId ?? uid();
        const oldNext = next.supersetId;
        const exercises = w.exercises.map((e, k) =>
          k === i || k === i + 1 || (oldNext && e.supersetId === oldNext) ? { ...e, supersetId: id } : e,
        );
        return { ...w, exercises: normalizeSupersets(exercises) };
      });
    case 'UNLINK_SUPERSET':
      return mapActive(state, (w) => ({
        ...w,
        exercises: normalizeSupersets(
          w.exercises.map((e) => (e.id === action.weId ? { ...e, supersetId: undefined } : e)),
        ),
      }));
    case 'ADD_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const last = e.sets[e.sets.length - 1];
          const next = emptySet();
          if (last) {
            next.weight = last.weight;
            next.reps = last.reps;
            if (last.seconds !== undefined) next.seconds = last.seconds;
            if (last.meters !== undefined) next.meters = last.meters;
          }
          return { ...e, sets: [...e.sets, next] };
        }),
      );
    case 'APPLY_HINT':
      // Fyld forslaget i de tomme felter på arbejdssæt, der ikke er udført endnu
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) =>
            s.warmup || s.done
              ? s
              : {
                  ...s,
                  weight: s.weight || (action.weight > 0 ? String(action.weight).replace('.', ',') : ''),
                  reps: s.reps || (action.reps > 0 ? String(action.reps) : ''),
                  ...(action.seconds ? { seconds: s.seconds || String(action.seconds) } : {}),
                  ...(action.meters ? { meters: s.meters || String(action.meters).replace('.', ',') } : {}),
                },
          ),
        })),
      );
    case 'ADD_WARMUP_SETS':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const work = e.sets.filter((x) => !x.warmup);
          const base = warmupBaseWeight(state.history, e);
          if (!base) return e;
          const warm = warmupSets(base, action.barWeight ?? state.barWeight).map(
            (ws): SetEntry => ({ ...emptySet(), weight: String(ws.weight).replace('.', ','), reps: String(ws.reps), warmup: true }),
          );
          return { ...e, sets: [...warm, ...work] };
        }),
      );
    case 'REMOVE_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== action.setId) })),
      );
    case 'START_SET_TIMER':
      // Kun ét stopur ad gangen: et andet kørende stopur i træningen stoppes først
      return mapActive(state, (w) => ({
        ...w,
        exercises: w.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) =>
            e.id === action.weId && s.id === action.setId
              ? { ...s, timerStartedAt: action.now }
              : stopTimer(s, action.now),
          ),
        })),
      }));
    case 'STOP_SET_TIMER':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) => (s.id === action.setId ? stopTimer(s, action.now) : s)),
        })),
      );
    case 'UPDATE_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) => (s.id === action.setId ? { ...s, ...action.patch } : s)),
        })),
      );
    case 'TOGGLE_SET': {
      if (!state.active) return state;
      const we = state.active.exercises.find((e) => e.id === action.weId);
      const idx = we?.sets.findIndex((s) => s.id === action.setId) ?? -1;
      if (!we || idx < 0) return state;
      const set = we.sets[idx];
      const nowDone = !set.done;
      let patch: Partial<SetEntry> = { done: nowDone };
      if (nowDone) {
        // Udfyld tomme felter med sidste gangs tal, ligesom placeholderen viser
        const workIdx = workIdxOf(we, idx);
        const prev = set.warmup ? undefined : previousSetsFor(state.history, state.active, we.exerciseId)[workIdx];
        const kind = exerciseKind(state, we.exerciseId);
        if (kind === 'reps') {
          const weight = set.weight || prev?.weight || '';
          const reps = set.reps || prev?.reps || '';
          if (!reps) return state; // kan ikke markere et sæt uden reps
          patch = { ...patch, weight, reps };
        } else {
          // Tid/distance (#133): brug sidste gangs sekunder/meter, hvis feltet er tomt
          const seconds = set.seconds || prev?.seconds || '';
          const meters = set.meters || prev?.meters || '';
          if (kind === 'time' ? !seconds : !meters) return state;
          patch = { ...patch, seconds, ...(kind === 'distance' ? { meters } : {}) };
        }
      }
      const next = reducer(state, { type: 'UPDATE_SET', weId: action.weId, setId: action.setId, patch });
      const seconds = nowDone ? restAfterSet(state, next.active!, we, !!set.warmup) : 0;
      const startRest = seconds > 0 && (set.warmup || roundComplete(next.active!, we, workIdxOf(we, idx)));
      return {
        ...next,
        rest: startRest ? { endsAt: action.now + seconds * 1000, total: seconds } : next.rest,
      };
    }
    case 'ADJUST_REST': {
      if (!state.rest) return state;
      const endsAt = state.rest.endsAt + action.delta * 1000;
      return { ...state, rest: { endsAt, total: Math.max(1, state.rest.total + action.delta) } };
    }
    case 'SKIP_REST':
      return { ...state, rest: null };
    case 'SET_REST_SECONDS':
      return { ...state, restSeconds: Math.max(0, Math.min(MAX_REST, Math.round(action.seconds))) };
    case 'SET_EXERCISE_REST': {
      const ex = state.exercises.find((e) => e.id === action.exerciseId);
      if (!ex) return state;
      const seconds =
        action.seconds === undefined || !Number.isFinite(action.seconds)
          ? undefined
          : Math.max(0, Math.min(MAX_REST, Math.round(action.seconds)));
      if (seconds === ex.restSeconds) return state;
      const { restSeconds: _old, ...base } = ex;
      const updated: Exercise = seconds === undefined ? base : { ...base, restSeconds: seconds };
      return { ...state, exercises: state.exercises.map((e) => (e.id === ex.id ? updated : e)) };
    }
    case 'ADD_MEASUREMENT': {
      const pos = (n?: number) => (n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined);
      const m = { id: action.id, date: action.date, weight: pos(action.weight), bodyFat: pos(action.bodyFat), waist: pos(action.waist) };
      if (m.weight === undefined && m.bodyFat === undefined && m.waist === undefined) return state;
      if (m.bodyFat !== undefined && m.bodyFat >= 100) return state;
      const clean = Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)) as typeof m;
      return { ...state, bodyLog: [clean, ...state.bodyLog].sort((a, b) => b.date - a.date) };
    }
    case 'DELETE_MEASUREMENT':
      return { ...state, bodyLog: state.bodyLog.filter((m) => m.id !== action.id) };
    case 'SET_SHOW_HINTS':
      return { ...state, showHints: action.on };
    case 'SET_REST_SOUND':
      return { ...state, restSound: action.on };
    case 'SET_REST_VIBRATE':
      return { ...state, restVibrate: action.on };
    case 'SET_KEEP_AWAKE':
      return { ...state, keepAwake: action.on };
    case 'DISMISS_RECAP':
      return { ...state, recapDismissed: action.key };
    case 'SET_PROGRAM': {
      const known = new Set(state.templates.map((t) => t.id));
      const program = [...new Set(action.templateIds)].filter((id) => known.has(id));
      if (program.length === state.program.length && program.every((id, i) => id === state.program[i])) return state;
      return { ...state, program, programSkip: { after: null, n: 0 } };
    }
    case 'SKIP_PROGRAM': {
      const { lastWorkoutId, skips } = programPosition(state);
      if (!programTemplates(state).length) return state;
      return { ...state, programSkip: { after: lastWorkoutId, n: skips + 1 } };
    }
    case 'SET_WEEKLY_GOAL':
      return { ...state, weeklyGoal: Math.max(1, Math.min(7, Math.round(action.goal) || 1)) };
    case 'SET_BAR_WEIGHT':
      return action.weight > 0 && action.weight <= 50 ? { ...state, barWeight: action.weight } : state;
    case 'TOGGLE_PLATE': {
      if (!DEFAULT_PLATES.includes(action.plate)) return state;
      const on = state.plates.includes(action.plate);
      if (on && state.plates.length === 1) return state; // mindst én skive
      const plates = on ? state.plates.filter((p) => p !== action.plate) : [...state.plates, action.plate];
      return { ...state, plates: plates.sort((a, b) => b - a) };
    }
    case 'ADD_CUSTOM_EXERCISE': {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        exercises: [
          ...state.exercises,
          {
            id: action.id,
            name,
            muscle: action.muscle,
            equipment: action.equipment,
            custom: true,
            // Kun tid og distance gemmes; alt andet er vægt × reps (#135)
            ...(action.kind === 'time' || action.kind === 'distance' ? { kind: action.kind } : {}),
          },
        ],
      };
    }
    case 'SAVE_TEMPLATE_FROM_WORKOUT': {
      const w = state.history.find((h) => h.id === action.workoutId);
      if (!w) return state;
      const tpl: Template = {
        id: uid(),
        name: action.name.trim() || w.name,
        exercises: normalizeSupersets(
          w.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: e.sets.filter((x) => !x.warmup).length,
            ...(e.supersetId ? { supersetId: e.supersetId } : {}),
          })),
        ),
      };
      return { ...state, templates: [...state.templates, tpl] };
    }
    case 'SWAP_IN_TEMPLATE': {
      // Byt øvelsen i skabelonen (#128): samme antal sæt og supersæt – den første forekomst af den gamle øvelse
      if (action.fromExerciseId === action.toExerciseId) return state;
      if (!state.exercises.some((e) => e.id === action.toExerciseId)) return state;
      const tpl = state.templates.find((t) => t.id === action.templateId);
      const i = tpl?.exercises.findIndex((e) => e.exerciseId === action.fromExerciseId) ?? -1;
      if (!tpl || i < 0) return state;
      const exercises = tpl.exercises.map((e, k) => (k === i ? { ...e, exerciseId: action.toExerciseId } : e));
      return { ...state, templates: state.templates.map((t) => (t === tpl ? { ...t, exercises } : t)) };
    }
    case 'DELETE_TEMPLATE':
      return { ...state, templates: state.templates.filter((t) => t.id !== action.templateId) };
    case 'DELETE_WORKOUT':
      return { ...state, history: state.history.filter((w) => w.id !== action.workoutId) };
    case 'IMPORT_STATE':
      return action.state;
    case 'MERGE_REMOTE':
      return mergeStates(state, action.remote);
  }
}

/* ---------- Pausealarm (#80) ---------- */

/** Sekunder før pausen slutter, hvor der kommer en kort advarsel */
export const REST_WARNING_S = 10;
/** Kortere pauser end dette får ingen advarsel (den ville komme næsten med det samme) */
export const REST_WARNING_MIN_TOTAL_S = 12;

export type RestAlert = 'warning' | 'done';

/** Hvilke alarmer der allerede er givet for den aktuelle pause. `start` identificerer pausen. */
export interface RestAlertsFired {
  start: number;
  warning: boolean;
  done: boolean;
}

/**
 * Hvilken alarm skal gives nu? Hver alarm gives højst én gang pr. pause.
 * Pausen kendes på sit starttidspunkt (endsAt − total), som ikke ændres, når man lægger tid til/trækker fra.
 * Ingen pause (sprunget over / slut) → ingen alarm.
 */
export function restAlertDue(
  rest: AppState['rest'],
  now: number,
  fired: RestAlertsFired | null,
): { alert: RestAlert | null; fired: RestAlertsFired | null } {
  if (!rest) return { alert: null, fired: null };
  const start = rest.endsAt - rest.total * 1000;
  const f = fired && fired.start === start ? fired : { start, warning: false, done: false };
  const left = rest.endsAt - now;
  if (left <= 0) {
    if (f.done) return { alert: null, fired: f };
    return { alert: 'done', fired: { ...f, warning: true, done: true } };
  }
  if (!f.warning && left <= REST_WARNING_S * 1000 && rest.total >= REST_WARNING_MIN_TOTAL_S) {
    return { alert: 'warning', fired: { ...f, warning: true } };
  }
  return { alert: null, fired: f };
}

/**
 * Skal skærmen holdes tændt (#154)? Kun når indstillingen er slået til, en træning er i gang
 * (ikke når en afsluttet træning rettes), den ikke er sat på pause, og appen er synlig.
 */
export function wantsWakeLock(state: Pick<AppState, 'keepAwake' | 'active'>, visible: boolean): boolean {
  return state.keepAwake !== false && !!state.active && !state.active.pausedAt && visible;
}

/* ---------- Online-gemning: flet to versioner ---------- */

const SETTINGS = [
  'restSeconds',
  'barWeight',
  'plates',
  'weeklyGoal',
  'showHints',
  'restSound',
  'restVibrate',
  'keepAwake',
  'recapDismissed',
  'program',
  'programSkip',
] as const;

type Stamped = { id: string; updatedAt?: number };

/**
 * Noterer, hvad en lokal handling ændrede, så to enheder kan flettes korrekt:
 * slettede ting får en "gravsten", ændrede skabeloner/øvelser og indstillinger får et tidsstempel.
 */
export function stampChanges(prev: AppState, next: AppState, now: number): AppState {
  if (prev === next) return next;
  let out = next;
  const deleted: Record<string, number> = {};
  const gone = <T extends { id: string }>(before: T[], after: T[]) => {
    const ids = new Set(after.map((x) => x.id));
    for (const x of before) if (!ids.has(x.id)) deleted[x.id] = now;
  };
  if (prev.history !== next.history) gone(prev.history, next.history);
  if (prev.templates !== next.templates) gone(prev.templates, next.templates);
  if (prev.exercises !== next.exercises) gone(prev.exercises, next.exercises);
  if (prev.bodyLog !== next.bodyLog) gone(prev.bodyLog, next.bodyLog);
  if (Object.keys(deleted).length) out = { ...out, deleted: { ...out.deleted, ...deleted } };

  const touch = <T extends Stamped>(before: T[], after: T[]): T[] => {
    const old = new Map(before.map((x) => [x.id, x]));
    let changed = false;
    const res = after.map((x) => {
      if (old.get(x.id) === x) return x;
      changed = true;
      return { ...x, updatedAt: now };
    });
    return changed ? res : after;
  };
  if (prev.templates !== next.templates) out = { ...out, templates: touch(prev.templates, out.templates) };
  // En rettet træning (#91) får et tidsstempel, så rettelsen vinder på de andre enheder. Nye træninger stemples ikke.
  if (prev.history !== next.history) {
    const old = new Map(prev.history.map((w) => [w.id, w]));
    const edited = (w: Workout) => old.has(w.id) && old.get(w.id) !== w;
    if (out.history.some(edited)) out = { ...out, history: out.history.map((w) => (edited(w) ? { ...w, updatedAt: now } : w)) };
  }
  if (prev.exercises !== next.exercises) out = { ...out, exercises: touch(prev.exercises, out.exercises) };
  if (SETTINGS.some((k) => prev[k] !== next[k])) out = { ...out, settingsAt: now };
  return out;
}

/** Union efter id uden slettede. Ved samme id vinder den nyeste ændring (lige = den lokale). */
function mergeById<T extends Stamped>(mine: T[], theirs: T[], deleted: Record<string, number>): T[] {
  const byId = new Map(mine.map((x) => [x.id, x]));
  for (const t of theirs) {
    const m = byId.get(t.id);
    if (!m || (t.updatedAt ?? 0) > (m.updatedAt ?? 0)) byId.set(t.id, t);
  }
  const order = [...new Set([...mine.map((x) => x.id), ...theirs.map((x) => x.id)])];
  return order.filter((id) => !(id in deleted)).map((id) => byId.get(id)!);
}

/**
 * Fletter data fra serveren ind i de lokale data (#38):
 * - træninger og kropsmål samles efter id – intet tabes eller dubleres. En rettet træning (med `updatedAt`)
 *   vinder over en ældre udgave; ellers vinder den lokale udgave (#91)
 * - skabeloner og egne øvelser: den nyeste ændring vinder
 * - indstillinger: den enhed, der ændrede dem senest, vinder
 * - slettede ting forbliver slettede på begge enheder
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const deleted: Record<string, number> = { ...(remote.deleted ?? {}) };
  for (const [id, at] of Object.entries(local.deleted ?? {})) deleted[id] = Math.max(at, deleted[id] ?? 0);
  const remoteSettingsNewer = (remote.settingsAt ?? 0) > (local.settingsAt ?? 0);
  const settings = remoteSettingsNewer
    ? Object.fromEntries([...SETTINGS.map((k) => [k, remote[k] ?? local[k]]), ['settingsAt', remote.settingsAt]])
    : {};
  const active = local.active ?? remote.active ?? null;
  return {
    ...local,
    ...settings,
    deleted,
    exercises: mergeById(local.exercises, remote.exercises ?? [], deleted),
    templates: mergeById(local.templates, remote.templates ?? [], deleted),
    history: mergeById(local.history, remote.history ?? [], deleted).sort((a, b) => b.startedAt - a.startedAt),
    active: active && active.id in deleted ? null : active,
    editing: local.editing && local.editing.id in deleted ? null : (local.editing ?? null),
    bodyLog: mergeById(
      (local.bodyLog ?? []).map((m) => ({ ...m, updatedAt: 1 })),
      (remote.bodyLog ?? []).map((m) => ({ ...m, updatedAt: 0 })),
      deleted,
    )
      .map(({ updatedAt: _u, ...m }) => m)
      .sort((a, b) => b.date - a.date),
  };
}

/** Reducer der også noterer ændringer til fletning. `at` = tidspunkt for handlingen. */
export function trackedReducer(state: AppState, action: Action & { at?: number }): AppState {
  const next = reducer(state, action);
  if (action.type === 'MERGE_REMOTE' || action.type === 'IMPORT_STATE') return next;
  return stampChanges(state, next, action.at ?? Date.now());
}

/** Det, der sendes til serveren (pausetimeren og en kladde under redigering hører kun til denne enhed). */
export function syncPayload(state: AppState): Omit<AppState, 'rest' | 'editing' | 'lastFinishedId'> {
  const { rest: _rest, editing: _editing, lastFinishedId: _last, ...rest } = state;
  return rest;
}

/** Har enheden data, der er værd at beholde? (træninger, egne øvelser eller en igangværende træning) */
export function hasOwnData(state: AppState): boolean {
  return (
    state.history.length > 0 || !!state.active || state.exercises.some((e) => e.custom) || state.bodyLog.length > 0
  );
}

/* ---------- Gem/indlæs ---------- */

// Staging-versionen (…/workout-tracker/staging/) ligger på samme domæne som den rigtige app
// og får derfor sin egen nøgle, så test aldrig kan røre brugerens rigtige data.
export const STORAGE_KEY: string = import.meta.env.VITE_STORAGE_KEY || 'loeft-state-v1';
export const IS_STAGING = import.meta.env.VITE_STAGING === '1';

export function loadState(raw: string | null): AppState {
  const base = initialState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return base;
    // Sørg for at nye standardøvelser kommer med, uden at overskrive brugerens egne
    const known = new Set((parsed.exercises ?? []).map((e) => e.id));
    // Indbyggede øvelser får deres type (fx bliver "Planke" en tidsøvelse, #133); egne øvelser røres ikke
    const seedKind = new Map(base.exercises.filter((e) => e.kind).map((e) => [e.id, e.kind]));
    const own = (parsed.exercises ?? []).map((e) =>
      !e.custom && !e.kind && seedKind.has(e.id) ? { ...e, kind: seedKind.get(e.id) } : e,
    );
    return {
      ...base,
      ...parsed,
      exercises: [...own, ...base.exercises.filter((e) => !known.has(e.id))],
      // Opsummeringen hører kun til øjeblikket efter "Afslut" – den lukkes ved genindlæsning (#142)
      lastFinishedId: null,
    } as AppState;
  } catch {
    return base;
  }
}

/* ---------- Eksport ---------- */

/** Kropsmål som CSV (ældste først). Tal skrives med punktum, så regneark kan læse dem. */
export function bodyToCsv(state: AppState): string {
  const day = (t: number) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const v = (n?: number) => (n === undefined ? '' : String(n));
  const rows = [['Dato', 'Vægt (kg)', 'Fedt (%)', 'Talje (cm)']];
  for (const m of [...state.bodyLog].sort((a, b) => a.date - b.date)) rows.push([day(m.date), v(m.weight), v(m.bodyFat), v(m.waist)]);
  return rows.map((r) => r.join(',')).join('\n');
}

/** Alle træninger som CSV. "Sek." og "Meter" er kun udfyldt for tids- og distancesæt (#137). */
export function toCsv(state: AppState): string {
  const name = new Map(state.exercises.map((e) => [e.id, e.name]));
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['Dato', 'Træning', 'Øvelse', 'Sæt', 'Vægt (kg)', 'Reps', 'RPE', 'Sek.', 'Meter']];
  for (const w of [...state.history].reverse()) {
    const date = new Date(w.startedAt).toISOString();
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) =>
        rows.push([date, w.name, name.get(ex.exerciseId) ?? ex.exerciseId, String(i + 1), s.weight, s.reps, s.rpe, s.seconds ?? '', (s.meters ?? '').replace(',', '.')]),
      );
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
