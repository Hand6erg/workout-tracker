import { SEED_EXERCISES, SEED_TEMPLATES } from './seed';
import { BUILT_IN_CUES } from './cues';
import { MAX_TEMPLATE_REPS, MUSCLES } from './types';
import type {
  AppState,
  BodyMeasurement,
  Equipment,
  Exercise,
  ExerciseKind,
  Finisher,
  IntervalConfig,
  IntervalMode,
  IntervalRun,
  LiftGoal,
  Muscle,
  SetEntry,
  SetTag,
  StallDismissal,
  Theme,
  WeightUnit,
  Template,
  TemplateExercise,
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
/** Pund-stang og -skiver (#347) */
export const DEFAULT_BAR_LB = 45;
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];
export const BAR_OPTIONS_KG = [20, 15, 10, 7, 5];
export const BAR_OPTIONS_LB = [45, 35, 25, 15];

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
    interval: null,
    restSeconds: 90,
    barWeight: DEFAULT_BAR,
    plates: [...DEFAULT_PLATES],
    barWeightLb: DEFAULT_BAR_LB,
    platesLb: [...DEFAULT_PLATES_LB],
    bodyLog: [],
    weeklyGoal: 2,
    showHints: true,
    restSound: true,
    restVibrate: true,
    keepAwake: true,
    showRpe: true,
    unit: 'kg',
    showTimeLeft: true,
    theme: 'dark',
    largeText: false,
    recapDismissed: null,
    yearReviewHidden: [],
    stallDismissed: {},
    favorites: [],
    bodyWeight: null,
    setTargets: { ...DEFAULT_SET_TARGETS },
    trainingDays: [],
    goals: [],
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

/** Drop-sæt (#243): et lettere sæt lige efter et tungt – tæller i volumen, men ikke som rekord eller "sidste gang" */
export function isDropSet(s: SetEntry): boolean {
  return s.tag === 'drop';
}

/** Udført hovedsæt: arbejdssæt, der ikke er drop-sæt (#243). Bruges til rekorder, forslag, "Forrige" og "vs. sidst". */
export function isMainSet(s: SetEntry): boolean {
  return isWorkSet(s) && !isDropSet(s);
}

/** Bogstav og dansk navn for et sæt-mærke (#243) */
export const SET_TAGS: Record<SetTag, { letter: string; name: string }> = {
  drop: { letter: 'D', name: 'Drop-sæt' },
  failure: { letter: 'F', name: 'Til failure' },
  amrap: { letter: 'A', name: 'AMRAP' },
};

export function setTagInfo(tag: SetTag | undefined): { letter: string; name: string } | null {
  return tag && tag in SET_TAGS ? SET_TAGS[tag] : null;
}

/** Hvilken nummerrække et sæt hører til (#244): opvarmning (O), drop-sæt (D) eller arbejdssæt (1, 2, 3 …) */
export type SetKind = 'warmup' | 'drop' | 'work';
export function setKind(s: SetEntry): SetKind {
  return s.warmup ? 'warmup' : isDropSet(s) ? 'drop' : 'work';
}

/**
 * Nummer og visning for sættet på plads `idx` (#244): arbejdssæt tælles 1, 2, 3 … uden opvarmning og drop-sæt,
 * så "Forrige" passer. Mærkede sæt viser deres bogstav (O / D / F / A) i stedet for tallet.
 */
export function setLabel(sets: SetEntry[], idx: number): { kind: SetKind; no: number; text: string } {
  const s = sets[idx];
  const kind = setKind(s);
  const no = sets.slice(0, idx).filter((x) => setKind(x) === kind).length + 1;
  const text = s.warmup ? 'O' : (setTagInfo(s.tag)?.letter ?? String(no));
  return { kind, no, text };
}

