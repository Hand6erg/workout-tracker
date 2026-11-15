import { SEED_EXERCISES, SEED_TEMPLATES } from './seed';
import { MUSCLES } from './types';
import type {
  AppState,
  Equipment,
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
    rest: null,
    restSeconds: 90,
    barWeight: DEFAULT_BAR,
    plates: [...DEFAULT_PLATES],
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

export function setVolume(s: SetEntry): number {
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

/** Sæt hvor der er skrevet reps, men som ikke er krydset af */
export function uncheckedFilledCount(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => !s.done && s.reps.trim() !== '').length, 0);
}

/** Bedste sæt (højeste estimerede 1RM) for en øvelse i en træning */
export function bestSet(sets: SetEntry[]): SetEntry | null {
  let best: SetEntry | null = null;
  let bestScore = -1;
  for (const s of sets) {
    if (!isWorkSet(s)) continue;
    const score = estimate1RM(num(s.weight), num(s.reps)) || num(s.reps);
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

export function formatSet(s: SetEntry): string {
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

/* ---------- Rekorder ---------- */

export type RecordKind = 'heaviest' | '1rm' | 'reps';

export interface PersonalRecords {
  /** Tungeste vægt løftet (med reps og dato) */
  heaviest?: { weight: number; reps: number; date: number };
  /** Højeste estimerede 1RM */
  best1RM?: { value: number; weight: number; reps: number; date: number };
  /** Flest reps pr. vægt, nøgle = vægt i kg */
  repsAtWeight: Record<string, { reps: number; date: number }>;
}

interface ScoredSet {
  weight: number;
  reps: number;
  date: number;
}

function validSets(sets: SetEntry[], date: number): ScoredSet[] {
  return sets
    .filter((s) => isWorkSet(s) && num(s.reps) > 0)
    .map((s) => ({ weight: num(s.weight), reps: num(s.reps), date }));
}

function recordsFrom(sets: ScoredSet[]): PersonalRecords {
  const r: PersonalRecords = { repsAtWeight: {} };
  for (const s of sets) {
    if (s.weight > 0 && (!r.heaviest || s.weight > r.heaviest.weight)) r.heaviest = { ...s };
    const e = estimate1RM(s.weight, s.reps);
    if (e > 0 && (!r.best1RM || e > r.best1RM.value)) r.best1RM = { value: e, ...s };
    const key = String(s.weight);
    if (!r.repsAtWeight[key] || s.reps > r.repsAtWeight[key].reps) r.repsAtWeight[key] = { reps: s.reps, date: s.date };
  }
  return r;
}

function historySets(history: Workout[], exerciseId: string): ScoredSet[] {
  return history.flatMap((w) =>
    w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => validSets(e.sets, w.startedAt)),
  );
}

/** Rekorder for en øvelse ud fra afsluttede træninger */
export function personalRecords(state: AppState, exerciseId: string): PersonalRecords {
  return recordsFrom(historySets(state.history, exerciseId));
}

/**
 * Hvilke rekorder slår et udført sæt? Sammenlignes med afsluttede træninger og
 * de udførte sæt før det i den aktive træning. Første gang en øvelse laves er ingen rekord.
 */
export function recordsBrokenBy(state: AppState, exerciseId: string, set: SetEntry): RecordKind[] {
  const [candidate] = validSets([set], 0);
  if (!candidate) return [];
  const earlier: ScoredSet[] = historySets(state.history, exerciseId);
  outer: for (const we of state.active?.exercises ?? []) {
    if (we.exerciseId !== exerciseId) continue;
    for (const s of we.sets) {
      if (s.id === set.id) break outer;
      earlier.push(...validSets([s], 0));
    }
  }
  if (!earlier.length) return [];
  const prev = recordsFrom(earlier);
  const broken: RecordKind[] = [];
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

/* ---------- Reducer ---------- */

export type Action =
  | { type: 'START_WORKOUT'; templateId?: string; now: number }
  | { type: 'CANCEL_WORKOUT' }
  | { type: 'FINISH_WORKOUT'; now: number; includeUnchecked?: boolean }
  | { type: 'RENAME_WORKOUT'; name: string }
  | { type: 'ADD_EXERCISES'; exerciseIds: string[] }
  | { type: 'REMOVE_EXERCISE'; weId: string }
  | { type: 'ADD_SET'; weId: string }
  | { type: 'ADD_WARMUP_SETS'; weId: string; barWeight?: number }
  | { type: 'REMOVE_SET'; weId: string; setId: string }
  | { type: 'UPDATE_SET'; weId: string; setId: string; patch: Partial<Omit<SetEntry, 'id'>> }
  | { type: 'TOGGLE_SET'; weId: string; setId: string; now: number }
  | { type: 'ADJUST_REST'; delta: number }
  | { type: 'SKIP_REST' }
  | { type: 'SET_REST_SECONDS'; seconds: number }
  | { type: 'SET_BAR_WEIGHT'; weight: number }
  | { type: 'TOGGLE_PLATE'; plate: number }
  | { type: 'ADD_CUSTOM_EXERCISE'; id: string; name: string; muscle: Muscle; equipment: Equipment }
  | { type: 'SAVE_TEMPLATE_FROM_WORKOUT'; workoutId: string; name: string }
  | { type: 'DELETE_TEMPLATE'; templateId: string }
  | { type: 'DELETE_WORKOUT'; workoutId: string }
  | { type: 'IMPORT_STATE'; state: AppState }
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
  return state.active ? { ...state, active: fn(state.active) } : state;
}

function mapExercise(w: Workout, weId: string, fn: (e: WorkoutExercise) => WorkoutExercise): Workout {
  return { ...w, exercises: w.exercises.map((e) => (e.id === weId ? fn(e) : e)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'START_WORKOUT': {
      if (state.active) return state;
      const tpl = state.templates.find((t) => t.id === action.templateId);
      const active: Workout = {
        id: uid(),
        name: tpl?.name ?? defaultWorkoutName(action.now),
        startedAt: action.now,
        exercises: tpl ? tpl.exercises.map((e) => newWorkoutExercise(e.exerciseId, e.sets)) : [],
      };
      return { ...state, active, rest: null };
    }
    case 'CANCEL_WORKOUT':
      return { ...state, active: null, rest: null };
    case 'FINISH_WORKOUT': {
      if (!state.active) return state;
      const exercises = state.active.exercises
        .map((e) => ({
          ...e,
          sets: e.sets
            .filter((s) => s.done || (action.includeUnchecked && s.reps.trim() !== ''))
            .map((s) => ({ ...s, done: true })),
        }))
        .filter((e) => e.sets.length > 0);
      if (!exercises.length) return { ...state, active: null, rest: null };
      const done: Workout = { ...state.active, exercises, finishedAt: action.now };
      return { ...state, active: null, rest: null, history: [done, ...state.history] };
    }
    case 'RENAME_WORKOUT':
      return mapActive(state, (w) => ({ ...w, name: action.name }));
    case 'ADD_EXERCISES':
      return mapActive(state, (w) => ({
        ...w,
        exercises: [...w.exercises, ...action.exerciseIds.map((id) => newWorkoutExercise(id))],
      }));
    case 'REMOVE_EXERCISE':
      return mapActive(state, (w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== action.weId) }));
    case 'ADD_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const last = e.sets[e.sets.length - 1];
          const next = emptySet();
          if (last) {
            next.weight = last.weight;
            next.reps = last.reps;
          }
          return { ...e, sets: [...e.sets, next] };
        }),
      );
    case 'ADD_WARMUP_SETS':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => {
          const work = e.sets.filter((x) => !x.warmup);
          const first = work.find((x) => num(x.weight) > 0);
          if (!first) return e;
          const warm = warmupSets(num(first.weight), action.barWeight ?? state.barWeight).map(
            (ws): SetEntry => ({ ...emptySet(), weight: String(ws.weight).replace('.', ','), reps: String(ws.reps), warmup: true }),
          );
          return { ...e, sets: [...warm, ...work] };
        }),
      );
    case 'REMOVE_SET':
      return mapActive(state, (w) =>
        mapExercise(w, action.weId, (e) => ({ ...e, sets: e.sets.filter((s) => s.id !== action.setId) })),
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
        const workIdx = we.sets.slice(0, idx).filter((x) => !x.warmup).length;
        const prev = set.warmup ? undefined : previousSets(state.history, we.exerciseId)[workIdx];
        const weight = set.weight || prev?.weight || '';
        const reps = set.reps || prev?.reps || '';
        if (!reps) return state; // kan ikke markere et sæt uden reps
        patch = { ...patch, weight, reps };
      }
      const next = reducer(state, { type: 'UPDATE_SET', weId: action.weId, setId: action.setId, patch });
      return {
        ...next,
        rest: nowDone && state.restSeconds > 0
          ? { endsAt: action.now + state.restSeconds * 1000, total: state.restSeconds }
          : next.rest,
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
      return { ...state, restSeconds: Math.max(0, Math.min(600, Math.round(action.seconds))) };
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
          { id: action.id, name, muscle: action.muscle, equipment: action.equipment, custom: true },
        ],
      };
    }
    case 'SAVE_TEMPLATE_FROM_WORKOUT': {
      const w = state.history.find((h) => h.id === action.workoutId);
      if (!w) return state;
      const tpl: Template = {
        id: uid(),
        name: action.name.trim() || w.name,
        exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => !x.warmup).length })),
      };
      return { ...state, templates: [...state.templates, tpl] };
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

