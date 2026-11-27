export type Muscle = 'Bryst' | 'Ryg' | 'Ben' | 'Skuldre' | 'Arme' | 'Mave';
export type Equipment = 'Stang' | 'Håndvægt' | 'Kabel' | 'Maskine' | 'Kropsvægt';

export const MUSCLES: Muscle[] = ['Bryst', 'Ryg', 'Ben', 'Skuldre', 'Arme', 'Mave'];
export const EQUIPMENT: Equipment[] = ['Stang', 'Håndvægt', 'Kabel', 'Maskine', 'Kropsvægt'];

/** Hvordan en øvelse logges (#133): vægt × reps (standard), tid i sekunder, eller distance + tid */
export type ExerciseKind = 'reps' | 'time' | 'distance';
export const EXERCISE_KINDS: ExerciseKind[] = ['reps', 'time', 'distance'];

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  custom?: boolean;
  /** Mangler = 'reps' (vægt × reps), så gamle data er uændrede */
  kind?: ExerciseKind;
  /** Egen pausetid i sekunder (#119). Mangler = forslag/standard fra Profil */
  restSeconds?: number;
  /** Hvornår en egen øvelse sidst blev ændret (til fletning mellem enheder) */
  updatedAt?: number;
  /** Testet 1RM i kg (#250). Mangler = brug den estimerede 1RM fra historikken */
  testedOneRM?: number;
  /** Egne teknik-tips til en egen øvelse (#337), ét tip pr. linje. Mangler = ingen */
  cues?: string;
}

export interface SetEntry {
  id: string;
  /** Tom streng = ikke udfyldt endnu */
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  /** Tid i sekunder (tidssæt og distancesæt, #133) */
  seconds?: string;
  /** Distance i meter (distancesæt, #133) */
  meters?: string;
  /** Stopuret for et tidssæt kører siden dette tidspunkt (ms, #134). Gemmes som tidspunkt, så det tåler skærmlås og genindlæsning. */
  timerStartedAt?: number;
  /** Opvarmningssæt tæller ikke med i volumen, rekorder og statistik */
  warmup?: boolean;
  /** Sæt-mærke (#243): drop-sæt, til failure eller AMRAP. Mangler = almindeligt sæt. */
  tag?: SetTag;
  /** Hvornår sættet blev krydset af (ms, #315). Fjernes, når krydset fjernes. Mangler i gamle data. */
  doneAt?: number;
  /** Træningens samlede pausetid (ms), da sættet blev krydset af (#315) – så pauser trækkes fra hviletiden */
  donePausedMs?: number;
}

/** Sæt-mærker (#243). Drop-sæt tæller i volumen, men aldrig som rekord eller "sidste gang". */
export type SetTag = 'drop' | 'failure' | 'amrap';

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: SetEntry[];
  /** Øvelser med samme id i træk udgør et supersæt */
  supersetId?: string;
  /** Note til øvelsen i denne træning (fx "sædehøjde 4") */
  note?: string;
  /** Rep-interval fra skabelonen (#257), fx 8–12. Mangler = intet interval. */
  repMin?: number;
  repMax?: number;
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
  /** Den afsluttede træning, denne gentager (#149). "Forrige" hentes derfra. Mangler = seneste gang. */
  repeatOf?: string;
  /** Hvornår træningen sidst blev rettet efter den var afsluttet (til fletning mellem enheder, #91) */
  updatedAt?: number;
  /** Finishers fra intervaltimeren (#331), fx "EMOM 10 min". Mangler i gamle data. */
  finishers?: Finisher[];
  /** Let uge (#361): træningen blev lavet med lettere vægt efter "Let uge". Mangler i gamle data. */
  deload?: boolean;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  supersetId?: string;
  /** Rep-interval (#257), fx 8–12. Begge mangler = intet interval. */
  repMin?: number;
  repMax?: number;
}

/** Største tilladte rep-tal i et rep-interval (#257) */
export const MAX_TEMPLATE_REPS = 50;

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

/** Et løftemål, fx 100 kg × 1 i bænkpres (#197) */
export interface LiftGoal {
  id: string;
  exerciseId: string;
  /** Vægt i kg */
  weight: number;
  reps: number;
  /** Måldato (ms), valgfri */
  targetDate?: number;
  createdAt: number;
  /** Hvornår målet blev nået (afslutningstidspunktet for træningen) */
  achievedAt?: number;
  /** Hvornår målet sidst blev ændret (til fletning mellem enheder) */
  updatedAt?: number;
}

/** Farvetema (#293) */
export type Theme = 'dark' | 'light' | 'system';

/** Vægtenhed (#344). Data gemmes altid i kg – enheden ændrer kun visning og indtastning. */
export type WeightUnit = 'kg' | 'lb';

/** Intervaltimer til finishers (#329) */
export type IntervalMode = 'emom' | 'tabata' | 'amrap';