/** Vægt til et drop-sæt (#243): ~20 % lettere, rundet til nærmeste 2,5 kg, aldrig under 0. Tom vægt → tom. */
export function dropSetWeight(weight: string): string {
  if (!weight.trim()) return '';
  const w = Math.max(0, Math.round((num(weight) * 0.8) / 2.5) * 2.5);
  return String(w).replace('.', ',');
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
    if (!isMainSet(s)) continue;
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

/* ---------- Pund (#344): data er altid i kg ---------- */

/** 1 lb i kg (international definition) */
export const KG_PER_LB = 0.45359237;

export function isWeightUnit(v: unknown): v is WeightUnit {
  return v === 'kg' || v === 'lb';
}

/** En vægt i kg vist i den valgte enhed, afrundet til 0,1 (fx 100 kg → 220,5 lb) */
export function toDisplay(kg: number, unit: WeightUnit): number {
  const v = unit === 'lb' ? kg / KG_PER_LB : kg;
  return Math.round(v * 10) / 10;
}

/**
 * En vægt indtastet i den valgte enhed som kg til gemning. Pund gemmes med 4 decimaler,
 * så fx 225 lb vises som 225 lb igen (102,0582 kg).
 */
export function fromDisplay(value: number, unit: WeightUnit): number {
  if (unit === 'kg') return value;
  return Math.round(value * KG_PER_LB * 10000) / 10000;
}

/** Tal med dansk komma og uden ",0" (fx 102.5 → "102,5", 225 → "225") */
function displayNumber(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** En vægt i kg som tekst i den valgte enhed: "102,5 kg" eller "225 lb" */
export function formatWeight(kg: number, unit: WeightUnit = 'kg'): string {
  return unit === 'lb' ? `${displayNumber(toDisplay(kg, 'lb'))} lb` : formatKg(kg);
}

/**
 * Teksten i vægtfeltet i træningen (#345). Sættet gemmer kg; med lb vises vægten omregnet (225),
 * og en kg-værdi gemt fra pund (102.0582) vises afrundet (102,1). Almindelige kg-indtastninger vises som skrevet.
 */
export function weightInputText(kg: string, unit: WeightUnit): string {
  const t = kg.trim();
  if (!t) return '';
  if (unit === 'kg' && !/[.,]\d{3,}$/.test(t)) return kg;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? displayNumber(toDisplay(n, unit)) : kg;
}

/** Det man skriver i vægtfeltet som kg-tekst til sættet (#345): kg gemmes som skrevet, lb omregnes. */
export function weightFromInput(text: string, unit: WeightUnit): string {
  if (unit === 'kg') return text;
  const t = text.trim();
  if (!t) return '';
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? String(fromDisplay(n, 'lb')) : text;
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

/**
 * Vægtfeltet for en kropsvægtsøvelse som tekst (#208): "KV" (ingen ekstra), "KV +10" (vægtbælte)
 * eller "KV −20" (assistance).
 */
export function bodyweightText(weight: string, unit: WeightUnit = 'kg'): string {
  const extra = num(weight);
  if (!extra) return 'KV';
  const abs = unit === 'lb' ? displayNumber(toDisplay(Math.abs(extra), 'lb')) : String(Math.abs(extra)).replace('.', ',');
  return `KV ${extra > 0 ? '+' : '\u2212'}${abs}`;
}

/**
 * Sættet som tekst. Typen følger de udfyldte felter, så gamle sæt (kun reps) vises som før.
 * `bodyweight` = kropsvægtsøvelse: vises som "KV +10 × 8" (#208).
 */
export function formatSet(s: SetEntry, bodyweight = false, unit: WeightUnit = 'kg'): string {
  if ((s.meters ?? '').trim()) {
    const sec = num(s.seconds ?? '');
    return `${s.meters!.trim().replace('.', ',')} m${sec > 0 ? ` · ${formatClock(sec)}` : ''}`;
  }
  if ((s.seconds ?? '').trim() && !s.reps.trim()) return `${num(s.seconds!)} sek.`;
  if (bodyweight) return `${bodyweightText(s.weight, unit)} × ${s.reps}`;
  const w = num(s.weight);
  if (!w) return `${s.reps} reps`;
  return unit === 'lb' ? `${formatWeight(w, 'lb')} × ${s.reps}` : `${s.weight.replace('.', ',')} kg × ${s.reps}`;
}

/** Mærke-tekst efter et sæt i Historik og på øvelsessiden (#245), fx " (drop-sæt)". Tom for almindelige sæt. */
export function setTagSuffix(s: SetEntry): string {
  const name = setTagInfo(s.tag)?.name;
  if (!name) return '';
  return ` (${s.tag === 'amrap' ? name : name.toLowerCase()})`;
}

/** De seneste udførte sæt for en øvelse (fra historikken, nyeste først) */
export function previousSets(history: Workout[], exerciseId: string, skipDeload = false): SetEntry[] {
  if (skipDeload) {
    // Let uge (#362): sammenlign med seneste normale træning; findes kun lette uger, bruges de
    const normal = previousSets(history.filter((w) => !w.deload), exerciseId);
    if (normal.length) return normal;
  }
  for (const w of history) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (ex) {
      const done = ex.sets.filter(isMainSet);
      if (done.length) return done;
    }
  }
  return [];
}

/** "Forrige" sæt for en øvelse i en træning: fra den gentagne træning (#149), ellers seneste gang */
export function previousSetsFor(history: Workout[], w: Pick<Workout, 'id' | 'repeatOf'> | null | undefined, exerciseId: string): SetEntry[] {
  if (w?.repeatOf) {
    const src = history.find((h) => h.id === w.repeatOf && h.id !== w.id);
    const sets = src?.exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter(isMainSet) ?? [];
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
    .filter(isMainSet)
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
  for (const s of sets) addToRecords(r, s);
  return r;
}

/** Lægger ét sæt til rekorderne (ændrer `r`) */
function addToRecords(r: PersonalRecords, s: ScoredSet): void {
  if (s.meters > 0) {
    if (!r.longestDistance || s.meters > r.longestDistance.meters) r.longestDistance = { meters: s.meters, seconds: s.seconds, date: s.date };
    const pace = s.seconds / s.meters;
    if (s.seconds > 0 && (!r.fastest || pace < r.fastest.pace)) r.fastest = { meters: s.meters, seconds: s.seconds, pace, date: s.date };
    return;
  }
  if (s.seconds > 0) {
    if (!r.longestHold || s.seconds > r.longestHold.seconds) r.longestHold = { seconds: s.seconds, date: s.date };
    return;
  }
  if (s.reps <= 0) return;
  if (s.weight > 0 && (!r.heaviest || s.weight > r.heaviest.weight)) r.heaviest = { ...s };
  const e = estimate1RM(s.weight, s.reps);
  if (e > 0 && (!r.best1RM || e > r.best1RM.value)) r.best1RM = { value: e, ...s };
  const key = String(s.weight);
  if (!r.repsAtWeight[key] || s.reps > r.repsAtWeight[key].reps) r.repsAtWeight[key] = { reps: s.reps, date: s.date };
}

/** Rekordtyper et sæt slår i forhold til de hidtidige rekorder `prev` (samme regler som recordsBrokenBy) */
function brokenKinds(prev: PersonalRecords, c: ScoredSet, kind: ExerciseKind): RecordKind[] {
  const broken: RecordKind[] = [];
  if (kind !== 'reps') {
    if (kind === 'time' && prev.longestHold && c.seconds > prev.longestHold.seconds) broken.push('hold');
    if (kind === 'distance' && prev.longestDistance && c.meters > prev.longestDistance.meters) broken.push('distance');
    if (kind === 'distance' && c.seconds > 0 && prev.fastest && c.seconds / c.meters < prev.fastest.pace) broken.push('pace');
    return broken;
  }
  if (c.weight > 0 && prev.heaviest && c.weight > prev.heaviest.weight) broken.push('heaviest');
  const e = estimate1RM(c.weight, c.reps);
  if (e > 0 && prev.best1RM && e > prev.best1RM.value) broken.push('1rm');
  const atWeight = prev.repsAtWeight[String(c.weight)];
  if (atWeight && c.reps > atWeight.reps) broken.push('reps');
  return broken;
}

function historySets(history: Workout[], exerciseId: string, kind: ExerciseKind): ScoredSet[] {
  return history.flatMap((w) =>
    w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => validSets(e.sets, w.startedAt, kind)),
  );
}

/** Rekorder for en øvelse ud fra afsluttede træninger */
export function personalRecords(state: AppState, exerciseId: string): PersonalRecords {
  state = loadedState(state);
  return recordsFrom(historySets(state.history, exerciseId, exerciseKind(state, exerciseId)));
}

/**
 * Hvilke rekorder slår et udført sæt? Sammenlignes med afsluttede træninger og
 * de udførte sæt før det i den aktive træning. Første gang en øvelse laves er ingen rekord.
 */
export function recordsBrokenBy(state: AppState, exerciseId: string, set: SetEntry): RecordKind[] {
  const date = state.active && state.active.exercises.some((we) => we.sets.includes(set)) ? state.active : { startedAt: Date.now() };
  if (!LOADED_SETS.has(set) && isBodyweight(state, exerciseId)) set = { ...set, weight: String(setLoad(state, date, exerciseId, set)) };
  state = loadedState(state);
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
  return brokenKinds(recordsFrom(earlier), candidate, kind);
}

/** Rekorder slået i en afsluttet træning (pr. øvelse), sammenlignet med træninger før den */
export function workoutRecords(state: AppState, workoutId: string): Record<string, RecordKind[]> {
  state = loadedState(state);
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
  state = loadedState(state);
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
  state = loadedState(state);
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

/** Antal dage ind i en ny måned, hvor sidste måneds opsummering vises i Historik (#169) */
export const RECAP_DAYS = 7;

/**
 * Sidste måneds opsummering, hvis den skal vises øverst i Historik (#169):
 * kun de første 7 dage af en ny måned, kun hvis måneden havde træninger, og ikke hvis brugeren har lukket den.
 */
export function recapToShow(state: AppState, now: number): MonthRecap | null {
  const d = new Date(now);
  if (d.getDate() > RECAP_DAYS) return null;
  const r = monthRecap(state, d.getFullYear(), d.getMonth() - 1);
  if (!r.workouts || state.recapDismissed === r.key) return null;
  return r;
}

/** Navnet på en måned på dansk (0 = januar) */
export function monthNameDa(month: number): string {
  return MONTHS_DA[((month % 12) + 12) % 12];
}

/** Samlet træningstid som "5 t 20 min" / "45 min" */
export function formatTotalTime(ms: number): string {
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? (m ? `${h} t ${m} min` : `${h} t`) : `${m} min`;
}

/** "+3 træninger" og "+12 % volumen" i forhold til måneden før (tom liste når måneden før var tom) */
export function recapChangeTexts(r: MonthRecap): string[] {
  if (!r.previous.workouts) return [];
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');
  const out = [`${sign(r.workoutsDiff)}${Math.abs(r.workoutsDiff)} ${Math.abs(r.workoutsDiff) === 1 ? 'træning' : 'træninger'}`];
  if (r.volumeChangePct !== null) out.push(`${sign(r.volumeChangePct)}${Math.abs(r.volumeChangePct)} % volumen`);
  return out;
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
  /** Løftemål nået i denne træning (#201) */
  goals: { goalId: string; exerciseId: string; name: string; weight: number; reps: number }[];
}

/** Den seneste afsluttede træning fra samme skabelon før `w` */
function previousFromTemplate(history: Workout[], w: Workout): Workout | null {
  if (!w.templateId) return null;
  const earlier = history
    .filter((x) => x.id !== w.id && x.templateId === w.templateId && x.finishedAt && x.startedAt < w.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt);
  // Let uge (#362): en let træning sammenlignes ikke med – medmindre der kun er lette træninger
  return earlier.find((x) => !x.deload) ?? earlier[0] ?? null;
}

/** Opsummering af en afsluttet træning: varighed, volumen, sæt, nye rekorder og sammenligning med sidst */
export function workoutSummary(state: AppState, workoutId: string): WorkoutSummary | null {
  state = loadedState(state);
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
    goals: (state.goals ?? [])
      .filter((g) => g.achievedAt !== undefined && g.achievedAt === (w.finishedAt ?? w.startedAt) && w.exercises.some((we) => we.exerciseId === g.exerciseId))
      .map((g) => ({ goalId: g.id, exerciseId: g.exerciseId, name: names.get(g.exerciseId) ?? g.exerciseId, weight: g.weight, reps: g.reps })),
  };
}


/* ---------- Mod sidst (#175) ---------- */

export type VsStatus = 'up' | 'same' | 'down';

export interface VsLastRow {
  /** Øvelsen i den igangværende træning */
  weId: string;
  exerciseId: string;
  name: string;
  /** Hvad der sammenlignes: kg (vægt × reps), sekunder (tid) eller meter (distance) */
  unit: 'kg' | 'sek' | 'm';
  /** Udførte arbejdssæt indtil nu */
  doneSets: number;
  /** Alle arbejdssæt i øvelsen er krydset af (og der er mindst ét) */
  complete: boolean;
  /** Værdien denne gang (udførte arbejdssæt) */
  now: number;
  /** Værdien sidst for det samme antal sæt. null = øvelsen blev ikke lavet sidst (ingen sammenligning). */
  last: number | null;
  /** Hele sidste gang (alle arbejdssæt). null = øvelsen blev ikke lavet sidst. */
  lastTotal: number | null;
  /** Kun når alle sæt er krydset af og der er noget at sammenligne med */
  status: VsStatus | null;
}

export interface VsLastTime {
  /** Træningen, der sammenlignes med */
  previousId: string;
  previousDate: number;
  /** Samlet forskel i kg "på samme sted" (kun vægt × reps-øvelser med en sammenligning) */
  diffKg: number;
  /** Mindst ét arbejdssæt med en sammenligning er krydset af */
  started: boolean;
  rows: VsLastRow[];
}

function setValue(s: SetEntry, kind: ExerciseKind): number {
  if (kind === 'time') return num(s.seconds ?? '');
  if (kind === 'distance') return num(s.meters ?? '');
  return setVolume(s);
}

function compareValues(now: number, last: number): VsStatus {
  const d = Math.round((now - last) * 100) / 100;
  return d > 0 ? 'up' : d < 0 ? 'down' : 'same';
}

/**
 * Den igangværende træning mod sidste gang samme skabelon blev lavet (#175).
 * Pr. øvelse sammenlignes de udførte arbejdssæt med lige så mange arbejdssæt fra sidst ("på samme sted").
 * Opvarmningssæt tæller aldrig. Tids- og distanceøvelser sammenlignes i sekunder/meter og tæller ikke i kg.
 * null = ingen skabelon eller skabelonen er ikke lavet før.
 */
export function vsLastTime(state: AppState, workout: Workout | null): VsLastTime | null {
  if (!workout) return null;
  state = loadedState(state);
  workout = withLoads(state, workout);
  const prev = previousFromTemplate(state.history, workout);
  if (!prev) return null;
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const seen = new Map<string, number>();
  let diffKg = 0;
  let started = false;
  const rows: VsLastRow[] = workout.exercises.map((we) => {
    // Samme øvelse flere gange: n'te forekomst sammenlignes med n'te forekomst sidst
    const occurrence = seen.get(we.exerciseId) ?? 0;
    seen.set(we.exerciseId, occurrence + 1);
    const kind = exerciseKind(state, we.exerciseId);
    const unit = kind === 'time' ? 'sek' : kind === 'distance' ? 'm' : 'kg';
    // Drop-sæt (#243) ændrer ikke "vs. sidst"
    const work = we.sets.filter((s) => !s.warmup && !isDropSet(s));
    const done = work.filter((s) => s.done);
    const complete = work.length > 0 && done.length === work.length;
    const now = done.reduce((a, s) => a + setValue(s, kind), 0);
    const lastWe = prev.exercises.filter((e) => e.exerciseId === we.exerciseId)[occurrence];
    const lastSets = lastWe ? lastWe.sets.filter(isMainSet) : [];
    let last: number | null = null;
    let status: VsStatus | null = null;
    const lastTotal = lastSets.length ? lastSets.reduce((a, s) => a + setValue(s, kind), 0) : null;
    if (lastSets.length) {
      // Når øvelsen er færdig, sammenlignes med hele sidste gang – ellers med de første sæt
      const compared = complete ? lastSets : lastSets.slice(0, done.length);
      last = compared.reduce((a, s) => a + setValue(s, kind), 0);
      if (done.length) {
        started = true;
        if (kind === 'reps') diffKg += now - last;
      }
      if (complete) {
        // Ren kropsvægt (0 kg begge gange): sammenlign reps i stedet
        const repsOnly = kind === 'reps' && now === 0 && last === 0;
        status = repsOnly
          ? compareValues(done.reduce((a, s) => a + num(s.reps), 0), lastSets.reduce((a, s) => a + num(s.reps), 0))
          : compareValues(now, last);
      }
    }
    return { weId: we.id, exerciseId: we.exerciseId, name: names.get(we.exerciseId) ?? we.exerciseId, unit, doneSets: done.length, complete, now, last, lastTotal, status };
  });
  return { previousId: prev.id, previousDate: prev.startedAt, diffKg: Math.round(diffKg * 100) / 100, started, rows };
}

function vsValueText(n: number, unit: VsLastRow['unit'], weightUnit: WeightUnit = 'kg'): string {
  if (unit === 'kg' && weightUnit === 'lb') return `${toDisplay(n, 'lb').toLocaleString('da-DK', { maximumFractionDigits: 1 })} lb`;
  const v = (Math.round(n * 10) / 10).toLocaleString('da-DK', { maximumFractionDigits: 1 });
  return unit === 'sek' ? `${v} sek.` : `${v} ${unit}`;
}

/**
 * Teksten i "Mod sidst"-oversigten for én øvelse (#177): denne gang / sidst.
 * Ikke lavet sidst → "Ny i dag". Ikke startet endnu → "–" denne gang og hele sidste gang.
 */
export function vsRowCells(row: VsLastRow, weightUnit: WeightUnit = 'kg'): { now: string; last: string } {
  const now = row.doneSets ? vsValueText(row.now, row.unit, weightUnit) : '–';
  if (row.last === null || row.lastTotal === null) return { now, last: 'Ny i dag' };
  return { now, last: vsValueText(row.doneSets ? row.last : row.lastTotal, row.unit, weightUnit) };
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
export function shareCardLines(s: WorkoutSummary, unit: WeightUnit = 'kg'): ShareCard {
  const d = new Date(s.startedAt);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    app: 'Løft',
    date: `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${d.getFullYear()}`,
    title: s.name,
    stats: [
      { label: 'Tid', value: formatDuration(s.durationMs) },
      { label: 'Volumen', value: formatWeight(s.volume, unit) },
      { label: 'Sæt', value: `${s.sets} sæt` },
      { label: 'Rekorder', value: String(s.recordCount) },
    ],
    change: volumeChangeText(s.volumeChangePct),
    records: [
      ...(s.goals ?? []).map((g) => `🎯 Mål nået: ${g.name} ${formatWeight(g.weight, unit)} × ${g.reps}`),
      ...s.records.map((r) => `🏆 ${r.name} – ${r.kinds.map((k) => RECORD_NAMES[k]).join(', ')}`),
    ],
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

/* ---------- Ugeplan (#322) ---------- */

/** Gyldige træningsdage: heltal 0–6 (mandag–søndag), sorteret og uden dubletter */
export function cleanTrainingDays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

export interface WeekPlanDay {
  /** 0 = mandag … 6 = søndag */
  day: number;
  /** Dagens start (lokal midnat) */
  date: number;
  planned: boolean;
  /** En afsluttet træning den dag */
  done: boolean;
  today: boolean;
}

export interface WeekPlan {
  days: WeekPlanDay[];
  plannedCount: number;
  /** Træningsdage i denne uge (højst én pr. dag) */
  doneCount: number;
  todayIsTrainingDay: boolean;
  /** Planlagte dage minus trænede dage, mindst 0 */
  missing: number;
  /** Dage efter i dag i denne uge */
  daysLeft: number;
}

/** Ugeplanen for den aktuelle uge: planlagte og trænede dage (#322) */
export function weekPlan(state: Pick<AppState, 'history' | 'trainingDays'>, now: number): WeekPlan {
  const planned = new Set(cleanTrainingDays(state.trainingDays));
  const start = startOfWeek(now);
  const dayStarts: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i); // tåler sommertid
    dayStarts.push(d.getTime());
  }
  const dayOf = (t: number) => {
    for (let i = 6; i >= 0; i--) if (t >= dayStarts[i]) return i;
    return -1;
  };
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const doneDays = new Set<number>();
  for (const w of state.history) {
    if (!w.finishedAt || w.startedAt < start || w.startedAt >= end.getTime()) continue;
    doneDays.add(dayOf(w.startedAt));
  }
  const todayIdx = dayOf(now);
  const days = dayStarts.map((date, day) => ({ day, date, planned: planned.has(day), done: doneDays.has(day), today: day === todayIdx }));
  return {
    days,
    plannedCount: planned.size,
    doneCount: doneDays.size,
    todayIsTrainingDay: planned.has(todayIdx),
    missing: Math.max(0, planned.size - doneDays.size),
    daysLeft: 6 - todayIdx,
  };
}

/** "Du mangler 1 træning – du har 2 dage tilbage" sidst på ugen (torsdag+), når det stadig kan nås (#324) */
export function weekPlanNudge(plan: WeekPlan): { missing: number; daysAvailable: number } | null {
  const today = plan.days.find((d) => d.today);
  if (!today || today.day < 3 || plan.missing <= 0) return null;
  const daysAvailable = plan.daysLeft + (today.done ? 0 : 1);
  return plan.missing <= daysAvailable ? { missing: plan.missing, daysAvailable } : null;
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
  state = loadedState(state);
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

/* ---------- Årets træningskort (#264) ---------- */

export interface HeatmapDay {
  /** Midnat (lokal tid) for dagen */
  date: number;
  /** false for de dage før 1. jan / efter 31. dec, der kun fylder gitteret ud til hele uger */
  inYear: boolean;
  /** Udførte arbejdssæt den dag (alle træninger lagt sammen) */
  workSets: number;
  /** Løftet vægt den dag (kg) */
  volume: number;
  /** 0 = ingen træning; 1–4 = kvartiler af årets træningsdage efter arbejdssæt (travleste dag = 4) */
  level: 0 | 1 | 2 | 3 | 4;
  /** Dagens træninger (ældste først) */
  workoutIds: string[];
}

export interface YearHeatmap {
  year: number;
  /** Mandag-først uger: gitteret starter på en mandag og slutter på en søndag */
  days: HeatmapDay[];
  trainingDays: number;
  /** Flest uger i træk med mindst én træning i året */
  longestWeekStreak: number;
  /** Måneden (0 = januar) med flest træningsdage – ved lighed den tidligste. null uden træning. */
  busiestMonth: number | null;
}

/** Ét felt pr. dag i `year` med træningsmængde og niveau 0–4, plus årets nøgletal */
export function yearHeatmap(history: Workout[], year: number): YearHeatmap {
  const byDay = new Map<number, { workSets: number; volume: number; workoutIds: string[] }>();
  for (const w of [...history].sort((a, b) => a.startedAt - b.startedAt)) {
    if (new Date(w.startedAt).getFullYear() !== year) continue;
    const key = dayStart(w.startedAt);
    const e = byDay.get(key) ?? { workSets: 0, volume: 0, workoutIds: [] };
    e.workSets += w.exercises.reduce((n, ex) => n + ex.sets.filter(isWorkSet).length, 0);
    e.volume += workoutVolume(w);
    e.workoutIds.push(w.id);
    byDay.set(key, e);
  }
  const counts = [...byDay.values()].map((e) => e.workSets).sort((a, b) => a - b);
  const levelOf = (sets: number): HeatmapDay['level'] => {
    // Andelen af træningsdage med højst så mange sæt → kvartil 1–4 (travleste dag = 4)
    let atMost = 0;
    while (atMost < counts.length && counts[atMost] <= sets) atMost++;
    return Math.max(1, Math.ceil((4 * atMost) / counts.length)) as HeatmapDay['level'];
  };

  const days: HeatmapDay[] = [];
  const jan1 = new Date(year, 0, 1);
  const lead = (jan1.getDay() + 6) % 7; // dage fra mandag til 1. jan
  for (let i = -lead; ; i++) {
    const d = new Date(year, 0, 1 + i);
    const inYear = d.getFullYear() === year;
    if (!inYear && i > 0 && d.getDay() === 1) break; // gitteret slutter på søndagen efter 31. dec
    const e = inYear ? byDay.get(d.getTime()) : undefined;
    days.push({
      date: d.getTime(),
      inYear,
      workSets: e?.workSets ?? 0,
      volume: e?.volume ?? 0,
      level: e ? levelOf(e.workSets) : 0,
      workoutIds: e?.workoutIds ?? [],
    });
  }

  // Længste række af uger med træning (ugerne i gitteret, mandag-først)
  let longestWeekStreak = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 7) {
    if (days.slice(i, i + 7).some((d) => d.workoutIds.length > 0)) longestWeekStreak = Math.max(longestWeekStreak, ++run);
    else run = 0;
  }

  const perMonth = new Array<number>(12).fill(0);
  for (const key of byDay.keys()) perMonth[new Date(key).getMonth()]++;
  const top = Math.max(...perMonth);
  return {
    year,
    days,
    trainingDays: byDay.size,
    longestWeekStreak,
    busiestMonth: top > 0 ? perMonth.indexOf(top) : null,
  };
}

/** Årene med træninger, nyeste først – altid inklusive indeværende år */
export function heatmapYears(history: Workout[], now: number): number[] {
  const years = new Set(history.map((w) => new Date(w.startedAt).getFullYear()));
  years.add(new Date(now).getFullYear());
  return [...years].sort((a, b) => b - a);
}

/* ---------- Dit træningsår (#307) ---------- */

/** Ting at sammenligne årets løftede vægt med, tungeste først (kg pr. stk.) */
export const VOLUME_COMPARISONS: { kg: number; one: string; many: string; icon: string }[] = [
  { kg: 150_000, one: 'blåhval', many: 'blåhvaler', icon: '🐋' },
  { kg: 6_000, one: 'elefant', many: 'elefanter', icon: '🐘' },
  { kg: 1_500, one: 'bil', many: 'biler', icon: '🚗' },
  { kg: 500, one: 'hest', many: 'heste', icon: '🐎' },
  { kg: 75, one: 'vaskemaskine', many: 'vaskemaskiner', icon: '🧺' },
  { kg: 7, one: 'bowlingkugle', many: 'bowlingkugler', icon: '🎳' },
];

export interface VolumeComparison {
  count: number;
  /** "elefanter" / "elefant" */
  name: string;
  icon: string;
  /** "= 4 elefanter" */
  text: string;
}

/** Sjov sammenligning af en vægt: den tungeste ting, der giver mindst 1 stk. (1–999). null under 7 kg. */
export function volumeComparison(kg: number): VolumeComparison | null {
  for (const c of VOLUME_COMPARISONS) {
    const count = Math.round(kg / c.kg);
    if (count < 1) continue;
    if (count > 999 && c !== VOLUME_COMPARISONS[0]) return null;
    const name = count === 1 ? c.one : c.many;
    return { count, name, icon: c.icon, text: `= ${count.toLocaleString('da-DK')} ${name}` };
  }
  return null;
}

export interface YearReview {
  year: number;
  workouts: number;
  /** Samlet træningstid i ms (pauser tæller ikke med) */
  durationMs: number;
  /** Løftet vægt i kg (arbejdssæt; kropsvægtsøvelser tæller med kropsvægten) */
  volume: number;
  comparison: VolumeComparison | null;
  /** Dage med mindst én træning */
  trainingDays: number;
  /** Øvelsen i flest træninger (ved lighed flest arbejdssæt) */
  favourite: { exerciseId: string; name: string; workouts: number; sets: number } | null;
  /** Måneden med mest løftet vægt (0 = januar) */
  strongestMonth: { month: number; name: string; volume: number } | null;
  /** Rekorder 🏆 sat i året (samme optælling som under træningen) */
  records: number;
  /** Årets største 1RM-rekord: det største spring i estimeret 1RM (kun vægt × reps-øvelser) */
  biggestRecord: { exerciseId: string; name: string; from: number; to: number; date: number } | null;
  /** Flest ISO-uger i træk med mindst én træning inden for året */
  longestWeekStreak: number;
  /** Op til 3 øvelser med højest estimeret 1RM ved årets slutning: bedste e1RM i første træningsmåned mod hele året */
  liftGrowth: LiftGrowth[];
}

export interface LiftGrowth {
  exerciseId: string;
  name: string;
  /** Bedste e1RM i den første måned øvelsen blev trænet i året */
  start: number;
  /** Bedste e1RM i hele året */
  end: number;
  /** Fremgang i hele procent */
  pct: number;
}

/** Rekorder sat i `year` i én gennemgang af hele historikken (ældste først) */
function yearRecords(state: AppState, year: number): Pick<YearReview, 'records' | 'biggestRecord'> {
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const prev = new Map<string, PersonalRecords>();
  let records = 0;
  let biggestRecord: YearReview['biggestRecord'] = null;
  for (const w of [...state.history].sort((a, b) => a.startedAt - b.startedAt)) {
    const inYear = new Date(w.startedAt).getFullYear() === year;
    const kinds = new Map<string, Set<RecordKind>>();
    for (const we of w.exercises) {
      const kind = exerciseKind(state, we.exerciseId);
      for (const s of validSets(we.sets, w.startedAt, kind)) {
        const r = prev.get(we.exerciseId);
        if (inYear && r) {
          const broken = brokenKinds(r, s, kind);
          if (broken.length) {
            const set = kinds.get(we.exerciseId) ?? new Set<RecordKind>();
            for (const k of broken) set.add(k);
            kinds.set(we.exerciseId, set);
          }
          if (broken.includes('1rm') && r.best1RM) {
            const to = estimate1RM(s.weight, s.reps);
            if (!biggestRecord || to - r.best1RM.value > biggestRecord.to - biggestRecord.from)
              biggestRecord = { exerciseId: we.exerciseId, name: names.get(we.exerciseId) ?? we.exerciseId, from: r.best1RM.value, to, date: w.startedAt };
          }
        }
        if (r) addToRecords(r, s);
        else prev.set(we.exerciseId, recordsFrom([s]));
      }
    }
    for (const set of kinds.values()) records += set.size;
  }
  return { records, biggestRecord };
}

/** Hvordan de stærkeste løft voksede i året (op til 3, højeste e1RM først) */
function yearLiftGrowth(state: AppState, list: Workout[]): LiftGrowth[] {
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const per = new Map<string, { firstMonth: number; start: number; end: number; workouts: Set<string> }>();
  for (const w of [...list].sort((a, b) => a.startedAt - b.startedAt)) {
    const month = new Date(w.startedAt).getMonth();
    for (const we of w.exercises) {
      if (exerciseKind(state, we.exerciseId) !== 'reps') continue;
      let best = 0;
      for (const s of we.sets) if (isMainSet(s) && !isTimedSet(s)) best = Math.max(best, estimate1RM(num(s.weight), num(s.reps)));
      if (best <= 0) continue;
      const e = per.get(we.exerciseId) ?? { firstMonth: month, start: 0, end: 0, workouts: new Set<string>() };
      if (month === e.firstMonth) e.start = Math.max(e.start, best);
      e.end = Math.max(e.end, best);
      e.workouts.add(w.id);
      per.set(we.exerciseId, e);
    }
  }
  return [...per.entries()]
    .filter(([, e]) => e.workouts.size > 1)
    .sort((a, b) => b[1].end - a[1].end)
    .slice(0, 3)
    .map(([exerciseId, e]) => ({
      exerciseId,
      name: names.get(exerciseId) ?? exerciseId,
      start: e.start,
      end: e.end,
      pct: Math.round(((e.end - e.start) / e.start) * 100),
    }));
}

/** Afsluttede træninger i et kalenderår */
function workoutsInYear(history: Workout[], year: number): Workout[] {
  return history.filter((w) => new Date(w.startedAt).getFullYear() === year);
}

/** Årets træning (#307): tal for alle afsluttede træninger i `year`. Intet gemmes – alt beregnes fra historikken. */
export function yearReview(state: AppState, year: number): YearReview {
  state = loadedState(state);
  const list = workoutsInYear(state.history, year);
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const exStats = new Map<string, { workouts: number; sets: number }>();
  const monthVolume = new Array<number>(12).fill(0);
  const days = new Set<number>();
  let durationMs = 0;
  let volume = 0;
  for (const w of list) {
    durationMs += workoutDuration(w, w.finishedAt ?? w.startedAt);
    const v = workoutVolume(w);
    volume += v;
    monthVolume[new Date(w.startedAt).getMonth()] += v;
    days.add(dayStart(w.startedAt));
    const setsHere = new Map<string, number>();
    for (const we of w.exercises) {
      const n = we.sets.filter(isWorkSet).length;
      if (n) setsHere.set(we.exerciseId, (setsHere.get(we.exerciseId) ?? 0) + n);
    }
    for (const [id, n] of setsHere) {
      const e = exStats.get(id) ?? { workouts: 0, sets: 0 };
      exStats.set(id, { workouts: e.workouts + 1, sets: e.sets + n });
    }
  }
  let favourite: YearReview['favourite'] = null;
  for (const [exerciseId, e] of exStats) {
    if (!favourite || e.workouts > favourite.workouts || (e.workouts === favourite.workouts && e.sets > favourite.sets))
      favourite = { exerciseId, name: names.get(exerciseId) ?? exerciseId, ...e };
  }
  const top = Math.max(...monthVolume);
  const month = monthVolume.indexOf(top);
  return {
    year,
    workouts: list.length,
    durationMs,
    volume,
    comparison: volumeComparison(volume),
    trainingDays: days.size,
    favourite,
    strongestMonth: top > 0 ? { month, name: monthNameDa(month), volume: top } : null,
    ...yearRecords(state, year),
    longestWeekStreak: yearHeatmap(state.history, year).longestWeekStreak,
    liftGrowth: yearLiftGrowth(state, list),
  };
}

/** Årene med mindst én afsluttet træning, nyeste først */
export function yearsWithWorkouts(state: Pick<AppState, 'history'>): number[] {
  return [...new Set(state.history.map((w) => new Date(w.startedAt).getFullYear()))].sort((a, b) => b - a);
}

/**
 * Året, hvis "Dit træningsår"-kort skal vises øverst i Historik (#309): i december det igangværende år,
 * i januar året der lige er slut. null resten af året, hvis året ikke har træninger, eller hvis kortet er skjult.
 */
export function yearReviewCardYear(state: Pick<AppState, 'history' | 'yearReviewHidden'>, now: number): number | null {
  const d = new Date(now);
  const month = d.getMonth();
  if (month !== 11 && month !== 0) return null;
  const year = month === 11 ? d.getFullYear() : d.getFullYear() - 1;
  if ((state.yearReviewHidden ?? []).includes(year)) return null;
  return yearsWithWorkouts(state).includes(year) ? year : null;
}

export interface YearSlide {
  id: 'intro' | 'volume' | 'favourite' | 'records' | 'streak' | 'month' | 'growth' | 'end';
  icon: string;
  title: string;
  /** Det store tal/navn midt på sliden */
  big: string;
  lines: string[];
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('da-DK')} ${n === 1 ? one : many}`;

/** Sliderne i "Dit træningsår"-historien (#309). Slides uden data springes over. */
export function yearReviewSlides(r: YearReview, unit: WeightUnit = 'kg'): YearSlide[] {
  const slides: YearSlide[] = [
    {
      id: 'intro',
      icon: '🎉',
      title: `Dit træningsår ${r.year}`,
      big: plural(r.workouts, 'træning', 'træninger'),
      lines: [`${formatTotalTime(r.durationMs)} under stangen`, `${plural(r.trainingDays, 'dag', 'dage')} med træning`],
    },
  ];
  if (r.volume > 0)
    slides.push({
      id: 'volume',
      icon: r.comparison?.icon ?? '🏋️',
      title: 'Du løftede i alt',
      big: formatTons(r.volume, unit),
      lines: r.comparison ? [`Det svarer til ${r.comparison.text.replace(/^= /, '')}`] : [],
    });
  if (r.favourite)
    slides.push({
      id: 'favourite',
      icon: '❤️',
      title: 'Din favoritøvelse',
      big: r.favourite.name,
      lines: [`${plural(r.favourite.workouts, 'træning', 'træninger')} · ${plural(r.favourite.sets, 'sæt', 'sæt')}`],
    });
  if (r.records > 0)
    slides.push({
      id: 'records',
      icon: '🏆',
      title: 'Nye rekorder',
      big: plural(r.records, 'rekord', 'rekorder'),
      lines: r.biggestRecord
        ? [`Største spring: ${r.biggestRecord.name}`, `${formatWeight(r.biggestRecord.from, unit)} → ${formatWeight(r.biggestRecord.to, unit)} (est. 1RM)`]
        : [],
    });
  if (r.longestWeekStreak > 0)
    slides.push({
      id: 'streak',
      icon: '🔥',
      title: 'Længste stime',
      big: plural(r.longestWeekStreak, 'uge', 'uger'),
      lines: ['i træk med mindst én træning'],
    });
  if (r.strongestMonth)
    slides.push({
      id: 'month',
      icon: '📅',
      title: 'Din stærkeste måned',
      big: r.strongestMonth.name,
      lines: [`${formatTons(r.strongestMonth.volume, unit)} løftet`],
    });
  if (r.liftGrowth.length)
    slides.push({
      id: 'growth',
      icon: '📈',
      title: 'Sådan voksede dine løft',
      big: `+${r.liftGrowth[0].pct} %`,
      lines: r.liftGrowth.map((g) => `${g.name}: ${formatWeight(Math.round(g.start), unit)} → ${formatWeight(Math.round(g.end), unit)} (+${g.pct} %)`),
    });
  slides.push({
    id: 'end',
    icon: '💪',
    title: 'Godt gået!',
    big: `${r.year} er i bogen`,
    lines: ['Tak fordi du mødte op. Vi ses under stangen!'],
  });
  return slides;
}

export interface YearShareCard {
  app: string;
  title: string;
  stats: { label: string; value: string }[];
  lines: string[];
  fileName: string;
}

/** Teksten til delebilledet "Mit træningsår" (#310) – ren funktion, så den kan testes */
export function yearShareCardLines(r: YearReview, unit: WeightUnit = 'kg'): YearShareCard {
  return {
    app: 'Løft',
    title: `Mit træningsår ${r.year}`,
    stats: [
      { label: 'Træninger', value: r.workouts.toLocaleString('da-DK') },
      { label: 'Tid', value: formatTotalTime(r.durationMs) },
      { label: 'Løftet', value: formatTons(r.volume, unit) },
      { label: 'Længste stime', value: plural(r.longestWeekStreak, 'uge', 'uger') },
    ],
    lines: [
      ...(r.favourite ? [`❤️ Favoritøvelse: ${r.favourite.name}`] : []),
      ...(r.records ? [`🏆 ${plural(r.records, 'rekord', 'rekorder')}`] : []),
      ...(r.comparison ? [`${r.comparison.icon} Det svarer til ${r.comparison.text.replace(/^= /, '')}`] : []),
    ],
    fileName: `loeft-traeningsaar-${r.year}.png`,
  };
}

/* ---------- Milepæle (#182) ---------- */

export type MilestoneGroup = 'workouts' | 'volume' | 'streak' | 'lift';

export interface Milestone {
  id: string;
  group: MilestoneGroup;
  /** Dansk navn, fx "10 træninger" */
  label: string;
  icon: string;
  /** Målet (antal træninger, kg i alt, uger i træk eller kg i ét sæt). null = ukendt (ingen kropsvægt). */
  target: number | null;
  /** Hvor langt man er nu (samme enhed som target) */
  current: number;
  /** Tidspunkt for træningen, der låste den op (null = låst) */
  unlockedAt: number | null;
  unlockedBy: string | null;
}

const MILESTONE_DEFS: { id: string; group: MilestoneGroup; label: string; icon: string; target?: number }[] = [
  { id: 'workouts-1', group: 'workouts', label: 'Første træning', icon: '🎯', target: 1 },
  { id: 'workouts-10', group: 'workouts', label: '10 træninger', icon: '💪', target: 10 },
  { id: 'workouts-25', group: 'workouts', label: '25 træninger', icon: '🔥', target: 25 },
  { id: 'workouts-50', group: 'workouts', label: '50 træninger', icon: '⭐', target: 50 },
  { id: 'workouts-100', group: 'workouts', label: '100 træninger', icon: '🏅', target: 100 },
  { id: 'workouts-250', group: 'workouts', label: '250 træninger', icon: '👑', target: 250 },
  { id: 'volume-1t', group: 'volume', label: '1 ton løftet', icon: '🧱', target: 1_000 },
  { id: 'volume-10t', group: 'volume', label: '10 tons løftet', icon: '🚚', target: 10_000 },
  { id: 'volume-100t', group: 'volume', label: '100 tons løftet', icon: '🐋', target: 100_000 },
  { id: 'volume-1000t', group: 'volume', label: '1000 tons løftet', icon: '🏔️', target: 1_000_000 },
  { id: 'streak-4', group: 'streak', label: '4 uger i træk', icon: '📅', target: 4 },
  { id: 'streak-12', group: 'streak', label: '12 uger i træk', icon: '🗓️', target: 12 },
  { id: 'streak-26', group: 'streak', label: '26 uger i træk', icon: '⚡', target: 26 },
  { id: 'streak-52', group: 'streak', label: '52 uger i træk', icon: '🏆', target: 52 },
  { id: 'lift-bodyweight', group: 'lift', label: 'Løftet din kropsvægt', icon: '🦍' },
  { id: 'lift-100', group: 'lift', label: '100 kg i ét løft', icon: '🏋️', target: 100 },
];

/** Kropsvægten på en dato: seneste måling før/på datoen, ellers den tidligste måling. null = ingen målinger. */
export function bodyWeightAt(bodyLog: BodyMeasurement[], at: number): number | null {
  const withWeight = bodyLog.filter((m) => (m.weight ?? 0) > 0).sort((a, b) => a.date - b.date);
  if (!withWeight.length) return null;
  let found = withWeight[0];
  for (const m of withWeight) if (m.date <= at) found = m;
  return found.weight!;
}

/** Logges øvelsen som kropsvægt + ekstra vægt × reps (#208)? Kropsvægtsøvelser af typen vægt × reps (ikke fx planke). */
export function isBodyweightReps(state: Pick<AppState, 'exercises'>, exerciseId: string): boolean {
  return isBodyweight(state, exerciseId) && exerciseKind(state, exerciseId) === 'reps';
}

/** Er øvelsen en kropsvægtsøvelse (#206)? Det er øvelser med udstyret "Kropsvægt" – indbyggede og egne. */
export function isBodyweight(state: Pick<AppState, 'exercises'>, exerciseId: string): boolean {
  return state.exercises.find((e) => e.id === exerciseId)?.equipment === 'Kropsvægt';
}

/**
 * Kropsvægten på en dato til kropsvægtsøvelser (#206): seneste kropsmål på/før datoen, ellers den første
 * måling efter, ellers indstillingen i Profil, ellers null (ukendt).
 */
export function bodyWeightOn(state: Pick<AppState, 'bodyLog' | 'bodyWeight'>, date: number): number | null {
  const measured = bodyWeightAt(state.bodyLog ?? [], date);
  if (measured !== null) return measured;
  const setting = state.bodyWeight;
  return typeof setting === 'number' && setting > 0 ? setting : null;
}

/**
 * Belastningen i et sæt i kg (#207). For kropsvægtsøvelser er vægtfeltet ekstra vægt (+10 = vægtbælte,
 * −20 = assistance, tomt = 0), og belastningen er kropsvægten på træningens dato + ekstra (aldrig under 0).
 * Kendes kropsvægten ikke, tæller kun den ekstra vægt – som før. Andre øvelser: bare vægten.
 */
export function setLoad(
  state: Pick<AppState, 'exercises' | 'bodyLog' | 'bodyWeight'>,
  workout: Pick<Workout, 'startedAt'>,
  exerciseId: string,
  set: SetEntry,
): number {
  const extra = num(set.weight);
  if (LOADED_SETS.has(set) || !isBodyweight(state, exerciseId)) return extra;
  const bw = bodyWeightOn(state, workout.startedAt) ?? 0;
  return Math.max(0, Math.round((bw + extra) * 100) / 100);
}

/** Sæt og træninger, hvor vægtfeltet allerede er belastningen – så den aldrig lægges til to gange */
const LOADED_SETS = new WeakSet<SetEntry>();
const LOADED_WORKOUTS = new WeakSet<Workout>();
const loadCache = new WeakMap<Workout, { ctx: unknown[]; out: Workout }>();

/**
 * Træningen med belastningen (#207) i vægtfeltet for kropsvægtsøvelser – til tal (volumen, rekorder, statistik).
 * Gemte data ændres ikke; det beregnes, når det vises. Visning af sæt bruger stadig den rå træning.
 */
export function withLoads(state: Pick<AppState, 'exercises' | 'bodyLog' | 'bodyWeight'>, w: Workout): Workout {
  if (LOADED_WORKOUTS.has(w)) return w;
  const ctx = [state.exercises, state.bodyLog, state.bodyWeight];
  const hit = loadCache.get(w);
  if (hit && hit.ctx.every((x, i) => x === ctx[i])) return hit.out;
  let out = w;
  if (w.exercises.some((we) => isBodyweight(state, we.exerciseId))) {
    out = {
      ...w,
      exercises: w.exercises.map((we) => {
        if (!isBodyweight(state, we.exerciseId)) return we;
        return {
          ...we,
          sets: we.sets.map((s) => {
            if (LOADED_SETS.has(s) || isTimedSet(s)) return s;
            const loaded = { ...s, weight: String(setLoad(state, w, we.exerciseId, s)) };
            LOADED_SETS.add(loaded);
            return loaded;
          }),
        };
      }),
    };
  }
  LOADED_WORKOUTS.add(out);
  loadCache.set(w, { ctx, out });
  return out;
}

const stateCache = new WeakMap<AppState, AppState>();

/** Hele tilstanden med belastning i historikken og den aktive træning (#207) – til beregninger */
export function loadedState(state: AppState): AppState {
  const hit = stateCache.get(state);
  if (hit) return hit;
  const load = (w: Workout | null) => (w ? withLoads(state, w) : w);
  const history = state.history.map((w) => withLoads(state, w));
  const changed = history.some((w, i) => w !== state.history[i]) || load(state.active) !== state.active;
  const out = changed ? { ...state, history, active: load(state.active) } : state;
  stateCache.set(state, out);
  stateCache.set(out, out);
  return out;
}

/** Tungeste udførte arbejdssæt (vægt × reps, mindst 1 rep) i en træning */
function heaviestSet(w: Workout): number {
  let best = 0;
  for (const we of w.exercises)
    for (const s of we.sets) if (isWorkSet(s) && !isTimedSet(s) && num(s.reps) > 0) best = Math.max(best, num(s.weight));
  return best;
}

/**
 * Alle milepæle med status og fremskridt (#182). Beregnes fra historikken og kropsmål – intet gemmes.
 * Træningerne gennemgås i tidsorden; en milepæl låses op af den træning, der krydser grænsen.
 * Opvarmning tæller aldrig. "Uger i træk" bruger det nuværende ugemål.
 */
export function milestones(state: AppState): Milestone[] {
  const out: Milestone[] = MILESTONE_DEFS.map((d) => ({
    id: d.id, group: d.group, label: d.label, icon: d.icon, target: d.target ?? null, current: 0, unlockedAt: null, unlockedBy: null,
  }));
  const goal = Math.max(1, state.weeklyGoal || 1);
  const weekCount = new Map<number, number>();
  const weekRun = new Map<number, number>();
  let count = 0;
  let volume = 0;
  let longest = 0;
  let heaviest = 0;
  const unlock = (m: Milestone, w: Workout) => {
    if (m.unlockedAt === null) { m.unlockedAt = w.startedAt; m.unlockedBy = w.id; }
  };
  for (const w of [...state.history].sort((a, b) => a.startedAt - b.startedAt)) {
    count++;
    volume += workoutVolume(withLoads(state, w));
    const ws = startOfWeek(w.startedAt);
    const n = (weekCount.get(ws) ?? 0) + 1;
    weekCount.set(ws, n);
    if (n === goal) {
      const run = (weekRun.get(startOfWeek(ws - DAY_MS)) ?? 0) + 1;
      weekRun.set(ws, run);
      longest = Math.max(longest, run);
    }
    const top = heaviestSet(w);
    heaviest = Math.max(heaviest, top);
    const bw = bodyWeightAt(state.bodyLog, w.startedAt);
    const bodyWeightLift = bw !== null && top >= bw;
    for (const m of out) {
      const reached =
        m.group === 'workouts' ? count >= m.target! :
        m.group === 'volume' ? volume >= m.target! :
        m.group === 'streak' ? longest >= m.target! :
        m.id === 'lift-100' ? heaviest >= 100 :
        bodyWeightLift;
      if (reached) unlock(m, w);
    }
  }
  const bwNow = bodyWeightAt(state.bodyLog, Date.now());
  for (const m of out) {
    if (m.group === 'workouts') m.current = count;
    else if (m.group === 'volume') m.current = Math.round(volume);
    else if (m.group === 'streak') m.current = longest;
    else if (m.id === 'lift-100') m.current = heaviest;
    else {
      m.target = bwNow;
      m.current = heaviest;
    }
  }
  return out;
}

/** Milepælene, som en bestemt (afsluttet) træning låste op (#182) – til fejringen på opsummeringen */
export function milestonesUnlockedBy(state: AppState, workoutId: string): Milestone[] {
  return milestones(state).filter((m) => m.unlockedBy === workoutId);
}

/** Fremskridt som tekst, fx "38 / 50 træninger", "4,2 / 10 t" (#182) */
export function milestoneProgressText(m: Milestone): string {
  const n = (v: number) => v.toLocaleString('da-DK', { maximumFractionDigits: 1 });
  if (m.target === null) return 'Kræver en kropsvægt';
  switch (m.group) {
    case 'workouts': return `${n(Math.min(m.current, m.target))} / ${n(m.target)} træninger`;
    case 'volume': return `${n(Math.floor(Math.min(m.current, m.target) / 100) / 10)} / ${n(m.target / 1000)} t`;
    case 'streak': return `${n(Math.min(m.current, m.target))} / ${n(m.target)} uger`;
    case 'lift': return `${n(Math.min(m.current, m.target))} / ${n(m.target)} kg`;
  }
}

/** Tilgængelig etiket til en milepæl-flise (#183), fx "10 træninger – låst, 1 af 10 træninger" */
export function milestoneTileLabel(m: Milestone): string {
  if (m.unlockedAt !== null) {
    const d = new Date(m.unlockedAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${m.label} – låst op ${d}`;
  }
  if (m.target === null) return `${m.label} – låst, kræver en kropsvægt`;
  return `${m.label} – låst, ${milestoneProgressText(m).replace(' / ', ' af ')}`;
}

