import { SEED_EXERCISES, SEED_TEMPLATES } from './seed';
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

export function initialState(): AppState {
  return {
    version: 1,
    exercises: SEED_EXERCISES,
    templates: SEED_TEMPLATES,
    history: [],
    active: null,
    rest: null,
    restSeconds: 90,
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

export function setVolume(s: SetEntry): number {
  return num(s.weight) * num(s.reps);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.done).reduce((a, s) => a + setVolume(s), 0),
    0,
  );
}

export function doneSetCount(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
}

/** Bedste sæt (højeste estimerede 1RM) for en øvelse i en træning */
export function bestSet(sets: SetEntry[]): SetEntry | null {
  let best: SetEntry | null = null;
  let bestScore = -1;
  for (const s of sets) {
    if (!s.done) continue;
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
      const done = ex.sets.filter((s) => s.done);
      if (done.length) return done;
    }
  }
  return [];
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
      const sets = ex.sets.filter((s) => s.done);
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
  | { type: 'FINISH_WORKOUT'; now: number }
  | { type: 'RENAME_WORKOUT'; name: string }
  | { type: 'ADD_EXERCISES'; exerciseIds: string[] }
  | { type: 'REMOVE_EXERCISE'; weId: string }
  | { type: 'ADD_SET'; weId: string }
  | { type: 'REMOVE_SET'; weId: string; setId: string }
  | { type: 'UPDATE_SET'; weId: string; setId: string; patch: Partial<Omit<SetEntry, 'id'>> }
  | { type: 'TOGGLE_SET'; weId: string; setId: string; now: number }
  | { type: 'ADJUST_REST'; delta: number }
  | { type: 'SKIP_REST' }
  | { type: 'SET_REST_SECONDS'; seconds: number }
  | { type: 'ADD_CUSTOM_EXERCISE'; id: string; name: string; muscle: Muscle; equipment: Equipment }
  | { type: 'SAVE_TEMPLATE_FROM_WORKOUT'; workoutId: string; name: string }
  | { type: 'DELETE_TEMPLATE'; templateId: string }
  | { type: 'DELETE_WORKOUT'; workoutId: string }
  | { type: 'IMPORT_STATE'; state: AppState };

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
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
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
        const prev = previousSets(state.history, we.exerciseId)[idx];
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
        exercises: w.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.length })),
      };
      return { ...state, templates: [...state.templates, tpl] };
    }
    case 'DELETE_TEMPLATE':
      return { ...state, templates: state.templates.filter((t) => t.id !== action.templateId) };
    case 'DELETE_WORKOUT':
      return { ...state, history: state.history.filter((w) => w.id !== action.workoutId) };
    case 'IMPORT_STATE':
      return action.state;
  }
}

/* ---------- Gem/indlæs ---------- */

export const STORAGE_KEY = 'loeft-state-v1';

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
