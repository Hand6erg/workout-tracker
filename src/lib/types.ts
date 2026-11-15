export type Muscle = 'Bryst' | 'Ryg' | 'Ben' | 'Skuldre' | 'Arme' | 'Mave';
export type Equipment = 'Stang' | 'Håndvægt' | 'Kabel' | 'Maskine' | 'Kropsvægt';

export const MUSCLES: Muscle[] = ['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave'];
export const EQUIPMENT: Equipment[] = ['Stang', 'Håndvægt', 'Kabel', 'Maskine', 'Kropsvægt'];

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  custom?: boolean;
}

export interface SetEntry {
  id: string;
  /** Tom streng = ikke udfyldt endnu */
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  /** Opvarmningssæt tæller ikke med i volumen, rekorder og statistik */
  warmup?: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  /** Øvelser med samme id i træk udgør et supersæt */
  supersetId?: string;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  exercises: WorkoutExercise[];
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  supersetId?: string;
}

export interface Template {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

export interface RestTimer {
  endsAt: number;
  total: number;
}

export interface BodyMeasurement {
  id: string;
  /** Tidspunkt i ms */
  date: number;
  /** Kropsvægt i kg */
  weight?: number;
  /** Fedtprocent */
  bodyFat?: number;
  /** Taljemål i cm */
  waist?: number;
}

export interface AppState {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  history: Workout[];
  active: Workout | null;
  rest: RestTimer | null;
  restSeconds: number;
  /** Stangvægt i kg til pladeberegner og opvarmning */
  barWeight: number;
  /** Skivestørrelser man har adgang til (kg) */
  plates: number[];
  /** Kropsmål, nyeste først */
  bodyLog: BodyMeasurement[];
}