export interface MuscleShare {
  muscle: Muscle;
  sets: number;
  volume: number;
}

/** Udførte sæt og volumen pr. muskelgruppe for træninger fra `sinceMs` (0 = alt) */
export function muscleDistribution(state: AppState, sinceMs: number): MuscleShare[] {
  state = loadedState(state);
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

/* ---------- Ugentlige sætmål pr. muskelgruppe (#300) ---------- */

export const DEFAULT_SET_TARGETS: Record<Muscle, number> = { Bryst: 12, Ryg: 14, Ben: 12, Skuldre: 10, Arme: 10, Mave: 8 };
export const SET_TARGET_MIN = 1;
export const SET_TARGET_MAX = 40;

/** Et gyldigt mål (1–40, hele sæt) eller null (slået fra) */
export function clampSetTarget(v: number | null | undefined): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(SET_TARGET_MAX, Math.max(SET_TARGET_MIN, Math.round(v)));
}

/** Målene for alle muskelgrupper; manglende eller ugyldige værdier får standardmålet */
export function setTargetsOf(state: Partial<Pick<AppState, 'setTargets'>>): Record<Muscle, number | null> {
  const saved = (state.setTargets && typeof state.setTargets === 'object' ? state.setTargets : {}) as Partial<Record<Muscle, unknown>>;
  const out = {} as Record<Muscle, number | null>;
  for (const m of MUSCLES) {
    const v = saved[m];
    out[m] = v === null ? null : typeof v === 'number' && Number.isFinite(v) ? clampSetTarget(v) : DEFAULT_SET_TARGETS[m];
  }
  return out;
}

export interface WeeklySetRow {
  muscle: Muscle;
  /** Udførte arbejdssæt i denne uge (mandag–søndag), inkl. den aktive træning */
  done: number;
  target: number | null;
  reached: boolean;
}

/** Ugens arbejdssæt pr. muskelgruppe mod målet. Opvarmning tæller aldrig; den aktive træning tæller med. */
export function weeklySetProgress(state: AppState, now: number): WeeklySetRow[] {
  const from = startOfWeek(now);
  // Næste mandag (tirsdag i næste uge → ugens start), så sommertid ikke flytter grænsen
  const nextMonday = startOfWeek(from + 8 * DAY_MS);
  const muscleOf = new Map(state.exercises.map((e) => [e.id, e.muscle]));
  const counts = new Map<Muscle, number>(MUSCLES.map((m) => [m, 0]));
  const workouts = state.active ? [...state.history, state.active] : state.history;
  for (const w of workouts) {
    if (w.startedAt < from || w.startedAt >= nextMonday) continue;
    for (const we of w.exercises) {
      const m = muscleOf.get(we.exerciseId);
      if (!m || !counts.has(m)) continue;
      counts.set(m, counts.get(m)! + we.sets.filter(isWorkSet).length);
    }
  }
  const targets = setTargetsOf(state);
  return MUSCLES.map((m) => {
    const done = counts.get(m) ?? 0;
    const target = targets[m];
    return { muscle: m, done, target, reached: target !== null && done >= target };
  });
}

/* ---------- Restitution pr. muskelgruppe (#286) ---------- */

export type RecoveryStatus = 'rested' | 'recent' | 'hard';

export interface MuscleRecovery {
  muscle: Muscle;
  /** Starttidspunkt for den seneste afsluttede træning med et udført arbejdssæt for musklen (null = aldrig) */
  lastTrainedAt: number | null;
  /** Hele kalenderdage siden (0 = i dag, null = aldrig) */
  daysSince: number | null;
  /** Udførte arbejdssæt de sidste 7 dage */
  hardSets7d: number;
  lastWorkoutId: string | null;
  status: RecoveryStatus;
}

const HOUR = 3_600_000;
/** Så mange arbejdssæt inden for 48 timer = hårdt trænet */
export const RECOVERY_HARD_SETS = 6;

function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Hele kalenderdage mellem to tidspunkter (lokal tid) */
function calendarDaysBetween(from: number, to: number): number {
  return Math.round((dayStart(to) - dayStart(from)) / 86_400_000);
}

/** Hvor hvilet er hver muskelgruppe? Udregnes fra historikken – intet gemmes. */
export function muscleRecovery(state: Pick<AppState, 'history' | 'exercises'>, now: number): MuscleRecovery[] {
  const muscleOf = new Map(state.exercises.map((e) => [e.id, e.muscle]));
  const rows = new Map<Muscle, MuscleRecovery & { sets48h: number }>(
    MUSCLES.map((m) => [
      m,
      { muscle: m, lastTrainedAt: null, daysSince: null, hardSets7d: 0, lastWorkoutId: null, status: 'rested', sets48h: 0 },
    ]),
  );
  for (const w of state.history) {
    if (!w.finishedAt || w.startedAt > now) continue;
    for (const we of w.exercises) {
      const row = rows.get(muscleOf.get(we.exerciseId) as Muscle);
      if (!row) continue;
      const sets = we.sets.filter(isWorkSet).length;
      if (!sets) continue;
      if (row.lastTrainedAt === null || w.startedAt > row.lastTrainedAt) {
        row.lastTrainedAt = w.startedAt;
        row.lastWorkoutId = w.id;
      }
      if (now - w.startedAt <= 7 * 24 * HOUR) row.hardSets7d += sets;
      if (now - w.startedAt <= 48 * HOUR) row.sets48h += sets;
    }
  }
  return [...rows.values()].map(({ sets48h, ...row }) => {
    if (row.lastTrainedAt === null) return row;
    const status: RecoveryStatus =
      sets48h >= RECOVERY_HARD_SETS ? 'hard' : now - row.lastTrainedAt <= 72 * HOUR ? 'recent' : 'rested';
    return { ...row, daysSince: calendarDaysBetween(row.lastTrainedAt, now), status };
  });
}