/* ---------- Online-gemning: flet to versioner ---------- */

function unionById<T extends { id: string }>(mine: T[], theirs: T[]): T[] {
  const ids = new Set(mine.map((x) => x.id));
  return [...mine, ...theirs.filter((x) => !ids.has(x.id))];
}

/**
 * Fletter data fra serveren ind i de lokale data. Intet lokalt forsvinder:
 * træninger, skabeloner og øvelser samles efter id, og ved samme id vinder den lokale udgave.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  return {
    ...local,
    exercises: unionById(local.exercises, remote.exercises ?? []),
    templates: unionById(local.templates, remote.templates ?? []),
    history: unionById(local.history, remote.history ?? []).sort((a, b) => b.startedAt - a.startedAt),
    active: local.active ?? remote.active ?? null,
  };
}

/** Det, der sendes til serveren (pausetimeren hører kun til denne enhed). */
export function syncPayload(state: AppState): Omit<AppState, 'rest'> {
  const { rest: _rest, ...rest } = state;
  return rest;
}

/** Har enheden data, der er værd at beholde? (træninger, egne øvelser eller en igangværende træning) */
export function hasOwnData(state: AppState): boolean {
  return state.history.length > 0 || !!state.active || state.exercises.some((e) => e.custom);
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
    return {
      ...base,
      ...parsed,
      exercises: [...(parsed.exercises ?? []), ...base.exercises.filter((e) => !known.has(e.id))],
    } as AppState;
  } catch {
    return base;
  }
}

/* ---------- Eksport ---------- */

export function toCsv(state: AppState): string {
  const name = new Map(state.exercises.map((e) => [e.id, e.name]));
  const esc = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['Dato', 'Træning', 'Øvelse', 'Sæt', 'Vægt (kg)', 'Reps', 'RPE']];
  for (const w of [...state.history].reverse()) {
    const date = new Date(w.startedAt).toISOString();
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) =>
        rows.push([date, w.name, name.get(ex.exerciseId) ?? ex.exerciseId, String(i + 1), s.weight, s.reps, s.rpe]),
      );
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
