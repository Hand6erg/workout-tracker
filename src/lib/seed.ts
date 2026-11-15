import type { Exercise, Template } from './types';

export const SEED_EXERCISES: Exercise[] = [
  { id: 'bench', name: 'Bænkpres', muscle: 'Bryst', equipment: 'Stang' },
  { id: 'incline-db', name: 'Skrå bænkpres', muscle: 'Bryst', equipment: 'Håndvægt' },
  { id: 'dips', name: 'Dips', muscle: 'Bryst', equipment: 'Kropsvægt' },
  { id: 'cable-fly', name: 'Kabel flyes', muscle: 'Bryst', equipment: 'Kabel' },
  { id: 'deadlift', name: 'Dødløft', muscle: 'Ryg', equipment: 'Stang' },
  { id: 'pullup', name: 'Pull-up', muscle: 'Ryg', equipment: 'Kropsvægt' },
  { id: 'row', name: 'Roning', muscle: 'Ryg', equipment: 'Stang' },
  { id: 'lat-pulldown', name: 'Lat pulldown', muscle: 'Ryg', equipment: 'Kabel' },
  { id: 'face-pull', name: 'Face pull', muscle: 'Skuldre', equipment: 'Kabel' },
  { id: 'squat', name: 'Squat', muscle: 'Ben', equipment: 'Stang' },
  { id: 'rdl', name: 'Rumænsk dødløft', muscle: 'Ben', equipment: 'Stang' },
  { id: 'leg-press', name: 'Benpres', muscle: 'Ben', equipment: 'Maskine' },
  { id: 'lunge', name: 'Lunges', muscle: 'Ben', equipment: 'Håndvægt' },
  { id: 'leg-curl', name: 'Leg curl', muscle: 'Ben', equipment: 'Maskine' },
  { id: 'leg-ext', name: 'Leg extension', muscle: 'Ben', equipment: 'Maskine' },
  { id: 'calf', name: 'Lægløft', muscle: 'Ben', equipment: 'Maskine' },
  { id: 'ohp', name: 'Militærpres', muscle: 'Skuldre', equipment: 'Stang' },
  { id: 'lateral', name: 'Sidehævninger', muscle: 'Skuldre', equipment: 'Håndvægt' },
  { id: 'curl', name: 'Biceps curl', muscle: 'Arme', equipment: 'Håndvægt' },
  { id: 'hammer', name: 'Hammer curl', muscle: 'Arme', equipment: 'Håndvægt' },
  { id: 'pushdown', name: 'Triceps pushdown', muscle: 'Arme', equipment: 'Kabel' },
  { id: 'skullcrusher', name: 'Skullcrusher', muscle: 'Arme', equipment: 'Stang' },
  { id: 'plank', name: 'Planke', muscle: 'Mave', equipment: 'Kropsvægt' },
  { id: 'crunch', name: 'Kabel crunch', muscle: 'Mave', equipment: 'Kabel' },
];

export const SEED_TEMPLATES: Template[] = [
  {
    id: 'tpl-push',
    name: 'Push',
    exercises: [
      { exerciseId: 'bench', sets: 3 },
      { exerciseId: 'ohp', sets: 3 },
      { exerciseId: 'incline-db', sets: 3 },
      { exerciseId: 'lateral', sets: 3 },
      { exerciseId: 'pushdown', sets: 3 },
    ],
  },
  {
    id: 'tpl-pull',
    name: 'Pull',
    exercises: [
      { exerciseId: 'deadlift', sets: 3 },
      { exerciseId: 'pullup', sets: 3 },
      { exerciseId: 'row', sets: 3 },
      { exerciseId: 'face-pull', sets: 3 },
      { exerciseId: 'curl', sets: 3 },
    ],
  },
  {
    id: 'tpl-legs',
    name: 'Ben',
    exercises: [
      { exerciseId: 'squat', sets: 3 },
      { exerciseId: 'rdl', sets: 3 },
      { exerciseId: 'leg-press', sets: 3 },
      { exerciseId: 'leg-curl', sets: 3 },
      { exerciseId: 'calf', sets: 3 },
    ],
  },
];