/** Træner skabelonen mest muskler, der er hvilede? (over halvdelen af de planlagte sæt) */
export function templateReady(state: Pick<AppState, 'history' | 'exercises' | 'templates'>, templateId: string, now: number): boolean {
  const t = state.templates.find((x) => x.id === templateId);
  if (!t) return false;
  const status = new Map(muscleRecovery(state, now).map((r) => [r.muscle, r.status]));
  const muscleOf = new Map(state.exercises.map((e) => [e.id, e.muscle]));
  let total = 0;
  let rested = 0;
  for (const te of t.exercises) {
    total += te.sets;
    const m = muscleOf.get(te.exerciseId);
    if (m && status.get(m) === 'rested') rested += te.sets;
  }
  return total > 0 && rested * 2 > total;
}

/* ---------- Procenttabel (#250) ---------- */

export const PERCENT_STEPS = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

/** Nærmeste vægt der kan lægges på stangen med de skiver, man har (aldrig under stangen) */
export function nearestLoadable(target: number, barWeight = DEFAULT_BAR, plates = DEFAULT_PLATES): number {
  if (!(target > barWeight)) return barWeight;
  const grams = [...new Set(plates.map((p) => Math.round(p * 1000)).filter((g) => g > 0))];
  if (!grams.length) return barWeight;
  const unit = grams.reduce((a, b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  });
  const sideTarget = Math.round(((target - barWeight) / 2) * 1000);
  const max = Math.ceil((sideTarget + Math.max(...grams)) / unit);
  // Hvilke vægte pr. side kan sættes sammen af skiverne? (ubegrænset antal af hver)
  const ok = new Array<boolean>(max + 1).fill(false);
  ok[0] = true;
  for (let i = 1; i <= max; i++) ok[i] = grams.some((g) => g / unit <= i && ok[i - g / unit]);
  let best = 0;
  for (let i = 0; i <= max; i++) {
    if (!ok[i]) continue;
    const d = Math.abs(i * unit - sideTarget);
    const bd = Math.abs(best * unit - sideTarget);
    if (d < bd) best = i;
  }
  return barWeight + (best * unit * 2) / 1000;
}

/** Den 1RM procenttabellen regnes ud fra: testet 1RM, ellers bedste estimerede (0 = ingen) */
export function tableOneRM(state: Pick<AppState, 'history' | 'exercises'>, exerciseId: string): { oneRM: number; source: 'tested' | 'estimated' } | null {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (ex?.testedOneRM && ex.testedOneRM > 0) return { oneRM: ex.testedOneRM, source: 'tested' };
  const est = bestE1RM(state.history, exerciseId);
  return est > 0 ? { oneRM: est, source: 'estimated' } : null;
}

export interface PercentRow {
  pct: number;
  /** Præcis procent af 1RM */
  exact: number;
  /** Afrundet til en vægt man kan lægge på */
  weight: number;
}

/** Træningsvægte 95 %–50 % af 1RM, afrundet til vægte man kan lægge på stangen (#250) */
export function percentTable(
  state: Pick<AppState, 'history' | 'exercises' | 'barWeight' | 'plates'> & Partial<Pick<AppState, 'barWeightLb' | 'platesLb'>>,
  exerciseId: string,
  unit: WeightUnit = 'kg',
): PercentRow[] {
  if (exerciseKind(state, exerciseId) !== 'reps' || isBodyweight(state, exerciseId)) return [];
  const base = tableOneRM(state, exerciseId);
  if (!base) return [];
  return PERCENT_STEPS.map((pct) => {
    const exact = Math.round(base.oneRM * pct) / 100;
    return { pct, exact, weight: nearestLoadableKg(exact, state, unit) };
  });
}

/* ---------- Plader og opvarmning ---------- */

type PlateState = Pick<AppState, 'barWeight' | 'plates'> & Partial<Pick<AppState, 'barWeightLb' | 'platesLb'>>;

/** Stang og skiver i den valgte enhed (#347): kg-indstillingerne eller de separate lb-indstillinger */
export function plateSetup(state: PlateState, unit: WeightUnit): { bar: number; plates: number[] } {
  if (unit === 'lb') return { bar: state.barWeightLb ?? DEFAULT_BAR_LB, plates: state.platesLb?.length ? state.platesLb : DEFAULT_PLATES_LB };
  return { bar: state.barWeight, plates: state.plates };
}

/** En kg-vægt i lb med 0,01 lb's nøjagtighed (så 102,0582 kg → 225 lb til skiveberegning) */
function kgToLbExact(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 100) / 100;
}

/** Nærmeste vægt (i kg) der kan lægges på med stang og skiver i den valgte enhed (#347) */
export function nearestLoadableKg(targetKg: number, state: PlateState, unit: WeightUnit = 'kg'): number {
  const { bar, plates } = plateSetup(state, unit);
  if (unit === 'kg') return nearestLoadable(targetKg, bar, plates);
  return fromDisplay(nearestLoadable(kgToLbExact(targetKg), bar, plates), 'lb');
}

/** Skiver pr. side for en kg-vægt i den valgte enhed, fx "45 + 45 pr. side" for 225 lb (#347) */
export function platesText(targetKg: number, state: PlateState, unit: WeightUnit = 'kg'): string {
  const { bar, plates } = plateSetup(state, unit);
  return unit === 'kg' ? formatPlates(targetKg, bar, plates) : formatPlates(kgToLbExact(targetKg), bar, plates, 'lb');
}

/** Opvarmningssæt (i kg) for en arbejdsvægt i kg: i lb bruges lb-stangen og spring på 5 lb (#347) */
export function warmupSetsFor(workingKg: number, state: PlateState, unit: WeightUnit = 'kg'): WarmupSet[] {
  if (unit === 'kg') return warmupSets(workingKg, state.barWeight);
  const { bar } = plateSetup(state, 'lb');
  return warmupSets(kgToLbExact(workingKg), bar, 5).map((w) => ({ ...w, weight: fromDisplay(w.weight, 'lb') }));
}

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

