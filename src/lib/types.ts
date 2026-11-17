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
  /** Hvornår en egen øvelse sidst blev ændret (til fletning mellem enheder) */
  updatedAt?: number;
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
  /** Note til øvelsen i denne træning (fx "sædehøjde 4") */
  note?: string;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  finishedAt?: number;
  /** Sat mens træningen er sat på pause (tidspunkt for pausens start) */
  pausedAt?: number;
  /** Samlet tid træningen har været sat på pause (ms) */
  pausedMs?: number;
  exercises: WorkoutExercise[];
  /** Note til hele træningen (fx "sov dårligt") */
  note?: string;
  /** Skabelonen træningen blev startet fra (til programmet, #106) */
  templateId?: string;
  /** Hvornår træningen sidst blev rettet efter den var afsluttet (til fletning mellem enheder, #91) */
  updatedAt?: number;
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
  /** Hvornår skabelonen sidst blev ændret (til fletning mellem enheder) */
  updatedAt?: number;
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
  /** Kladde af en afsluttet træning, der rettes i (#87). Kun på denne enhed – rører aldrig `active`. */
  editing: Workout | null;
  rest: RestTimer | null;
  restSeconds: number;
  /** Stangvægt i kg til pladeberegner og opvarmning */
  barWeight: number;
  /** Skivestørrelser man har adgang til (kg) */
  plates: number[];
  /** Kropsmål, nyeste først */
  bodyLog: BodyMeasurement[];
  /** Mål for antal træninger pr. uge (til stime) */
  weeklyGoal: number;
  /** Vis forslag til næste vægt under træningen */
  showHints: boolean;
  /** Bip, når pausen er slut */
  restSound: boolean;
  /** Vibration, når pausen er ved at være / er slut */
  restVibrate: boolean;
  /** Program: skabelon-id'er i rækkefølge (tom = intet program, #106) */
  program: string[];
  /** Antal "Spring over" siden den seneste træning i programmet (`after` = den træning, null = ingen endnu) */
  programSkip: { after: string | null; n: number };
  /** Hvornår indstillingerne sidst blev ændret (0 = aldrig). Den nyeste ændring vinder ved fletning. */
  settingsAt: number;
  /** Slettede træninger, skabeloner, øvelser og kropsmål: id → tidspunkt. Så de forbliver slettede på alle enheder. */
  deleted: Record<string, number>;
}