/**
 * Indstillinger for en finisher. Alle felter findes altid (efter `cleanIntervalConfig`), men bruges efter tilstand:
 * EMOM: `minutes` + `workSeconds` (arbejde pr. minut, 60 = hele minuttet). Tabata: `workSeconds`, `restSeconds`, `rounds`.
 * AMRAP: `minutes`.
 */
export interface IntervalConfig {
  mode: IntervalMode;
  minutes: number;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

/** En gemt finisher på en træning (#331) */
export interface Finisher {
  id: string;
  /** Det, der faktisk blev lavet (en stoppet EMOM på 4 af 10 min gemmes som "EMOM 4 min") */
  config: IntervalConfig;
  /** AMRAP: antal runder (valgfrit) */
  rounds?: number;
  /** Tid brugt i sekunder */
  seconds: number;
  /** Hvornår den blev gemt (ms) */
  at: number;
}

/** En kørende intervaltimer (#330). Kun på denne enhed. */
export interface IntervalRun {
  config: IntervalConfig;
  startedAt: number;
}

/** En skjult "står stille"-påmindelse (#360). Den vises igen ved ny bedste e1RM eller 3 træninger mere. */
export interface StallDismissal {
  /** Bedste estimerede 1RM (kg), da påmindelsen blev skjult */
  best: number;
  /** Antal træninger med øvelsen, da påmindelsen blev skjult */
  sessions: number;
}

export interface AppState {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  history: Workout[];
  active: Workout | null;
  /** Kladde af en afsluttet træning, der rettes i (#87). Kun på denne enhed – rører aldrig `active`. */
  editing: Workout | null;
  /** Træningen, der lige er afsluttet – dens opsummering vises (#142). Kun på denne enhed og nulstilles ved genindlæsning. */
  lastFinishedId?: string | null;
  rest: RestTimer | null;
  /** Kørende intervaltimer (#330) – kun på denne enhed, ligesom pausetimeren */
  interval?: IntervalRun | null;
  /** Senest brugte intervaltimer-indstillinger (#330) */
  intervalConfig?: IntervalConfig;
  restSeconds: number;
  /** Stangvægt i kg til pladeberegner og opvarmning */
  barWeight: number;
  /** Skivestørrelser man har adgang til (kg) */
  plates: number[];
  /** Stangvægt i lb, når enheden er lb (#347). Kg-indstillingen ovenfor røres ikke. */
  barWeightLb: number;
  /** Skivestørrelser i lb, når enheden er lb (#347) */
  platesLb: number[];
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
  /** Hold skærmen tændt, mens en træning er i gang (#154) */
  keepAwake: boolean;
  /** Vis RPE-feltet i træningen (#237). Loggede RPE-værdier beholdes, når det er slået fra. */
  showRpe: boolean;
  /** Vægtenhed (#344): 'kg' (standard) eller 'lb'. Loggen gemmes altid i kg. */
  unit: WeightUnit;
  /** "ca. 15 min tilbage" i den aktive træning (#281) */
  showTimeLeft: boolean;
  /** Farvetema (#293): mørk (standard), lys eller følg telefonen. Gælder kun denne enhed. */
  theme: Theme;
  /** Stor tekst (#295): større felter og knapper i træningen. Gælder kun denne enhed. */
  largeText: boolean;
  /** Den seneste måned ("2026-10"), hvis opsummering brugeren har lukket i Historik (#168). null = ingen. */
  recapDismissed: string | null;
  /** År, hvis "Dit træningsår"-kort brugeren har skjult i Historik (#309) */
  yearReviewHidden: number[];
  /** Skjulte "står stille"-påmindelser (#360): øvelses-id → bedste e1RM og antal træninger, da den blev skjult */
  stallDismissed: Record<string, StallDismissal>;
  /** Favoritøvelser (øvelses-id'er) – vises øverst i øvelsesvælgeren (#190) */
  favorites: string[];
  /** Kropsvægt (kg) fra Profil – bruges til kropsvægtsøvelser, når der ikke er et kropsmål (#206). null = ikke angivet. */
  bodyWeight: number | null;
  /** Ugentligt mål for arbejdssæt pr. muskelgruppe (#300). null = slået fra for den muskel. */
  setTargets: Record<Muscle, number | null>;
  /** Planlagte træningsdage (#322): 0 = mandag … 6 = søndag. Tom = ingen ugeplan. */
  trainingDays: number[];
  /** Løftemål (#197) */
  goals: LiftGoal[];
  /** Program: skabelon-id'er i rækkefølge (tom = intet program, #106) */
  program: string[];
  /** Antal "Spring over" siden den seneste træning i programmet (`after` = den træning, null = ingen endnu) */
  programSkip: { after: string | null; n: number };
  /** Hvornår indstillingerne sidst blev ændret (0 = aldrig). Den nyeste ændring vinder ved fletning. */
  settingsAt: number;
  /** Slettede træninger, skabeloner, øvelser og kropsmål: id → tidspunkt. Så de forbliver slettede på alle enheder. */
  deleted: Record<string, number>;
}