/** Skiverne pr. side som tekst, fx "20 + 10 + 2,5 pr. side" (#251) */
export function formatPlates(target: number, barWeight = DEFAULT_BAR, plates = DEFAULT_PLATES, unit: WeightUnit = 'kg'): string {
  const r = platesPerSide(target, barWeight, plates);
  if (r.belowBar) return 'Under stangens vægt';
  if (!r.perSide.length) return 'Kun stangen';
  const txt = r.perSide.map((p) => String(p).replace('.', ',')).join(' + ') + ' pr. side';
  const missing = unit === 'lb' ? `${displayNumber(r.remainder)} lb` : formatKg(r.remainder);
  return r.remainder > 0 ? `${txt} (mangler ${missing})` : txt;
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

/** Forslag til opvarmning før et arbejdssæt: tom stang × 10, 40 % × 5, 60 % × 3, 80 % × 2 */
export function warmupSets(workingWeight: number, barWeight = DEFAULT_BAR, step = 2.5): WarmupSet[] {
  if (workingWeight <= barWeight) return [];
  const steps: [number, number][] = [
    [0, 10],
    [0.4, 5],
    [0.6, 3],
    [0.8, 2],
  ];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of steps) {
    const w = pct === 0 ? barWeight : Math.max(barWeight, Math.round((workingWeight * pct) / step) * step);
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

/** Nummer blandt arbejdssættene (opvarmning og drop-sæt tæller ikke, #243) for sættet på plads `idx` */
function workIdxOf(we: WorkoutExercise, idx: number): number {
  return we.sets.slice(0, idx).filter((x) => !x.warmup && !isDropSet(x)).length;
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
      const work = e.sets.filter((x) => !x.warmup && !isDropSet(x));
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

/* ---------- Reelle pauser (#315) ---------- */

/** Huller over 15 min mellem to afkrydsede sæt er ikke en pause (fx en glemt træning) */
export const MAX_REAL_REST_SECONDS = 15 * 60;
/** Sæt krydset af med under 5 s imellem er krydset af samlet bagefter – heller ikke en pause (#316) */
export const MIN_REAL_REST_SECONDS = 5;

export interface ActualRest {
  /** Sættet, pausen gik forud for */
  weId: string;
  setId: string;
  exerciseId: string;
  /** Pausen i sekunder (tid sat på pause er trukket fra) */
  seconds: number;
}

/**
 * Den reelle pause før hvert afkrydset sæt: tiden siden det forrige afkrydsede sæt i træningen,
 * minus tid træningen var sat på pause. Træningens første sæt og huller over 15 min giver ingen pause.
 * Sæt uden tidsstempel (ældre træninger) springes over.
 */
export function actualRests(w: Workout): ActualRest[] {
  const sets = w.exercises
    .flatMap((e) => e.sets.filter((s) => s.done && typeof s.doneAt === 'number').map((s) => ({ e, s })))
    .sort((a, b) => a.s.doneAt! - b.s.doneAt!);
  const out: ActualRest[] = [];
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1].s;
    const { e, s: b } = sets[i];
    const ms = b.doneAt! - a.doneAt! - Math.max(0, (b.donePausedMs ?? 0) - (a.donePausedMs ?? 0));
    const seconds = Math.max(0, Math.round(ms / 1000));
    // Under 5 s = sættene blev krydset af i ét hug (ikke en pause); over 15 min = ikke en pause
    if (seconds < MIN_REAL_REST_SECONDS || seconds > MAX_REAL_REST_SECONDS) continue;
    out.push({ weId: e.id, setId: b.id, exerciseId: e.exerciseId, seconds });
  }
  return out;
}

/** Den reelle pause før ét sæt, eller null (#316) */
export function actualRestBefore(w: Workout, setId: string): number | null {
  return actualRests(w).find((r) => r.setId === setId)?.seconds ?? null;
}

export interface RestSummary {
  /** Gennemsnitlig reel pause i sekunder */
  average: number;
  /** Gennemsnitlig planlagt pause (pausetimeren) for de samme sæt */
  planned: number;
  /** Antal pauser */
  count: number;
  /** Øvelsen med den længste gennemsnitlige pause */
  longest: { exerciseId: string; seconds: number };
}

/** Pauser i en træning: gennemsnit, planlagt gennemsnit og øvelsen med længst pause. null uden pauser. */
export function restSummary(w: Workout, state: AppState): RestSummary | null {
  const rests = actualRests(w);
  if (rests.length === 0) return null;
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const per = new Map<string, number[]>();
  for (const r of rests) per.set(r.exerciseId, [...(per.get(r.exerciseId) ?? []), r.seconds]);
  let longest = { exerciseId: rests[0].exerciseId, seconds: -1 };
  for (const [exerciseId, xs] of per) {
    const seconds = avg(xs);
    if (seconds > longest.seconds) longest = { exerciseId, seconds };
  }
  return {
    average: avg(rests.map((r) => r.seconds)),
    planned: avg(rests.map((r) => restFor(state, r.exerciseId))),
    count: rests.length,
    longest,
  };
}

/** Typisk (median) reel pause før sæt i en øvelse over de seneste op til 5 træninger. null ved under 3 pauser. */
export function typicalRest(state: AppState, exerciseId: string): number | null {
  const xs: number[] = [];
  let workouts = 0;
  for (const w of [...state.history].sort((a, b) => b.startedAt - a.startedAt)) {
    const rests = actualRests(w).filter((r) => r.exerciseId === exerciseId);
    if (rests.length === 0) continue;
    xs.push(...rests.map((r) => r.seconds));
    if (++workouts >= 5) break;
  }
  if (xs.length < 3) return null;
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return Math.round(xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2);
}

/** Pausetid afrundet til nærmeste 15 s inden for 0–MAX_REST, til "Brug 2:30" på øvelsessiden (#317) */
export function roundRestTo15(seconds: number): number {
  return Math.max(0, Math.min(MAX_REST, Math.round(seconds / 15) * 15));
}

/* ---------- Forslag til progression ---------- */

export interface ProgressionHint {
  /** Sidste gang: antal arbejdssæt, reps i første sæt og tungeste vægt */
  last: { sets: number; reps: number; weight: number; repsList: number[] };
  /** Forslag til i dag */
  next: { weight: number; reps: number };
  /** true hvis forslaget er et skridt op */
  increase: boolean;
  /** Kropsvægtsøvelse (#209): vægten er ekstra vægt (+) eller assistance (−) oven på kropsvægten */
  bodyweight?: boolean;
  /** RPE på sidste gangs tungeste sæt, når den ændrede forslaget (#237) */
  rpe?: number;
  /** Dobbelt progression (#259): rep-intervallet og om alle sæt sidst nåede toppen */
  range?: { min: number; max: number; topReached: boolean };
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

/** Kropsvægtsøvelser (#209): ved så mange reps på alle sæt foreslås +2,5 kg ekstra (eller 2,5 kg mindre assistance) */
export const BODYWEIGHT_REPS_TARGET = 12;

/**
 * Enkel progression: nåede alle sæt sidst mindst samme reps som første sæt, foreslås et skridt op
 * (+2,5 kg for stang/maskine/kabel, +1 kg for håndvægt). Kropsvægtsøvelser (#209): +1 rep, indtil alle
 * sæt har 12+ reps – så +2,5 kg ekstra vægt (for assisterede sæt: 2,5 kg mindre assistance). Ellers samme igen.
 */
export function progressionHint(
  state: AppState,
  exerciseId: string,
  range?: Pick<WorkoutExercise, 'repMin' | 'repMax'>,
): ProgressionHint | null {
  const kind = exerciseKind(state, exerciseId);
  if (kind !== 'reps') return timedHint(state, exerciseId, kind);
  const sets = previousSets(state.history, exerciseId, true).filter((s) => num(s.reps) > 0);
  if (!sets.length) return null;
  const reps = num(sets[0].reps);
  const weight = Math.max(...sets.map((s) => num(s.weight)));
  const last = { sets: sets.length, reps, weight, repsList: sets.map((s) => num(s.reps)) };
  const allHit = sets.every((s) => num(s.reps) >= reps);
  const equipment = state.exercises.find((e) => e.id === exerciseId)?.equipment;
  if (range && validRepRange(range.repMin, range.repMax)) {
    return doubleProgression(last, sets, { min: range.repMin!, max: range.repMax! }, equipment);
  }
  if (equipment !== 'Kropsvægt' && !allHit) return { last, next: { weight, reps }, increase: false };
  if (equipment === 'Kropsvægt') {
    const bw = { bodyweight: true as const };
    if (!allHit) return { last, next: { weight, reps }, increase: false, ...bw };
    if (sets.every((s) => num(s.reps) >= BODYWEIGHT_REPS_TARGET)) {
      return { last, next: { weight: Math.round((weight + 2.5) * 10) / 10, reps }, increase: true, ...bw };
    }
    return { last, next: { weight, reps: reps + 1 }, increase: true, ...bw };
  }
  if (weight === 0) return { last, next: { weight, reps: reps + 1 }, increase: true };
  const step = equipment === 'Håndvægt' ? 1 : 2.5;
  // RPE på det tungeste sæt (#237): meget hårdt (9,5–10) → samme igen; let (≤ 7) → dobbelt skridt.
  // Flere sæt på topvægten: den højeste RPE tæller (det forsigtige valg).
  const rpes = sets.filter((s) => num(s.weight) === weight).map((s) => parseRpe(s.rpe)).filter((r): r is number => r !== null);
  const rpe = rpes.length ? Math.max(...rpes) : null;
  if (rpe !== null && rpe >= 9.5) return { last, next: { weight, reps }, increase: false, rpe };
  if (rpe !== null && rpe <= 7) return { last, next: { weight: weight + 2 * step, reps }, increase: true, rpe };
  return { last, next: { weight: weight + step, reps }, increase: true };
}

/**
 * Dobbelt progression (#259): nåede alle arbejdssæt sidst toppen af intervallet, foreslås et skridt op i vægt
 * og bunden af intervallet. Ellers samme vægt og én rep mere end sidste gangs laveste sæt (aldrig over toppen).
 */
function doubleProgression(
  last: ProgressionHint['last'],
  sets: SetEntry[],
  range: { min: number; max: number },
  equipment: Equipment | undefined,
): ProgressionHint {
  const bw = equipment === 'Kropsvægt' ? { bodyweight: true as const } : {};
  const lowest = Math.min(...sets.map((s) => num(s.reps)));
  if (lowest >= range.max) {
    const step = equipment === 'Håndvægt' ? 1 : 2.5;
    return {
      last,
      next: { weight: Math.round((last.weight + step) * 10) / 10, reps: range.min },
      increase: true,
      range: { ...range, topReached: true },
      ...bw,
    };
  }
  return {
    last,
    next: { weight: last.weight, reps: Math.min(range.max, Math.max(range.min, lowest + 1)) },
    increase: true,
    range: { ...range, topReached: false },
    ...bw,
  };
}

/** Læser en RPE-værdi (#237): 6–10 i halve trin, med komma eller punktum. Alt andet → null (ingen RPE). */
export function parseRpe(v: string | undefined): number | null {
  const t = (v ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 6 && n <= 10 && Number.isInteger(n * 2) ? n : null;
}

/** RPE som dansk tekst (#238): "8.5" → "8,5". Ugyldig eller tom RPE → '' (vises ikke). */
export function formatRpe(v: string | undefined): string {
  const n = parseRpe(v);
  return n === null ? '' : String(n).replace('.', ',');
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  date: number;
  sets: SetEntry[];
  best1RM: number;
  volume: number;
}

/**
 * En øvelses historik: sættene (som de blev logget) + bedste e1RM og volumen pr. træning.
 * Med `state` regnes kropsvægt med for kropsvægtsøvelser (#207).
 */
export function exerciseHistory(
  history: Workout[],
  exerciseId: string,
  state?: Pick<AppState, 'exercises' | 'bodyLog' | 'bodyWeight'>,
): ExerciseHistoryEntry[] {
  const out: ExerciseHistoryEntry[] = [];
  for (const w of history) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const sets = ex.sets.filter(isWorkSet);
      if (!sets.length) continue;
      const load = (s: SetEntry) => (state ? setLoad(state, w, exerciseId, s) : num(s.weight));
      out.push({
        workoutId: w.id,
        date: w.startedAt,
        sets,
        // Drop-sæt (#243) vises i historikken, men tæller ikke som bedste 1RM
        best1RM: Math.max(0, ...sets.filter(isMainSet).map((s) => estimate1RM(load(s), num(s.reps)))),
        volume: sets.reduce((a, s) => a + (isTimedSet(s) ? 0 : load(s) * num(s.reps)), 0),
      });
    }
  }
  return out;
}

/* ---------- Gennem tiden (#272) ---------- */

export interface LifetimeStats {
  firstDate: number;
  lastDate: number;
  /** Træninger med mindst ét udført arbejdssæt af øvelsen */
  workouts: number;
  /** Udførte arbejdssæt (opvarmning tæller ikke, drop-sæt gør) */
  sets: number;
  reps: number;
  /** Samlet løftet vægt i kg (tids- og distancesæt tæller ikke) */
  volumeKg: number;
}

/**
 * En øvelses samlede tal fra afsluttede træninger (#272). null = aldrig lavet.
 * Med `state` regnes kropsvægt med for kropsvægtsøvelser (#207).
 */
export function lifetimeStats(
  history: Workout[],
  exerciseId: string,
  state?: Pick<AppState, 'exercises' | 'bodyLog' | 'bodyWeight'>,
): LifetimeStats | null {
  const entries = exerciseHistory(history, exerciseId, state);
  if (!entries.length) return null;
  const workouts = new Set(entries.map((e) => e.workoutId));
  return {
    firstDate: Math.min(...entries.map((e) => e.date)),
    lastDate: Math.max(...entries.map((e) => e.date)),
    workouts: workouts.size,
    sets: entries.reduce((n, e) => n + e.sets.length, 0),
    reps: entries.reduce((n, e) => n + e.sets.reduce((a, s) => a + (isTimedSet(s) ? 0 : Math.max(0, num(s.reps))), 0), 0),
    volumeKg: Math.round(entries.reduce((n, e) => n + e.volume, 0) * 100) / 100,
  };
}

export interface MostLiftedRow {
  exerciseId: string;
  name: string;
  volumeKg: number;
  workouts: number;
}

/** De `n` øvelser med mest samlet løftet vægt (#272). Øvelser uden vægt (fx tid/distance) er udeladt; lighed → navn. */
export function mostLiftedExercises(state: AppState, n = 3): MostLiftedRow[] {
  const rows: MostLiftedRow[] = [];
  for (const ex of state.exercises) {
    const stats = lifetimeStats(state.history, ex.id, state);
    if (!stats || stats.volumeKg <= 0) continue;
    rows.push({ exerciseId: ex.id, name: ex.name, volumeKg: stats.volumeKg, workouts: stats.workouts });
  }
  rows.sort((a, b) => b.volumeKg - a.volumeKg || a.name.localeCompare(b.name, 'da'));
  return rows.slice(0, Math.max(0, n));
}

/** Samlet vægt på dansk (#272): under 1000 kg → "850 kg", ellers "86,4 tons" */
export function formatTons(kg: number, unit: WeightUnit = 'kg'): string {
  if (unit === 'lb') return `${Math.round(toDisplay(kg, 'lb')).toLocaleString('da-DK')} lb`;
  if (kg < 1000) return `${Math.round(kg).toLocaleString('da-DK')} kg`;
  const t = Math.round(kg / 100) / 10;
  return `${t.toLocaleString('da-DK', { maximumFractionDigits: 1 })} ${t === 1 ? 'ton' : 'tons'}`;
}

/** "i dag", "i går" eller "for 12 dage siden" (hele kalenderdage, lokal tid, #272) */
export function daysAgoText(date: number, now: number): string {
  const days = Math.max(0, Math.round((dayStart(now) - dayStart(date)) / DAY_MS));
  if (days === 0) return 'i dag';
  if (days === 1) return 'i går';
  return `for ${days} dage siden`;
}

/* ---------- Styrkegraf (#213) ---------- */

export type ProgressMetric = '1rm' | 'heaviest' | 'volume';
export type ProgressRange = '3m' | '1y' | 'all';

export interface ProgressPoint {
  workoutId: string;
  date: number;
  /** kg (1RM, tungeste sæt, volumen), sekunder (tidsøvelser) eller meter (distanceøvelser) */
  value: number;
  /** Sættet bag værdien (mangler for volumen) */
  set?: { weight: number; reps: number; seconds?: number; meters?: number };
  /** Træningen slog alle tidligere træninger på denne måling (første gang er ingen rekord) */
  record: boolean;
  /** Let uge (#362): tegnes som hul prik og trækker ikke linjen ned */
  deload?: boolean;
}

/** Starttidspunkt for et interval talt tilbage fra `now` (0 = alt) */
export function progressRangeStart(range: ProgressRange, now: number): number {
  if (range === 'all') return 0;
  const d = new Date(now);
  if (range === '3m') d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  return d.getTime();
}

/**
 * Ét punkt pr. afsluttet træning med øvelsen (#213), ældste først. Opvarmning tæller aldrig.
 * Tidsøvelser giver længste hold og distanceøvelser længste distance uanset `metric`.
 * Kropsvægt regnes med for kropsvægtsøvelser. Rekorder vurderes mod hele historikken, også før intervallet.
 */
export function exerciseProgress(
  state: AppState,
  exerciseId: string,
  metric: ProgressMetric,
  range: ProgressRange,
  now: number,
): ProgressPoint[] {
  state = loadedState(state);
  const kind = exerciseKind(state, exerciseId);
  const workouts = [...state.history].sort((a, b) => a.startedAt - b.startedAt);
  const all: ProgressPoint[] = [];
  let best = 0;
  let seen = false;
  for (const w of workouts) {
    const sets = validSets(
      w.exercises.filter((we) => we.exerciseId === exerciseId).flatMap((we) => we.sets),
      w.startedAt,
      kind,
    );
    if (!sets.length) continue;
    let value = 0;
    let set: ProgressPoint['set'];
    for (const s of sets) {
      const v =
        kind === 'time' ? s.seconds : kind === 'distance' ? s.meters : metric === '1rm' ? estimate1RM(s.weight, s.reps) : metric === 'heaviest' ? s.weight : 0;
      if (metric === 'volume' && kind === 'reps') {
        value += s.weight * s.reps;
        continue;
      }
      if (v > value) {
        value = v;
        set = kind === 'reps' ? { weight: s.weight, reps: s.reps } : kind === 'time' ? { weight: 0, reps: 0, seconds: s.seconds } : { weight: 0, reps: 0, meters: s.meters, seconds: s.seconds || undefined };
      }
    }
    value = Math.round(value * 10) / 10;
    if (kind === 'reps' && metric !== 'volume' && value <= 0) continue;
    const record = seen && value > best;
    best = Math.max(best, value);
    seen = true;
    all.push({ workoutId: w.id, date: w.startedAt, value, ...(set ? { set } : {}), record, ...(w.deload ? { deload: true } : {}) });
  }
  const from = progressRangeStart(range, now);
  return all.filter((p) => p.date >= from && p.date <= now);
}

/**
 * Teksten under styrkegrafen når man trykker på et punkt (#215),
 * fx "12. nov. · 100 kg × 5 · est. 1RM 116,7 kg". Rekorder får "🏆 rekord" til sidst.
 */
export function describeProgressPoint(p: ProgressPoint, kind: ExerciseKind, metric: ProgressMetric, unit: WeightUnit = 'kg'): string {
  const date = new Date(p.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('da-DK', { maximumFractionDigits: 1 });
  const w = (kg: number) => `${num(unit === 'lb' ? toDisplay(kg, 'lb') : kg)} ${unit}`;
  const parts = [date];
  if (kind === 'time') parts.push(`${num(p.value)} sek.`);
  else if (kind === 'distance') parts.push(`${num(p.value)} m`);
  else if (metric === 'volume' || !p.set) parts.push(`volumen ${w(p.value)}`);
  else {
    parts.push(`${w(p.set.weight)} × ${p.set.reps}`);
    if (metric === '1rm') parts.push(`est. 1RM ${w(p.value)}`);
  }
  if (p.record) parts.push('🏆 rekord');
  if (p.deload) parts.push('let uge');
  return parts.join(' · ');
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
/**
 * De senest brugte øvelser (#190): de sidste `n` forskellige øvelser fra afsluttede træninger, nyeste først.
 * Den igangværende træning tæller ikke med.
 */
export function recentExercises(state: Pick<AppState, 'history' | 'exercises'>, n = 5): string[] {
  const known = new Set(state.exercises.map((e) => e.id));
  const out: string[] = [];
  const workouts = [...state.history].sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt));
  for (const w of workouts) {
    for (const we of w.exercises) {
      if (out.length >= n) return out;
      if (known.has(we.exerciseId) && !out.includes(we.exerciseId)) out.push(we.exerciseId);
    }
  }
  return out;
}

/**
 * Grupperne øverst i øvelsesvælgeren (#192): favoritter (i den rækkefølge de blev stjernemarkeret)
 * og de senest brugte øvelser uden dem, der allerede står under favoritter.
 */
export function pickerGroups(
  state: Pick<AppState, 'history' | 'exercises' | 'favorites'>,
  n = 5,
): { favorites: string[]; recent: string[] } {
  const known = new Set(state.exercises.map((e) => e.id));
  const favorites = (state.favorites ?? []).filter((id) => known.has(id));
  const recent = recentExercises(state, n + favorites.length)
    .filter((id) => !favorites.includes(id))
    .slice(0, n);
  return { favorites, recent };
}

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

/* ---------- Søg i historik (#230) ---------- */

/** Normaliserer søgetekst: små bogstaver (også ÆØÅ), ét mellemrum mellem ord */
export function normalizeSearch(text: string): string {
  return text.toLocaleLowerCase('da-DK').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export interface HistoryMatchExercise {
  /** Id på øvelsen i træningen (WorkoutExercise.id) */
  weId: string;
  exerciseId: string;
  /** Bedste arbejdssæt (opvarmning tæller ikke) – null hvis ingen */
  best: SetEntry | null;
}

export interface HistoryMatch {
  workout: Workout;
  /** Øvelser, hvis navn matcher søgningen (tom, hvis der ikke søges på tekst, eller kun navn/note matcher) */
  matched: HistoryMatchExercise[];
}

/**
 * Filtrerer afsluttede træninger (#230): søgeteksten matcher træningens navn, træningens note,
 * en øvelsesnote eller navnet på en af øvelserne. `templateId` beholder kun træninger startet fra den skabelon.
 * Tom søgning giver alle. Nyeste først.
 */
export function searchHistory(
  state: Pick<AppState, 'history' | 'exercises'>,
  opts: { query?: string; templateId?: string | null } = {},
): HistoryMatch[] {
  const q = normalizeSearch(opts.query ?? '');
  const names = new Map(state.exercises.map((e) => [e.id, normalizeSearch(e.name)]));
  const has = (text: string | undefined) => !!text && normalizeSearch(text).includes(q);
  const out: HistoryMatch[] = [];
  const workouts = [...state.history].sort((a, b) => b.startedAt - a.startedAt);
  for (const w of workouts) {
    if (opts.templateId && w.templateId !== opts.templateId) continue;
    if (!q) {
      out.push({ workout: w, matched: [] });
      continue;
    }
    const matched: HistoryMatchExercise[] = w.exercises
      .filter((we) => (names.get(we.exerciseId) ?? '').includes(q))
      .map((we) => ({ weId: we.id, exerciseId: we.exerciseId, best: bestSet(we.sets) }));
    if (matched.length || has(w.name) || has(w.note) || w.exercises.some((we) => has(we.note))) {
      out.push({ workout: w, matched });
    }
  }
  return out;
}

/** Skabeloner med mindst én afsluttet træning i historikken, i skabelonernes rækkefølge (filterknapper, #232) */
export function historyTemplates(state: Pick<AppState, 'history' | 'templates'>): { id: string; name: string }[] {
  const used = new Set(state.history.map((w) => w.templateId).filter(Boolean));
  return state.templates.filter((t) => used.has(t.id)).map((t) => ({ id: t.id, name: t.name }));
}

/* ---------- Løftemål (#197) ---------- */

/** Bedste estimerede 1RM for en øvelse ud fra arbejdssæt i afsluttede træninger (0 = ingen) */
export function bestE1RM(history: Workout[], exerciseId: string): number {
  let best = 0;
  for (const w of history)
    for (const we of w.exercises)
      if (we.exerciseId === exerciseId)
        for (const s of we.sets) if (isWorkSet(s)) best = Math.max(best, estimate1RM(num(s.weight), num(s.reps)));
  return best;
}

/** Målets fremskridt: din bedste e1RM mod målets e1RM, `pct` 0–100 */
export function goalProgress(
  state: Pick<AppState, 'history' | 'goals'>,
  goalId: string,
): { current: number; target: number; pct: number } | null {
  const goal = (state.goals ?? []).find((g) => g.id === goalId);
  if (!goal) return null;
  const target = estimate1RM(goal.weight, goal.reps);
  const current = bestE1RM(state.history, goal.exerciseId);
  const pct = goal.achievedAt ? 100 : target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return { current, target, pct };
}

/** Når en træning afsluttes: åbne mål, hvor et arbejdssæt har vægt ≥ mål og reps ≥ mål, er nået */
export function markGoalsReached(goals: LiftGoal[], w: Workout): LiftGoal[] {
  if (!goals.length) return goals;
  let changed = false;
  const out = goals.map((g) => {
    if (g.achievedAt) return g;
    const hit = w.exercises.some(
      (we) =>
        we.exerciseId === g.exerciseId && we.sets.some((s) => isWorkSet(s) && num(s.weight) >= g.weight && num(s.reps) >= g.reps),
    );
    if (!hit) return g;
    changed = true;
    return { ...g, achievedAt: w.finishedAt ?? w.startedAt };
  });
  return changed ? out : goals;
}


/** "I dette tempo" (#198): lineær trend gennem bedste e1RM pr. træning de sidste 8 uger → dato for målets e1RM.
 * null ved under 3 træninger, flad/faldende trend eller mere end et år ude. Nåede mål giver null. */
export function goalEta(state: Pick<AppState, 'history' | 'goals'>, goalId: string, now: number): number | null {
  const goal = (state.goals ?? []).find((g) => g.id === goalId);
  if (!goal || goal.achievedAt) return null;
  const target = estimate1RM(goal.weight, goal.reps);
  const since = now - 56 * DAY_MS;
  const pts: { x: number; y: number }[] = [];
  for (const w of state.history) {
    if (w.startedAt < since || w.startedAt > now) continue;
    let best = 0;
    for (const we of w.exercises)
      if (we.exerciseId === goal.exerciseId)
        for (const s of we.sets) if (isWorkSet(s)) best = Math.max(best, estimate1RM(num(s.weight), num(s.reps)));
    if (best > 0) pts.push({ x: (w.startedAt - now) / DAY_MS, y: best });
  }
  if (pts.length < 3) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  let sxy = 0;
  let sxx = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx; // kg pr. dag
  if (slope <= 1e-6) return null;
  const nowValue = my - slope * mx; // linjens værdi i dag (x = 0)
  const days = Math.max(0, (target - nowValue) / slope);
  if (days > 365) return null;
  return now + Math.round(days * DAY_MS);
}

/** "ca. marts" / "ca. marts 2027" / "inden for en uge" */
export function etaText(date: number, now: number): string {
  if (date - now <= 7 * DAY_MS) return 'inden for en uge';
  const d = new Date(date);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return `ca. ${MONTHS_DA[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`;
}

/** Med måldato: er estimatet før datoen? null uden måldato eller estimat. Nåede mål er altid på sporet. */
export function goalOnTrack(state: Pick<AppState, 'history' | 'goals'>, goalId: string, now: number): boolean | null {
  const goal = (state.goals ?? []).find((g) => g.id === goalId);
  if (!goal || !goal.targetDate) return null;
  if (goal.achievedAt) return true;
  const eta = goalEta(state, goalId, now);
  if (eta === null) return goalProgress(state, goalId)!.pct >= 100 ? true : null;
  return eta <= goal.targetDate;
}

/** Alle mål til Profil (#200): åbne mål sorteret efter fremskridt (tættest på først), nåede mål nyeste først */
export function goalsOverview(
  state: Pick<AppState, 'history' | 'goals' | 'exercises'>,
): { open: { goal: LiftGoal; pct: number }[]; reached: LiftGoal[] } {
  const known = new Set(state.exercises.map((e) => e.id));
  const goals = (state.goals ?? []).filter((g) => known.has(g.exerciseId));
  const open = goals
    .filter((g) => !g.achievedAt)
    .map((goal) => ({ goal, pct: goalProgress(state, goal.id)!.pct }))
    .sort((a, b) => b.pct - a.pct || a.goal.createdAt - b.goal.createdAt);
  const reached = goals.filter((g) => g.achievedAt).sort((a, b) => (b.achievedAt ?? 0) - (a.achievedAt ?? 0));
  return { open, reached };
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
  /** "Let uge" (#361): fyld de tomme arbejdssæt med den lette vægt (kg-tekst) og markér træningen som let uge */
  | { type: 'APPLY_DELOAD'; weId: string; weight: string; reps: number }
  | { type: 'REMOVE_SET'; weId: string; setId: string }
  | { type: 'UPDATE_SET'; weId: string; setId: string; patch: Partial<Omit<SetEntry, 'id'>> }
  | { type: 'TOGGLE_SET'; weId: string; setId: string; now: number }
  | { type: 'START_SET_TIMER'; weId: string; setId: string; now: number }
  | { type: 'STOP_SET_TIMER'; weId: string; setId: string; now: number }
  /** Sæt-mærke (#243): sæt eller fjern (tag: null) drop/failure/AMRAP på et sæt */
  | { type: 'SET_SET_TAG'; weId: string; setId: string; tag: SetTag | null }
  /** Indsætter et drop-sæt lige under sættet med ~20 % lettere vægt (#243) */
  | { type: 'ADD_DROP_SET'; weId: string; setId: string }
  /** Gør et sæt til opvarmning eller tilbage til arbejdssæt (#244). Opvarmning fjerner et evt. mærke. */
  | { type: 'SET_SET_WARMUP'; weId: string; setId: string; warmup: boolean }
  /** Slå "Let uge" til/fra på træningen (#362) */
  | { type: 'SET_DELOAD'; on: boolean };

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
  'SET_SET_TAG',
  'ADD_DROP_SET',
  'SET_SET_WARMUP',
  'SET_DELOAD',
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
  | { type: 'SET_INTERVAL_CONFIG'; config: IntervalConfig }
  | { type: 'START_INTERVAL'; config: IntervalConfig; now: number }
  | { type: 'STOP_INTERVAL' }
  | { type: 'SAVE_FINISHER'; now: number; rounds?: number | null }
  | { type: 'REMOVE_FINISHER'; finisherId: string; workoutId?: string }
  | { type: 'SAVE_FINISHER_AS_WORKOUT'; now: number; rounds?: number | null }
  | { type: 'SET_REST_SECONDS'; seconds: number }
  | { type: 'SET_EXERCISE_REST'; exerciseId: string; seconds?: number }
  /** Gem/ryd en testet 1RM for en øvelse (#250). `weight` mangler eller ≤ 0 = ryd */
  | { type: 'SET_TESTED_1RM'; exerciseId: string; weight?: number }
  /** Egne teknik-tips på en egen øvelse (#337). Tom tekst = fjern */
  | { type: 'SET_EXERCISE_CUES'; exerciseId: string; cues: string }
  | { type: 'SET_BAR_WEIGHT'; weight: number }
  | { type: 'SET_WEEKLY_GOAL'; goal: number }
  | { type: 'SET_SHOW_HINTS'; on: boolean }
  | { type: 'SET_REST_SOUND'; on: boolean }
  | { type: 'SET_REST_VIBRATE'; on: boolean }
  | { type: 'SET_KEEP_AWAKE'; on: boolean }
  | { type: 'SET_SHOW_RPE'; on: boolean }
  | { type: 'SET_UNIT'; unit: WeightUnit }
  | { type: 'SET_SHOW_TIME_LEFT'; on: boolean }
  /** Farvetema (#293). Ukendte værdier ignoreres. */
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'SET_LARGE_TEXT'; on: boolean }
  /** Kropsvægt i kg (#206). 0, negativ eller ugyldig = ikke angivet. */
  | { type: 'SET_BODY_WEIGHT'; kg: number }
  | { type: 'SET_TRAINING_DAYS'; days: number[] }
  | { type: 'TOGGLE_FAVORITE'; exerciseId: string }
  | { type: 'SET_PROGRAM'; templateIds: string[] }
  | { type: 'SET_SET_TARGET'; muscle: Muscle; value: number | null }
  | { type: 'SKIP_PROGRAM' }
  | { type: 'ADD_MEASUREMENT'; id: string; date: number; weight?: number; bodyFat?: number; waist?: number }
  | { type: 'DELETE_MEASUREMENT'; id: string }
  | { type: 'TOGGLE_PLATE'; plate: number }
  | { type: 'ADD_CUSTOM_EXERCISE'; id: string; name: string; muscle: Muscle; equipment: Equipment; kind?: ExerciseKind }
  | { type: 'SAVE_TEMPLATE_FROM_WORKOUT'; workoutId: string; name: string }
  | { type: 'DELETE_TEMPLATE'; templateId: string }
  | { type: 'SET_TEMPLATE_REPS'; templateId: string; index: number; min: number | null; max: number | null }
  | { type: 'SWAP_IN_TEMPLATE'; templateId: string; fromExerciseId: string; toExerciseId: string }
  | { type: 'DELETE_WORKOUT'; workoutId: string }
  | { type: 'IMPORT_STATE'; state: AppState }
  | { type: 'CLOSE_SUMMARY' }
  | { type: 'ADD_GOAL'; id: string; exerciseId: string; weight: number; reps: number; targetDate?: number; now: number }
  | { type: 'DELETE_GOAL'; goalId: string }
  | { type: 'DISMISS_RECAP'; key: string }
  | { type: 'HIDE_YEAR_REVIEW'; year: number }
  /** Skjul "står stille"-påmindelsen for en øvelse (#360) */
  | { type: 'DISMISS_STALL'; exerciseId: string }
  | { type: 'MERGE_REMOTE'; remote: AppState }
  /** Fortryd den seneste sletning (#221) – oplysningerne kommer fra `lastDeletion` */
  | { type: 'UNDO_DELETE'; deletion: Deletion };

/* ---------- Rep-intervaller (#257) ---------- */

/** Et gyldigt rep-interval: hele tal, 1 ≤ min ≤ max ≤ 50 */
export function validRepRange(min: number | null | undefined, max: number | null | undefined): boolean {
  if (typeof min !== 'number' || typeof max !== 'number') return false;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return false;
  return min >= 1 && max <= MAX_TEMPLATE_REPS && min <= max;
}

/** Rep-intervallet som felter til at sprede ind i en øvelse – tomt objekt, hvis der ikke er et gyldigt interval */
export function repRangeOf(e: { repMin?: number; repMax?: number }): { repMin?: number; repMax?: number } {
  return validRepRange(e.repMin, e.repMax) ? { repMin: e.repMin, repMax: e.repMax } : {};
}

/** "8–12" (eller "10", hvis min = max). null uden interval. */
export function formatRepRange(e: { repMin?: number; repMax?: number }): string | null {
  if (!validRepRange(e.repMin, e.repMax)) return null;
  return e.repMin === e.repMax ? String(e.repMin) : `${e.repMin}–${e.repMax}`;
}

/** En øvelse i en skabelon som tekst: "Bænkpres 3 × 8–12" eller "Bænkpres 3 sæt" */
export function formatTemplateLine(exercise: Pick<Exercise, 'name'> | undefined, te: TemplateExercise): string {
  const name = exercise?.name ?? '?';
  const range = formatRepRange(te);
  return range ? `${name} ${te.sets} × ${range}` : `${name} ${te.sets} sæt`;
}

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

/** Samlet pausetid (ms) indtil `now`, inkl. en igangværende pause */
function pausedMsAt(w: Workout, now: number): number {
  return (w.pausedMs ?? 0) + (w.pausedAt ? Math.max(0, now - w.pausedAt) : 0);
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
      if (!exercises.length && !draft.finishers?.length) return state; // en tom træning gemmes ikke – brug "Slet" i stedet
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
        exercises: tpl ? withFreshSupersetIds(tpl.exercises, (e) => ({ ...newWorkoutExercise(e.exerciseId, e.sets), ...repRangeOf(e) })) : [],
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
        exercises: withFreshSupersetIds(src.exercises, (e) => ({
          ...newWorkoutExercise(e.exerciseId, e.sets.filter((x) => !x.warmup).length),
          ...repRangeOf(e),
        })),
      };
      return { ...state, active, rest: null, lastFinishedId: null };
    }
    case 'CANCEL_WORKOUT':
      return { ...state, active: null, rest: null, interval: null };
    case 'CLOSE_SUMMARY':
      return state.lastFinishedId ? { ...state, lastFinishedId: null } : state;
    case 'FINISH_WORKOUT': {
      if (!state.active) return state;
      // En kørende finisher gemmes med (#331), hvis mindst én runde er lavet
      const running = state.interval ? finisherFromRun(state.interval, action.now) : null;
      const active = running ? withFinisher(state.active, running) : state.active;
      const finishers = active.finishers ?? [];
      // Kørende stopure stoppes, så tiden kommer med
      const exercises = active.exercises
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
      if (!exercises.length && !finishers.length) return { ...state, active: null, rest: null, interval: null, lastFinishedId: null };
      // Hvis en øvelse i et supersæt ikke blev lavet, kan supersættet være opløst
      const done: Workout = { ...endPause(active, action.now), exercises: normalizeSupersets(exercises), finishedAt: action.now };
      return {
        ...state,
        active: null,
        rest: null,
        interval: null,
        history: [done, ...state.history],
        lastFinishedId: done.id,
        goals: markGoalsReached(state.goals ?? [], done),
      };
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
    case 'SET_DELOAD':
      return mapActive(state, (w) => {
        if (!!w.deload === action.on) return w;
        if (action.on) return { ...w, deload: true };
        const { deload: _d, ...rest } = w;
        return rest;
      });
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
                  weight: s.weight || (action.weight !== 0 ? String(action.weight).replace('.', ',') : ''),
                  reps: s.reps || (action.reps > 0 ? String(action.reps) : ''),
                  ...(action.seconds ? { seconds: s.seconds || String(action.seconds) } : {}),
                  ...(action.meters ? { meters: s.meters || String(action.meters).replace('.', ',') } : {}),
                },
          ),
        })),
      );
    case 'APPLY_DELOAD':
      return mapActive(state, (w) => ({
        ...mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) =>
            s.warmup || s.done || isDropSet(s) || s.weight.trim()
              ? s
              : { ...s, weight: action.weight, reps: s.reps || (action.reps > 0 ? String(action.reps) : '') },
          ),
        })),
        deload: true,
      }));
    case 'ADD_WARMUP_SETS':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const work = e.sets.filter((x) => !x.warmup);
          const base = warmupBaseWeight(state.history, e);
          if (!base) return e;
          const sets =
            action.barWeight !== undefined ? warmupSets(base, action.barWeight) : warmupSetsFor(base, state, state.unit ?? 'kg');
          const warm = sets.map(
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
    case 'SET_SET_TAG':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) => {
            if (s.id !== action.setId || (s.tag ?? null) === action.tag) return s;
            const { tag: _old, ...rest } = s;
            // Et mærket sæt er et arbejdssæt – opvarmning og mærke udelukker hinanden
            if (!action.tag) return rest;
            const { warmup: _w, ...work } = rest;
            return { ...work, tag: action.tag };
          }),
        })),
      );
    case 'SET_SET_WARMUP':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) => {
            if (s.id !== action.setId || !!s.warmup === action.warmup) return s;
            const { warmup: _w, tag: _t, ...rest } = s;
            return action.warmup ? { ...rest, warmup: true } : s.tag ? { ...rest, tag: s.tag } : rest;
          }),
        })),
      );
    case 'ADD_DROP_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const idx = e.sets.findIndex((s) => s.id === action.setId);
          if (idx < 0) return e;
          const from = e.sets[idx];
          const drop: SetEntry = { ...emptySet(), weight: dropSetWeight(from.weight), reps: '', tag: 'drop' };
          return { ...e, sets: [...e.sets.slice(0, idx + 1), drop, ...e.sets.slice(idx + 1)] };
        }),
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
        const prev = set.warmup || isDropSet(set) ? undefined : previousSetsFor(state.history, state.active, we.exerciseId)[workIdx];
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
      let next = reducer(state, { type: 'UPDATE_SET', weId: action.weId, setId: action.setId, patch });
      // Reelle pauser (#315): husk hvornår sættet blev krydset af, og hvor meget træningen da havde været sat på pause
      next = mapActive(next, (w) =>
        mapExercise(w, action.weId, (e) => ({
          ...e,
          sets: e.sets.map((s) => {
            if (s.id !== action.setId) return s;
            const { doneAt: _d, donePausedMs: _p, ...rest } = s;
            return nowDone ? { ...rest, doneAt: action.now, donePausedMs: pausedMsAt(w, action.now) } : rest;
          }),
        })),
      );
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
    case 'SET_INTERVAL_CONFIG':
      return { ...state, intervalConfig: cleanIntervalConfig(action.config) };
    case 'START_INTERVAL': {
      // I træningen eller fra startskærmen (#332); indstillingerne huskes til næste gang (#330)
      const config = cleanIntervalConfig(action.config);
      return { ...state, intervalConfig: config, interval: { config, startedAt: action.now } };
    }
    case 'STOP_INTERVAL':
      return state.interval ? { ...state, interval: null } : state;
    case 'SAVE_FINISHER': {
      // Gem den kørende finisher på træningen (#331). For kort (ingen hel runde) → intet gemmes.
      if (!state.interval) return state;
      const f = finisherFromRun(state.interval, action.now, action.rounds);
      const cleared = { ...state, interval: null };
      return f && state.active ? mapActive(cleared, (w) => withFinisher(w, f)) : cleared;
    }
    case 'SAVE_FINISHER_AS_WORKOUT': {
      // En finisher uden træning (#332) gemmes som en kort træning med navnet på typen
      if (!state.interval) return state;
      const workout = finisherWorkout(state.interval, action.now, action.rounds);
      const cleared = { ...state, interval: null };
      if (!workout) return cleared;
      return { ...cleared, history: [workout, ...state.history].sort((a, b) => b.startedAt - a.startedAt) };
    }
    case 'REMOVE_FINISHER': {
      const drop = (w: Workout): Workout =>
        w.finishers?.some((f) => f.id === action.finisherId) ? { ...w, finishers: w.finishers.filter((f) => f.id !== action.finisherId) } : w;
      if (!action.workoutId) return mapActive(state, drop);
      const target = state.history.find((w) => w.id === action.workoutId);
      if (!target) return state;
      const next = drop(target);
      return next === target ? state : { ...state, history: state.history.map((w) => (w === target ? next : w)) };
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
    case 'SET_TESTED_1RM': {
      const ex = state.exercises.find((e) => e.id === action.exerciseId);
      if (!ex) return state;
      const w = action.weight;
      const weight = w !== undefined && Number.isFinite(w) && w > 0 ? Math.min(1000, Math.round(w * 100) / 100) : undefined;
      if (weight === ex.testedOneRM) return state;
      const { testedOneRM: _old, ...base } = ex;
      const updated: Exercise = weight === undefined ? base : { ...base, testedOneRM: weight };
      return { ...state, exercises: state.exercises.map((e) => (e.id === ex.id ? updated : e)) };
    }
    case 'SET_EXERCISE_CUES': {
      const ex = state.exercises.find((e) => e.id === action.exerciseId);
      if (!ex || !ex.custom) return state;
      const text = cleanCues(action.cues);
      const cues = text || undefined;
      if (cues === ex.cues) return state;
      const { cues: _old, ...base } = ex;
      const updated: Exercise = cues === undefined ? base : { ...base, cues };
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
    case 'SET_SHOW_RPE':
      return { ...state, showRpe: action.on };
    case 'SET_UNIT':
      return isWeightUnit(action.unit) && action.unit !== state.unit ? { ...state, unit: action.unit } : state;
    case 'SET_SHOW_TIME_LEFT':
      return { ...state, showTimeLeft: action.on };
    case 'SET_THEME':
      return isTheme(action.theme) && action.theme !== state.theme ? { ...state, theme: action.theme } : state;
    case 'SET_LARGE_TEXT':
      return !!action.on === state.largeText ? state : { ...state, largeText: !!action.on };
    case 'SET_SET_TARGET': {
      if (!MUSCLES.includes(action.muscle)) return state;
      const value = clampSetTarget(action.value);
      const cur = setTargetsOf(state);
      return cur[action.muscle] === value ? state : { ...state, setTargets: { ...cur, [action.muscle]: value } };
    }
    case 'SET_TRAINING_DAYS': {
      const days = cleanTrainingDays(action.days);
      const cur = state.trainingDays ?? [];
      return days.length === cur.length && days.every((d, i) => d === cur[i]) ? state : { ...state, trainingDays: days };
    }
    case 'SET_BODY_WEIGHT': {
      const kg = Number.isFinite(action.kg) && action.kg > 0 && action.kg <= 400 ? Math.round(action.kg * 10000) / 10000 : null;
      return kg === (state.bodyWeight ?? null) ? state : { ...state, bodyWeight: kg };
    }
    case 'TOGGLE_FAVORITE': {
      const favs = state.favorites ?? [];
      if (favs.includes(action.exerciseId)) return { ...state, favorites: favs.filter((id) => id !== action.exerciseId) };
      if (!state.exercises.some((e) => e.id === action.exerciseId)) return state;
      return { ...state, favorites: [...favs, action.exerciseId] };
    }
    case 'DISMISS_RECAP':
      return { ...state, recapDismissed: action.key };
    case 'HIDE_YEAR_REVIEW': {
      const hidden = state.yearReviewHidden ?? [];
      return hidden.includes(action.year) ? state : { ...state, yearReviewHidden: [...hidden, action.year] };
    }
    case 'DISMISS_STALL': {
      const sessions = stallSessions(state, action.exerciseId);
      if (!sessions.length) return state;
      const best = Math.max(...sessions.map((x) => x.e1rm));
      return { ...state, stallDismissed: { ...(state.stallDismissed ?? {}), [action.exerciseId]: { best, sessions: sessions.length } } };
    }
    case 'ADD_GOAL': {
      const weight = Math.round(action.weight * 100) / 100;
      const reps = Math.round(action.reps);
      if (!(weight > 0) || !(reps >= 1) || !state.exercises.some((e) => e.id === action.exerciseId)) return state;
      const goal: LiftGoal = { id: action.id, exerciseId: action.exerciseId, weight, reps, createdAt: action.now };
      if (action.targetDate && action.targetDate > 0) goal.targetDate = action.targetDate;
      return { ...state, goals: [...(state.goals ?? []), goal] };
    }
    case 'DELETE_GOAL':
      return { ...state, goals: (state.goals ?? []).filter((g) => g.id !== action.goalId) };
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
      // Med lb ændres lb-stangen, så kg-indstillingen bevares (#347)
      if (state.unit === 'lb') {
        return action.weight > 0 && action.weight <= 110 ? { ...state, barWeightLb: action.weight } : state;
      }
      return action.weight > 0 && action.weight <= 50 ? { ...state, barWeight: action.weight } : state;
    case 'TOGGLE_PLATE': {
      if (state.unit === 'lb') {
        if (!DEFAULT_PLATES_LB.includes(action.plate)) return state;
        const cur = state.platesLb?.length ? state.platesLb : DEFAULT_PLATES_LB;
        const onLb = cur.includes(action.plate);
        if (onLb && cur.length === 1) return state;
        const platesLb = onLb ? cur.filter((p) => p !== action.plate) : [...cur, action.plate];
        return { ...state, platesLb: platesLb.sort((a, b) => b - a) };
      }
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
            ...repRangeOf(e),
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
    case 'SET_TEMPLATE_REPS': {
      // Rep-interval på en øvelse i en skabelon (#257). null/null fjerner intervallet.
      const tpl = state.templates.find((t) => t.id === action.templateId);
      const cur = tpl?.exercises[action.index];
      if (!tpl || !cur) return state;
      let next: TemplateExercise;
      if (action.min === null && action.max === null) {
        if (cur.repMin === undefined && cur.repMax === undefined) return state;
        const { repMin: _a, repMax: _b, ...rest } = cur;
        next = rest;
      } else {
        if (!validRepRange(action.min, action.max)) return state;
        if (cur.repMin === action.min && cur.repMax === action.max) return state;
        next = { ...cur, repMin: action.min!, repMax: action.max! };
      }
      const exercises = tpl.exercises.map((e, k) => (k === action.index ? next : e));
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
    case 'UNDO_DELETE':
      return undoDelete(state, action.deletion);
  }
}

/* ---------- Fortryd sletning (#221) ---------- */

/** Hvor et slettet sæt/en fjernet øvelse sad: den igangværende træning eller kladden af en rettet træning */
type DraftTarget = 'active' | 'editing';

/** Det, der skal til for at lægge den seneste sletning tilbage. Huskes kun i hukommelsen, aldrig i localStorage. */
export type Deletion = { label: string } & (
  | { kind: 'set'; target: DraftTarget; workoutId: string; weId: string; index: number; set: SetEntry }
  | {
      kind: 'exercise';
      target: DraftTarget;
      workoutId: string;
      index: number;
      exercise: WorkoutExercise;
      /** Supersæt-id'er før fjernelsen, så et opløst supersæt samles igen */
      supersets: Record<string, string | undefined>;
    }
  | { kind: 'cancelled'; workout: Workout }
  | { kind: 'workout'; workout: Workout }
  | { kind: 'template'; index: number; template: Template }
  | { kind: 'measurement'; measurement: BodyMeasurement }
);

/**
 * Genkender en sletning lavet af `action` (prev → next) og returnerer, hvad der skal til for at fortryde den.
 * null = handlingen slettede ikke noget.
 */
export function lastDeletion(prev: AppState, action: Action, next: AppState): Deletion | null {
  if (prev === next) return null;
  const target: DraftTarget = 'edit' in action && action.edit ? 'editing' : 'active';
  const draft = prev[target];
  switch (action.type) {
    case 'REMOVE_SET': {
      const we = draft?.exercises.find((e) => e.id === action.weId);
      const index = we?.sets.findIndex((x) => x.id === action.setId) ?? -1;
      if (!draft || !we || index < 0) return null;
      return { kind: 'set', label: 'Sæt slettet', target, workoutId: draft.id, weId: we.id, index, set: we.sets[index] };
    }
    case 'REMOVE_EXERCISE': {
      const index = draft?.exercises.findIndex((e) => e.id === action.weId) ?? -1;
      if (!draft || index < 0) return null;
      const supersets = Object.fromEntries(draft.exercises.map((e) => [e.id, e.supersetId]));
      return { kind: 'exercise', label: 'Øvelse fjernet', target, workoutId: draft.id, index, exercise: draft.exercises[index], supersets };
    }
    case 'CANCEL_WORKOUT':
      return prev.active ? { kind: 'cancelled', label: 'Træning annulleret', workout: prev.active } : null;
    case 'DELETE_WORKOUT': {
      const workout = prev.history.find((w) => w.id === action.workoutId);
      return workout ? { kind: 'workout', label: 'Træning slettet', workout } : null;
    }
    case 'DELETE_TEMPLATE': {
      const index = prev.templates.findIndex((t) => t.id === action.templateId);
      return index < 0 ? null : { kind: 'template', label: 'Skabelon slettet', index, template: prev.templates[index] };
    }
    case 'DELETE_MEASUREMENT': {
      const measurement = prev.bodyLog.find((m) => m.id === action.id);
      return measurement ? { kind: 'measurement', label: 'Måling slettet', measurement } : null;
    }
    default:
      return null;
  }
}

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const i = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, i), item, ...list.slice(i)];
}

/** Lægger en sletning tilbage, hvor den var, og fjerner dens "gravsten", så den ikke slettes igen ved synk */
function undoDelete(state: AppState, d: Deletion): AppState {
  const unbury = (s: AppState, id: string): AppState => {
    if (!(id in (s.deleted ?? {}))) return s;
    const { [id]: _gone, ...deleted } = s.deleted;
    return { ...s, deleted };
  };
  switch (d.kind) {
    case 'set':
    case 'exercise': {
      const w = state[d.target];
      if (!w || w.id !== d.workoutId) return state;
      let changed: Workout;
      if (d.kind === 'set') {
        const we = w.exercises.find((e) => e.id === d.weId);
        if (!we || we.sets.some((x) => x.id === d.set.id)) return state;
        changed = mapExercise(w, d.weId, (e) => ({ ...e, sets: insertAt(e.sets, d.index, d.set) }));
      } else {
        if (w.exercises.some((e) => e.id === d.exercise.id)) return state;
        const back = insertAt(w.exercises, d.index, d.exercise).map((e): WorkoutExercise => {
          if (!(e.id in d.supersets)) return e;
          const { supersetId: _old, ...rest } = e;
          const id = d.supersets[e.id];
          return id ? { ...rest, supersetId: id } : rest;
        });
        changed = { ...w, exercises: normalizeSupersets(back) };
      }
      return { ...state, [d.target]: changed };
    }
    case 'cancelled':
      return state.active ? state : { ...state, active: d.workout };
    case 'workout':
      if (state.history.some((w) => w.id === d.workout.id)) return state;
      return unbury({ ...state, history: [...state.history, d.workout].sort((a, b) => b.startedAt - a.startedAt) }, d.workout.id);
    case 'template':
      if (state.templates.some((t) => t.id === d.template.id)) return state;
      return unbury({ ...state, templates: insertAt(state.templates, d.index, d.template) }, d.template.id);
    case 'measurement':
      if (state.bodyLog.some((m) => m.id === d.measurement.id)) return state;
      return unbury({ ...state, bodyLog: [...state.bodyLog, d.measurement].sort((a, b) => b.date - a.date) }, d.measurement.id);
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
  'barWeightLb',
  'platesLb',
  'weeklyGoal',
  'showHints',
  'restSound',
  'restVibrate',
  'keepAwake',
  'showRpe',
  'unit',
  'showTimeLeft',
  'recapDismissed',
  'yearReviewHidden',
  'stallDismissed',
  'favorites',
  'program',
  'programSkip',
  'bodyWeight',
  'setTargets',
  'trainingDays',
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
  if (prev.goals !== next.goals) gone(prev.goals ?? [], next.goals ?? []);
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
  if (prev.goals !== next.goals) out = { ...out, goals: touch(prev.goals ?? [], out.goals ?? []) };
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
    ? Object.fromEntries([...SETTINGS.map((k) => [k, remote[k] === undefined ? local[k] : remote[k]]), ['settingsAt', remote.settingsAt]])
    : {};
  const active = local.active ?? remote.active ?? null;
  const favorites = ((settings as Partial<AppState>).favorites ?? local.favorites ?? []).filter((id) => !(id in deleted));
  return {
    ...local,
    ...settings,
    favorites,
    deleted,
    exercises: mergeById(local.exercises, remote.exercises ?? [], deleted),
    templates: mergeById(local.templates, remote.templates ?? [], deleted),
    goals: mergeById(local.goals ?? [], remote.goals ?? [], deleted),
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
export function syncPayload(state: AppState): Omit<AppState, 'rest' | 'editing' | 'lastFinishedId' | 'interval'> {
  const { rest: _rest, editing: _editing, lastFinishedId: _last, interval: _interval, ...rest } = state;
  return rest;
}

/** Har enheden data, der er værd at beholde? (træninger, egne øvelser eller en igangværende træning) */
export function hasOwnData(state: AppState): boolean {
  return (
    state.history.length > 0 || !!state.active || state.exercises.some((e) => e.custom) || state.bodyLog.length > 0
  );
}

/* ---------- Teknik-tips (#337) ---------- */

export const MAX_CUES_LENGTH = 600;

/** Rydder en tekst med egne tips: trimmer hver linje, fjerner tomme linjer og begrænser længden. */
export function cleanCues(text: string): string {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_CUES_LENGTH)
    .trim();
}

/** Tips der skal vises for en øvelse: de indbyggede, eller en egen øvelses tekst delt i linjer. Tom liste = intet. */
export function exerciseCues(state: AppState, exerciseId: string): string[] {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex) return [];
  if (ex.custom) return typeof ex.cues === 'string' ? cleanCues(ex.cues).split('\n').filter(Boolean) : [];
  return BUILT_IN_CUES[ex.id] ?? [];
}

/** Har øvelsen egne tips, der kan redigeres? (kun egne øvelser) */
export function canEditCues(state: AppState, exerciseId: string): boolean {
  return !!state.exercises.find((e) => e.id === exerciseId)?.custom;
}

/* ---------- Gem/indlæs ---------- */

// Staging-versionen (…/workout-tracker/staging/) ligger på samme domæne som den rigtige app
// og får derfor sin egen nøgle, så test aldrig kan røre brugerens rigtige data.
export const STORAGE_KEY: string = import.meta.env.VITE_STORAGE_KEY || 'loeft-state-v1';
export const IS_STAGING = import.meta.env.VITE_STAGING === '1';

/* ---------- Tema (#293) ---------- */

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'dark', label: 'Mørk' },
  { id: 'light', label: 'Lys' },
  { id: 'system', label: 'Følg telefonen' },
];

export function isTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light' || v === 'system';
}

/** Det tema, der faktisk vises: "Følg telefonen" bliver lys eller mørk efter telefonens indstilling. */
export function resolveTheme(theme: Theme | undefined, phonePrefersLight: boolean): 'dark' | 'light' {
  if (theme === 'light') return 'light';
  if (theme === 'system') return phonePrefersLight ? 'light' : 'dark';
  return 'dark';
}

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
    const exercises = [...own, ...base.exercises.filter((e) => !known.has(e.id))];
    const ids = new Set(exercises.map((e) => e.id));
    return {
      ...base,
      ...parsed,
      exercises,
      // Favoritter fra før #190 findes ikke; ukendte øvelser fjernes
      favorites: Array.isArray(parsed.favorites) ? [...new Set(parsed.favorites)].filter((id) => ids.has(id)) : [],
      // Kropsvægt-indstillingen fra før #206 findes ikke
      bodyWeight: typeof parsed.bodyWeight === 'number' && parsed.bodyWeight > 0 ? parsed.bodyWeight : null,
      // RPE-indstillingen fra før #237 findes ikke – feltet var altid vist
      showRpe: typeof parsed.showRpe === 'boolean' ? parsed.showRpe : true,
      // Vægtenheden fra før #344 findes ikke – alt var i kg
      unit: isWeightUnit(parsed.unit) ? parsed.unit : 'kg',
      // Lb-stang og -skiver fra før #347 findes ikke; gamle barWeight/plates er kg-indstillingerne
      barWeightLb: typeof parsed.barWeightLb === 'number' && parsed.barWeightLb > 0 ? parsed.barWeightLb : DEFAULT_BAR_LB,
      platesLb:
        Array.isArray(parsed.platesLb) && parsed.platesLb.some((p) => typeof p === 'number' && p > 0)
          ? parsed.platesLb.filter((p) => typeof p === 'number' && p > 0)
          : [...DEFAULT_PLATES_LB],
      showTimeLeft: typeof parsed.showTimeLeft === 'boolean' ? parsed.showTimeLeft : true,
      // Tema fra før #293 findes ikke – appen var altid mørk
      theme: isTheme(parsed.theme) ? parsed.theme : 'dark',
      // Stor tekst fra før #295 findes ikke
      largeText: parsed.largeText === true,
      // Skjulte årsoversigter fra før #309 findes ikke
      yearReviewHidden: Array.isArray(parsed.yearReviewHidden)
        ? parsed.yearReviewHidden.filter((y): y is number => Number.isInteger(y))
        : [],
      // Skjulte "står stille"-påmindelser fra før #360 findes ikke
      stallDismissed: cleanStallDismissed(parsed.stallDismissed),
      // Løftemål fra før #197 findes ikke
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      // Ugeplanen fra før #322 findes ikke – ingen planlagte dage
      trainingDays: cleanTrainingDays(parsed.trainingDays),
      // Ugentlige sætmål fra før #300 findes ikke – standardmålene bruges
      setTargets: setTargetsOf(parsed),
      // Intervaltimeren fra før #330 findes ikke; en kørende timer kan også køre uden træning (#332)
      intervalConfig: cleanIntervalConfig(parsed.intervalConfig ?? INTERVAL_DEFAULTS.emom),
      interval:
        parsed.interval && typeof parsed.interval.startedAt === 'number'
          ? { config: cleanIntervalConfig(parsed.interval.config), startedAt: parsed.interval.startedAt }
          : null,
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
  // "Belastning (kg)" (#209): kropsvægt + ekstra vægt for kropsvægtsøvelser, tom for andre sæt
  // "Mærke" (#245): Opvarmning, Drop-sæt, Til failure eller AMRAP – tom for almindelige sæt
  const rows = [['Dato', 'Træning', 'Øvelse', 'Sæt', 'Vægt (kg)', 'Reps', 'RPE', 'Sek.', 'Meter', 'Belastning (kg)', 'Mærke']];
  for (const w of [...state.history].reverse()) {
    const date = new Date(w.startedAt).toISOString();
    for (const ex of w.exercises) {
      const bw = isBodyweightReps(state, ex.exerciseId);
      ex.sets.forEach((s, i) => {
        const load = bw && !isTimedSet(s) ? String(setLoad(state, w, ex.exerciseId, s)) : '';
        const mark = s.warmup ? 'Opvarmning' : (setTagInfo(s.tag)?.name ?? '');
        rows.push([date, w.name, name.get(ex.exerciseId) ?? ex.exerciseId, String(i + 1), s.weight, s.reps, s.rpe, s.seconds ?? '', (s.meters ?? '').replace(',', '.'), load, mark]);
      });
    }
    // Finishers (#331): én række hver, med beskrivelsen som "Øvelse" og tiden i "Sek."
    (w.finishers ?? []).forEach((f, i) => {
      rows.push([date, w.name, finisherLabel(f), String(i + 1), '', f.rounds != null ? String(f.rounds) : '', '', String(f.seconds), '', '', 'Finisher']);
    });
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

/* ---------- Estimeret træningstid (#279) ---------- */

/** Ca. tid for selve sættet (uden pause), når der ikke er historik */
export const SET_WORK_SECONDS = 40;
const MIN_REAL_WORKOUT_MS = 5 * 60_000;
const MAX_REAL_WORKOUT_MS = 4 * 3_600_000;

export interface DurationEstimate {
  /** Minutter, rundet til nærmeste 5 */
  minutes: number;
  /** 'history' = gennemsnit af dine seneste træninger, 'estimate' = regnet ud fra sæt og pauser */
  basis: 'history' | 'estimate';
}

function roundTo5(min: number): number {
  return Math.max(5, Math.round(min / 5) * 5);
}

/**
 * Hvor lang tid en skabelon ca. tager (#279): gennemsnit af de seneste op til 5 afsluttede
 * træninger fra skabelonen (pauser fraregnet, under 5 min og over 4 timer ignoreres).
 * Uden historik: sæt × (≈40 sek + øvelsens pausetid); et supersæt holder kun én pause pr. runde.
 * null hvis skabelonen ikke findes eller er tom.
 */
export function templateDurationEstimate(state: AppState, templateId: string): DurationEstimate | null {
  const tpl = state.templates.find((t) => t.id === templateId);
  if (!tpl) return null;
  const recent = state.history
    .filter((w) => w.templateId === templateId && w.finishedAt)
    .map((w) => ({ at: w.startedAt, ms: workoutDuration(w, w.finishedAt!) }))
    .filter((d) => d.ms >= MIN_REAL_WORKOUT_MS && d.ms <= MAX_REAL_WORKOUT_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  if (recent.length) {
    const avg = recent.reduce((n, d) => n + d.ms, 0) / recent.length;
    return { minutes: roundTo5(avg / 60_000), basis: 'history' };
  }
  if (!tpl.exercises.some((e) => e.sets > 0)) return null;
  let seconds = 0;
  const seenGroups = new Set<string>();
  for (const te of tpl.exercises) {
    seconds += te.sets * SET_WORK_SECONDS;
    if (!te.supersetId) {
      seconds += te.sets * restFor(state, te.exerciseId);
    } else if (!seenGroups.has(te.supersetId)) {
      seenGroups.add(te.supersetId);
      const group = tpl.exercises.filter((e) => e.supersetId === te.supersetId);
      const rounds = Math.max(...group.map((e) => e.sets));
      seconds += rounds * Math.max(...group.map((e) => restFor(state, e.exerciseId)));
    }
  }
  return { minutes: roundTo5(seconds / 60), basis: 'estimate' };
}

/**
 * Ca. minutter tilbage af den aktive træning (#279): sæt der mangler × tid pr. sæt.
 * Tid pr. sæt = gennemsnit i denne træning, når mindst 3 sæt er udført, ellers ≈40 sek + pausetid.
 * null når der ikke er en træning, eller alle sæt er udført.
 */
export function timeLeftEstimate(state: AppState, now: number): number | null {
  const w = state.active;
  if (!w) return null;
  const all = w.exercises.flatMap((we) => we.sets.map((s) => ({ we, s })));
  const left = all.filter((x) => !x.s.done);
  if (!left.length) return null;
  const doneCount = all.length - left.length;
  let seconds: number;
  if (doneCount >= 3) {
    seconds = (workoutDuration(w, now) / 1000 / doneCount) * left.length;
  } else {
    seconds = left.reduce((n, x) => n + SET_WORK_SECONDS + restFor(state, x.we.exerciseId), 0);
  }
  return Math.max(1, Math.round(seconds / 60));
}

/* ---------- Intervaltimer til finishers (#329) ---------- */

export const INTERVAL_MODES: IntervalMode[] = ['emom', 'tabata', 'amrap'];
export type { IntervalConfig, IntervalMode };

export const INTERVAL_DEFAULTS: Record<IntervalMode, IntervalConfig> = {
  emom: { mode: 'emom', minutes: 10, workSeconds: 60, restSeconds: 0, rounds: 10 },
  tabata: { mode: 'tabata', minutes: 4, workSeconds: 20, restSeconds: 10, rounds: 8 },
  amrap: { mode: 'amrap', minutes: 12, workSeconds: 0, restSeconds: 0, rounds: 1 },
};

/** Grænser for felterne pr. tilstand: [min, max] */
export const INTERVAL_LIMITS = {
  minutes: [1, 60],
  emomWorkSeconds: [10, 60],
  workSeconds: [5, 300],
  restSeconds: [0, 300],
  rounds: [1, 50],
} as const;

function clampInt(v: unknown, [lo, hi]: readonly [number, number], fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Gør vilkårlige (gemte/indtastede) indstillinger gyldige: ukendt tilstand → EMOM, tal klemmes ind i grænserne. */
export function cleanIntervalConfig(raw: unknown): IntervalConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof IntervalConfig, unknown>>;
  const mode: IntervalMode = INTERVAL_MODES.includes(r.mode as IntervalMode) ? (r.mode as IntervalMode) : 'emom';
  const d = INTERVAL_DEFAULTS[mode];
  const minutes = clampInt(r.minutes, INTERVAL_LIMITS.minutes, d.minutes);
  if (mode === 'emom') {
    const workSeconds = clampInt(r.workSeconds, INTERVAL_LIMITS.emomWorkSeconds, d.workSeconds);
    return { mode, minutes, workSeconds, restSeconds: 60 - workSeconds, rounds: minutes };
  }
  if (mode === 'tabata') {
    const workSeconds = clampInt(r.workSeconds, INTERVAL_LIMITS.workSeconds, d.workSeconds);
    const restSeconds = clampInt(r.restSeconds, INTERVAL_LIMITS.restSeconds, d.restSeconds);
    const rounds = clampInt(r.rounds, INTERVAL_LIMITS.rounds, d.rounds);
    const total = rounds * (workSeconds + restSeconds) - restSeconds;
    return { mode, minutes: Math.max(1, Math.ceil(total / 60)), workSeconds, restSeconds, rounds };
  }
  return { mode, minutes, workSeconds: minutes * 60, restSeconds: 0, rounds: 1 };
}

export type IntervalPhase = 'work' | 'rest';

interface IntervalSegment {
  round: number;
  phase: IntervalPhase;
  start: number;
  end: number;
}

/** Hele forløbet som faser i sekunder fra start. Tabata slutter på sidste arbejdsperiode (ingen pause bagefter). */
function intervalSegments(config: IntervalConfig): IntervalSegment[] {
  const c = cleanIntervalConfig(config);
  const segs: IntervalSegment[] = [];
  if (c.mode === 'amrap') return [{ round: 1, phase: 'work', start: 0, end: c.minutes * 60 }];
  let t = 0;
  for (let round = 1; round <= c.rounds; round++) {
    segs.push({ round, phase: 'work', start: t, end: t + c.workSeconds });
    t += c.workSeconds;
    const last = round === c.rounds;
    if (c.restSeconds > 0 && !(last && c.mode === 'tabata')) {
      segs.push({ round, phase: 'rest', start: t, end: t + c.restSeconds });
      t += c.restSeconds;
    }
  }
  return segs;
}

/** Samlet varighed i sekunder */
export function intervalTotalSeconds(config: IntervalConfig): number {
  const segs = intervalSegments(config);
  return segs[segs.length - 1].end;
}

export interface IntervalStatus {
  round: number;
  rounds: number;
  phase: IntervalPhase;
  /** Hele sekunder tilbage af den aktuelle fase (rundet op) */
  phaseLeft: number;
  /** Hele sekunder tilbage i alt (rundet op) */
  totalLeft: number;
  /** Sekunder gået siden start */
  elapsed: number;
  done: boolean;
}

/** Hvor er vi i forløbet? Beregnes kun ud fra tidsstempler, så den er rigtig, også efter at skærmen har været slukket. */
export function intervalStatus(config: IntervalConfig, startedAt: number, now: number): IntervalStatus {
  const segs = intervalSegments(config);
  const total = segs[segs.length - 1].end;
  const rounds = segs[segs.length - 1].round;
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  if (elapsed >= total) {
    const last = segs[segs.length - 1];
    return { round: last.round, rounds, phase: last.phase, phaseLeft: 0, totalLeft: 0, elapsed: total, done: true };
  }
  const seg = segs.find((s) => elapsed < s.end) ?? segs[segs.length - 1];
  return {
    round: seg.round,
    rounds,
    phase: seg.phase,
    phaseLeft: Math.ceil(seg.end - elapsed),
    totalLeft: Math.ceil(total - elapsed),
    elapsed,
    done: false,
  };
}

/** `count` = kort bip 3-2-1 før et faseskift, `phase` = ny fase starter, `end` = langt bip, finisheren er slut. */
export type IntervalCueKind = 'count' | 'phase' | 'end';
export interface IntervalCue {
  /** Sekunder fra start */
  at: number;
  kind: IntervalCueKind;
}

/** Alle bip i forløbet, sorteret efter tid */
export function intervalCueTimeline(config: IntervalConfig): IntervalCue[] {
  const segs = intervalSegments(config);
  const total = segs[segs.length - 1].end;
  const cues: IntervalCue[] = [];
  for (const s of segs) {
    for (let k = 3; k >= 1; k--) {
      const at = s.end - k;
      if (at > s.start) cues.push({ at, kind: 'count' });
    }
    cues.push({ at: s.end, kind: s.end === total ? 'end' : 'phase' });
  }
  return cues;
}

/** Længere spring end dette mellem to tik (fx skærm slukket) giver kun det seneste bip, ikke en hel stribe. */
export const INTERVAL_CUE_CATCHUP_S = 2;

/**
 * Hvilke bip skal gives mellem to tik? Et bip hører til tikket, hvor dets tidspunkt ligger i (prevNow, now],
 * så intet bip gives to gange eller springes over. Efter et langt spring gives kun det seneste.
 */
export function intervalCues(config: IntervalConfig, startedAt: number, prevNow: number, now: number): IntervalCue[] {
  if (now <= prevNow) return [];
  const from = (prevNow - startedAt) / 1000;
  const to = (now - startedAt) / 1000;
  const due = intervalCueTimeline(config).filter((c) => c.at > from && c.at <= to);
  if (to - from > INTERVAL_CUE_CATCHUP_S && due.length > 1) return [due[due.length - 1]];
  return due;
}

/** Dansk tekst til en finisher, fx "EMOM 10 min", "Tabata 8 × 20/10 s", "AMRAP 12 min · 7 runder". */
export function describeFinisher(config: IntervalConfig, rounds?: number | null): string {
  const c = cleanIntervalConfig(config);
  const base =
    c.mode === 'emom'
      ? `EMOM ${c.minutes} min`
      : c.mode === 'tabata'
        ? `Tabata ${c.rounds} × ${c.workSeconds}/${c.restSeconds} s`
        : `AMRAP ${c.minutes} min`;
  if (rounds == null || !Number.isFinite(rounds) || rounds < 0) return base;
  const n = Math.round(rounds);
  return `${base} · ${n} ${n === 1 ? 'runde' : 'runder'}`;
}

/* ---------- Gemte finishers (#331) ---------- */

/** En stoppet AMRAP gemmes kun, hvis den har kørt mindst så længe (sekunder) */
export const AMRAP_MIN_SAVE_SECONDS = 60;

/**
 * Finisheren, som den kørende intervaltimer svarer til ved `now`. EMOM og Tabata tæller kun hele runder
 * (arbejdet i runden er lavet); en stoppet EMOM på 4 af 10 min gemmes som "EMOM 4 min". null = intet at gemme.
 */
export function finisherFromRun(run: IntervalRun, now: number, rounds?: number | null): Finisher | null {
  const config = cleanIntervalConfig(run.config);
  const s = intervalStatus(config, run.startedAt, now);
  const seconds = Math.floor(s.elapsed);
  const base = { id: uid(), seconds, at: now };
  if (config.mode === 'amrap') {
    if (!s.done && seconds < AMRAP_MIN_SAVE_SECONDS) return null;
    const r = rounds != null && Number.isFinite(rounds) && rounds >= 0 ? Math.min(999, Math.round(rounds)) : undefined;
    const minutes = s.done ? config.minutes : Math.max(1, Math.floor(seconds / 60));
    return { ...base, config: cleanIntervalConfig({ ...config, minutes }), ...(r !== undefined ? { rounds: r } : {}) };
  }
  const completed = s.done ? s.rounds : s.phase === 'rest' ? s.round : s.round - 1;
  if (completed < 1) return null;
  const done = config.mode === 'emom' ? { ...config, minutes: completed } : { ...config, rounds: completed };
  return { ...base, config: cleanIntervalConfig(done) };
}

/** "EMOM 10 min", "Tabata 8 × 20/10 s" eller "AMRAP 12 min · 7 runder" */
export function finisherLabel(f: Finisher): string {
  return describeFinisher(f.config, f.config.mode === 'amrap' ? f.rounds : null);
}

function withFinisher(w: Workout, f: Finisher): Workout {
  return { ...w, finishers: [...(w.finishers ?? []), f] };
}

/** Navn på en træning, der kun er en finisher (#332) */
export const FINISHER_WORKOUT_NAMES: Record<IntervalMode, string> = { emom: 'EMOM', tabata: 'Tabata', amrap: 'AMRAP' };

/**
 * En afsluttet træning uden øvelser med kun finisheren (#332). Den tæller i kalender, stime og måned som enhver
 * anden træning, men har ingen sæt – så den rører hverken volumen eller rekorder. null = for kort til at gemme.
 */
export function finisherWorkout(run: IntervalRun, now: number, rounds?: number | null): Workout | null {
  const f = finisherFromRun(run, now, rounds);
  if (!f) return null;
  return {
    id: uid(),
    name: FINISHER_WORKOUT_NAMES[f.config.mode],
    startedAt: run.startedAt,
    finishedAt: run.startedAt + f.seconds * 1000,
    exercises: [],
    finishers: [f],
  };
}

/* ---------- Rep-maks-tabel (#354) ---------- */

export const REP_MAX_COUNTS = [1, 2, 3, 5, 8, 10, 12] as const;

export interface RepMaxRow {
  reps: number;
  /** Tungeste arbejdssæt med mindst så mange reps (kg, kropsvægt medregnet) – null = intet endnu */
  best: { weight: number; reps: number; date: number; workoutId: string } | null;
  /** Vægten for så mange reps ud fra din bedste e1RM (samme formel), afrundet til 0,5 kg. 0 = ingen data. */
  estimated: number;
}

/** Hovedsæt (ikke opvarmning/drop) med belastning for en øvelse i de givne træninger */
function repMaxSets(state: AppState, history: Workout[], exerciseId: string) {
  const out: { weight: number; reps: number; date: number; workoutId: string }[] = [];
  for (const raw of history) {
    const w = withLoads(state, raw);
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!isMainSet(s) || isTimedSet(s)) continue;
        const weight = num(s.weight);
        const reps = Math.floor(num(s.reps));
        if (weight > 0 && reps > 0) out.push({ weight, reps, date: w.startedAt, workoutId: w.id });
      }
    }
  }
  return out;
}

/** Bedste vægt pr. rep-antal (1, 2, 3, 5, 8, 10, 12) og den estimerede vægt ud fra din bedste e1RM */
export function repMaxTable(state: AppState, exerciseId: string): RepMaxRow[] {
  if (exerciseKind(state, exerciseId) !== 'reps') return [];
  const sets = repMaxSets(state, state.history, exerciseId);
  const e1rm = sets.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);
  return REP_MAX_COUNTS.map((reps) => {
    let best: RepMaxRow['best'] = null;
    for (const s of sets) {
      if (s.reps < reps) continue;
      // Tungeste vinder; ved samme vægt det tidligste sæt (første gang man klarede det)
      if (!best || s.weight > best.weight || (s.weight === best.weight && s.date < best.date)) best = s;
    }
    const estimated = e1rm > 0 ? Math.round((reps === 1 ? e1rm : e1rm / (1 + reps / 30)) * 2) / 2 : 0;
    return { reps, best, estimated };
  });
}

/**
 * Hvilke rep-maks (1, 2, 3, 5 …) slog en afsluttet træning for en øvelse, sammenlignet med alle tidligere
 * træninger? Første gang man laver øvelsen er ingen rekord.
 */
export function repMaxesBeaten(state: AppState, workoutId: string, exerciseId: string): number[] {
  if (exerciseKind(state, exerciseId) !== 'reps') return [];
  const w = state.history.find((x) => x.id === workoutId);
  if (!w) return [];
  const before = repMaxSets(state, state.history.filter((x) => x.startedAt < w.startedAt), exerciseId);
  if (!before.length) return [];
  const now = repMaxSets(state, [w], exerciseId);
  return REP_MAX_COUNTS.filter((reps) => {
    const best = (list: typeof now) => list.reduce((m, s) => (s.reps >= reps ? Math.max(m, s.weight) : m), 0);
    const cur = best(now);
    return cur > 0 && cur > best(before);
  });
}

/** "Stærk" rep-område (#355): dit faktiske bedste sæt ligger over vægten, din e1RM forudsiger */
export function isStrongRepMax(row: RepMaxRow): boolean {
  return !!row.best && row.estimated > 0 && row.best.weight > row.estimated;
}

export interface WorkoutRepMax {
  exerciseId: string;
  name: string;
  /** Det højeste rep-antal, træningen slog (fx 5 → "Ny 5RM") */
  reps: number;
  /** Den nye bedste vægt for så mange reps (kg) */
  weight: number;
}

/**
 * Nye rep-maks i en afsluttet træning (#356): én linje pr. øvelse med det højeste slåede rep-antal,
 * så ét tungt sæt ikke giver fem linjer.
 */
export function workoutRepMaxes(state: AppState, workoutId: string): WorkoutRepMax[] {
  const w = state.history.find((x) => x.id === workoutId);
  if (!w) return [];
  const names = new Map(state.exercises.map((e) => [e.id, e.name]));
  const out: WorkoutRepMax[] = [];
  for (const exerciseId of [...new Set(w.exercises.map((e) => e.exerciseId))]) {
    const beaten = repMaxesBeaten(state, workoutId, exerciseId);
    if (!beaten.length) continue;
    const reps = beaten[beaten.length - 1];
    const weight = repMaxSets(state, [w], exerciseId).reduce((m, s) => (s.reps >= reps ? Math.max(m, s.weight) : m), 0);
    out.push({ exerciseId, name: names.get(exerciseId) ?? exerciseId, reps, weight });
  }
  return out;
}

/** "🏆 Ny 5RM i Squat: 105 kg" (#356) */
export function repMaxLine(r: WorkoutRepMax, unit: WeightUnit = 'kg'): string {
  return `🏆 Ny ${r.reps}RM i ${r.name}: ${formatWeight(r.weight, unit)}`;
}

/* ---------- Står stille / let uge (#360) ---------- */

/** Mindst så mange træninger med øvelsen, før den kan "stå stille" */
export const STALL_MIN_SESSIONS = 4;
/** Så mange af de seneste træninger skal være uden fremgang */
export const STALL_WINDOW = 3;
/** En let uge er ca. 90 % af den seneste topvægt */
export const DELOAD_FACTOR = 0.9;

interface StallSession {
  workoutId: string;
  date: number;
  /** Bedste estimerede 1RM i træningen */
  e1rm: number;
  /** Tungeste hovedsæt */
  topWeight: number;
  /** Reps i alt på hovedsæt med topvægten */
  topReps: number;
  /** Reps i første sæt med topvægten */
  firstTopReps: number;
}

/**
 * Træningerne med en vægt × reps-øvelse, ældste først. Kun hovedsæt (ikke opvarmning eller drop-sæt)
 * med vægt og reps tæller. Kropsvægtsøvelser og tids-/distanceøvelser har ingen.
 */
function stallSessions(state: Pick<AppState, 'history' | 'exercises'>, exerciseId: string): StallSession[] {
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex || (ex.kind ?? 'reps') !== 'reps' || ex.equipment === 'Kropsvægt') return [];
  const out: StallSession[] = [];
  for (const w of state.history) {
    // Let uge (#362) tæller ikke som stilstand
    if (!w.finishedAt || w.deload) continue;
    const sets = w.exercises
      .filter((we) => we.exerciseId === exerciseId)
      .flatMap((we) => we.sets)
      .filter((s) => isMainSet(s) && num(s.weight) > 0 && num(s.reps) > 0);
    if (!sets.length) continue;
    const topWeight = Math.max(...sets.map((s) => num(s.weight)));
    out.push({
      workoutId: w.id,
      date: w.startedAt,
      e1rm: Math.max(...sets.map((s) => estimate1RM(num(s.weight), num(s.reps)))),
      topWeight,
      topReps: sets.filter((s) => num(s.weight) === topWeight).reduce((n, s) => n + num(s.reps), 0),
      firstTopReps: num(sets.find((s) => num(s.weight) === topWeight)!.reps),
    });
  }
  return out.sort((a, b) => a.date - b.date);
}

/** Vægt rundet til nærmeste skridt (2,5 kg, 1 kg for håndvægte) */
function roundToStep(kg: number, step: number): number {
  return Math.round(Math.round(kg / step) * step * 100) / 100;
}

export interface StalledExercise {
  exerciseId: string;
  name: string;
  /** Bedste estimerede 1RM (kg) */
  best: number;
  /** Antal træninger uden ny bedste e1RM (inkl. den, der satte den) */
  sessions: number;
  /** Seneste topvægt (kg) */
  lastWeight: number;
  /** Reps i første sæt med topvægten sidste gang */
  lastReps: number;
  /** Forslag til en let uge: ~90 % af seneste topvægt, rundet til 2,5 kg (1 kg for håndvægte) */
  lightWeight: number;
}

/**
 * Står øvelsen stille? (#360) Mindst 4 træninger, og enten
 * - ingen af de seneste 3 slog den bedste e1RM fra før dem, eller
 * - de seneste 3 var med samme topvægt og færre reps hver gang.
 * Skjulte påmindelser tælles ikke med her – se `stalledExercises`.
 */
export function exerciseStall(state: Pick<AppState, 'history' | 'exercises'>, exerciseId: string): StalledExercise | null {
  const list = stallSessions(state, exerciseId);
  if (list.length < STALL_MIN_SESSIONS) return null;
  const recent = list.slice(-STALL_WINDOW);
  const before = list.slice(0, -STALL_WINDOW);
  const bestBefore = Math.max(...before.map((x) => x.e1rm));
  const noNewBest = recent.every((x) => x.e1rm <= bestBefore);
  const fewerReps =
    recent.every((x) => x.topWeight === recent[0].topWeight) && recent.every((x, i) => i === 0 || x.topReps < recent[i - 1].topReps);
  if (!noNewBest && !fewerReps) return null;
  const best = Math.max(...list.map((x) => x.e1rm));
  const bestIdx = list.findIndex((x) => x.e1rm === best);
  const ex = state.exercises.find((e) => e.id === exerciseId)!;
  const lastWeight = list[list.length - 1].topWeight;
  const step = ex.equipment === 'Håndvægt' ? 1 : 2.5;
  return {
    exerciseId,
    name: ex.name,
    best,
    sessions: list.length - bestIdx,
    lastWeight,
    lastReps: list[list.length - 1].firstTopReps,
    lightWeight: roundToStep(lastWeight * DELOAD_FACTOR, step),
  };
}

/** Er påmindelsen skjult? Den kommer igen ved en ny bedste e1RM eller 3 træninger mere end da den blev skjult. */
export function isStallDismissed(state: Pick<AppState, 'history' | 'exercises' | 'stallDismissed'>, exerciseId: string): boolean {
  const d = state.stallDismissed?.[exerciseId];
  if (!d) return false;
  const list = stallSessions(state, exerciseId);
  const best = list.length ? Math.max(...list.map((x) => x.e1rm)) : 0;
  return best <= d.best && list.length < d.sessions + STALL_WINDOW;
}

/** Øvelser, der står stille og ikke er skjult – længst stillestående først (#360) */
export function stalledExercises(state: Pick<AppState, 'history' | 'exercises' | 'stallDismissed'>): StalledExercise[] {
  const ids = new Set(state.history.flatMap((w) => w.exercises.map((we) => we.exerciseId)));
  return [...ids]
    .map((id) => exerciseStall(state, id))
    .filter((s): s is StalledExercise => s !== null && !isStallDismissed(state, s.exerciseId))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'da'));
}

/** Rens gemte skjulte påmindelser (gamle data har ingen) */
export function cleanStallDismissed(raw: unknown): Record<string, StallDismissal> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, StallDismissal> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const d = v as Partial<StallDismissal> | null;
    if (d && typeof d.best === 'number' && typeof d.sessions === 'number') out[id] = { best: d.best, sessions: d.sessions };
  }
  return out;
}

/**
 * Vægten til "Let uge" som kg-tekst til sættet (#361). Med kg: den foreslåede lette vægt (fx "90", "92,5").
 * Med lb: ~90 % af seneste topvægt rundet til 5 lb, gemt i kg som når man skriver i lb.
 */
export function deloadWeightInput(stall: Pick<StalledExercise, 'lightWeight' | 'lastWeight'>, unit: WeightUnit = 'kg'): string {
  if (unit === 'kg') return String(stall.lightWeight).replace('.', ',');
  const lb = Math.round((toDisplay(stall.lastWeight, 'lb') * DELOAD_FACTOR) / 5) * 5;
  return weightFromInput(String(lb), 'lb');
}

/** Den lette vægt som tekst i den valgte enhed: "90 kg" eller "200 lb" */
export function deloadWeightText(stall: Pick<StalledExercise, 'lightWeight' | 'lastWeight'>, unit: WeightUnit = 'kg'): string {
  return formatWeight(num(deloadWeightInput(stall, unit)), unit);
}

/** "Bænkpres står stille (4 træninger) – prøv en let uge med 90 kg" (#361) */
export function stallText(stall: StalledExercise, unit: WeightUnit = 'kg'): string {
  return `${stall.name} står stille (${stall.sessions} træninger) – prøv en let uge med ${deloadWeightText(stall, unit)}`;
}

/* ---------- Træningsbalance (#367) ---------- */

/** Bevægelsesmønster: pres, træk, ben eller mave */
export type MovementPattern = 'push' | 'pull' | 'legs' | 'core';

export const PATTERN_NAMES: Record<MovementPattern, string> = { push: 'Pres', pull: 'Træk', legs: 'Ben', core: 'Mave' };

/** Faste mønstre for de indbyggede øvelser */
const SEED_PATTERNS: Record<string, MovementPattern> = {
  bench: 'push',
  'incline-db': 'push',
  dips: 'push',
  'cable-fly': 'push',
  ohp: 'push',
  lateral: 'push',
  pushdown: 'push',
  skullcrusher: 'push',
  deadlift: 'legs',
  rdl: 'legs',
  squat: 'legs',
  'leg-press': 'legs',
  lunge: 'legs',
  'leg-curl': 'legs',
  'leg-ext': 'legs',
  calf: 'legs',
  pullup: 'pull',
  row: 'pull',
  'lat-pulldown': 'pull',
  'face-pull': 'pull',
  curl: 'pull',
  hammer: 'pull',
  'dead-hang': 'pull',
  'farmers-walk': 'pull',
  rower: 'pull',
  plank: 'core',
  crunch: 'core',
};

/** Forslag til en indbygget øvelse pr. mønster, i prioriteret rækkefølge */
const PATTERN_SUGGESTIONS: Record<MovementPattern, string[]> = {
  push: ['bench', 'ohp', 'incline-db', 'dips', 'pushdown'],
  pull: ['row', 'lat-pulldown', 'pullup', 'face-pull', 'curl'],
  legs: ['squat', 'leg-press', 'lunge', 'rdl', 'leg-curl'],
  core: ['plank', 'crunch'],
};

/**
 * Mønsteret for en øvelse (#367). Indbyggede øvelser har et fast mønster; egne øvelser får et ud fra
 * muskelgruppen: Bryst/Skuldre → pres, Ryg → træk, Ben → ben, Mave → mave, Arme → pres (træk hvis navnet indeholder "curl").
 */
export function exercisePattern(ex: Pick<Exercise, 'id' | 'name' | 'muscle' | 'custom'>): MovementPattern {
  if (!ex.custom && SEED_PATTERNS[ex.id]) return SEED_PATTERNS[ex.id];
  switch (ex.muscle) {
    case 'Ryg':
      return 'pull';
    case 'Ben':
      return 'legs';
    case 'Mave':
      return 'core';
    case 'Arme':
      return /curl/i.test(ex.name) ? 'pull' : 'push';
    default:
      return 'push';
  }
}

/** Antal dage tilbage, der tæller med i balancen */
export const BALANCE_DAYS = 28;
/** Mindst så mange sæt i alt (for de to sider), før der gives et tip */
export const BALANCE_MIN_SETS = 10;

export interface BalanceTip {
  kind: 'push-pull' | 'upper-lower';
  strong: 'push' | 'pull' | 'upper' | 'lower';
  weak: 'push' | 'pull' | 'upper' | 'lower';
  /** Hvor mange gange flere sæt den stærke side har (null = den svage side har 0 sæt) */
  ratio: number | null;
  /** En indbygget øvelse til den svage side, som ikke er lavet i perioden */
  suggestion: { id: string; name: string } | null;
  /** Fx "Du træner 3× mere pres end træk – prøv at tilføje Roning" */
  text: string;
}

export interface TrainingBalance {
  push: number;
  pull: number;
  legs: number;
  core: number;
  /** Overkrop = pres + træk */
  upper: number;
  /** Underkrop = ben */
  lower: number;
  tips: BalanceTip[];
}

const SIDE_WORDS: Record<BalanceTip['strong'], string> = { push: 'pres', pull: 'træk', upper: 'overkrop', lower: 'ben' };

/**
 * Pres/træk- og overkrop/underkrop-balancen de sidste 28 dage (#367): udførte arbejdssæt (ikke opvarmning).
 * Et tip, når den ene side har under halvt så mange sæt som den anden (og der er mindst 10 sæt på de to sider).
 */
export function trainingBalance(state: Pick<AppState, 'history' | 'exercises'>, now: number): TrainingBalance {
  const since = now - BALANCE_DAYS * DAY_MS;
  const byId = new Map(state.exercises.map((e) => [e.id, e]));
  const counts: Record<MovementPattern, number> = { push: 0, pull: 0, legs: 0, core: 0 };
  const done = new Set<string>();
  for (const w of state.history) {
    if (w.startedAt < since || w.startedAt > now) continue;
    for (const we of w.exercises) {
      const ex = byId.get(we.exerciseId);
      if (!ex) continue;
      const n = we.sets.filter((s) => s.done && !s.warmup).length;
      if (!n) continue;
      done.add(ex.id);
      counts[exercisePattern(ex)] += n;
    }
  }
  const upper = counts.push + counts.pull;
  const lower = counts.legs;
  const suggest = (p: MovementPattern) => {
    const id = PATTERN_SUGGESTIONS[p].find((x) => !done.has(x) && byId.has(x));
    return id ? { id, name: byId.get(id)!.name } : null;
  };
  const tips: BalanceTip[] = [];
  const check = (
    kind: BalanceTip['kind'],
    a: BalanceTip['strong'],
    an: number,
    b: BalanceTip['strong'],
    bn: number,
    suggestFor: (weak: BalanceTip['strong']) => MovementPattern,
  ) => {
    if (an + bn < BALANCE_MIN_SETS) return;
    const [strong, sn, weak, wn] = an >= bn ? [a, an, b, bn] : [b, bn, a, an];
    if (wn * 2 >= sn) return;
    const ratio = wn > 0 ? Math.round((sn / wn) * 10) / 10 : null;
    const suggestion = suggest(suggestFor(weak));
    const head =
      ratio === null
        ? `Du træner ${SIDE_WORDS[strong]}, men ingen ${SIDE_WORDS[weak]}`
        : `Du træner ${String(ratio).replace('.', ',')}× mere ${SIDE_WORDS[strong]} end ${SIDE_WORDS[weak]}`;
    tips.push({ kind, strong, weak, ratio, suggestion, text: suggestion ? `${head} – prøv at tilføje ${suggestion.name}` : head });
  };
  check('push-pull', 'push', counts.push, 'pull', counts.pull, (weak) => weak as MovementPattern);
  check('upper-lower', 'upper', upper, 'lower', lower, () =>
    // Overkrop for lidt: foreslå den svageste af pres og træk
    lower > upper ? (counts.pull < counts.push ? 'pull' : 'push') : 'legs',
  );
  return { ...counts, upper, lower, tips };
}
