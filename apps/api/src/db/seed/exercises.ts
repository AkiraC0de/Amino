import type { MuscleId, MuscleRole } from '@amino/shared';

export type ExerciseSeed = {
  slug: string;
  name: string;
  muscles: { muscleId: MuscleId; role: MuscleRole }[];
};

const primary = (muscleId: MuscleId) => ({ muscleId, role: 'primary' as const });
const secondary = (muscleId: MuscleId) => ({ muscleId, role: 'secondary' as const });

export const EXERCISE_SEED: ExerciseSeed[] = [
  { slug: 'barbell-bench-press', name: 'Barbell Bench Press', muscles: [primary('chest'), secondary('triceps'), secondary('shoulders')] },
  { slug: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', muscles: [primary('chest'), secondary('shoulders'), secondary('triceps')] },
  { slug: 'push-up', name: 'Push-Up', muscles: [primary('chest'), secondary('triceps'), secondary('abs')] },
  { slug: 'cable-fly', name: 'Cable Fly', muscles: [primary('chest')] },
  { slug: 'pull-up', name: 'Pull-Up', muscles: [primary('lats'), secondary('biceps'), secondary('forearms')] },
  { slug: 'lat-pulldown', name: 'Lat Pulldown', muscles: [primary('lats'), secondary('biceps')] },
  { slug: 'barbell-row', name: 'Barbell Row', muscles: [primary('upper-back'), secondary('lats'), secondary('biceps'), secondary('lower-back')] },
  { slug: 'seated-cable-row', name: 'Seated Cable Row', muscles: [primary('upper-back'), secondary('lats'), secondary('biceps')] },
  { slug: 'barbell-shrug', name: 'Barbell Shrug', muscles: [primary('traps'), secondary('forearms')] },
  { slug: 'overhead-press', name: 'Overhead Press', muscles: [primary('shoulders'), secondary('triceps'), secondary('traps')] },
  { slug: 'lateral-raise', name: 'Lateral Raise', muscles: [primary('shoulders')] },
  { slug: 'face-pull', name: 'Face Pull', muscles: [primary('shoulders'), secondary('upper-back'), secondary('traps')] },
  { slug: 'barbell-curl', name: 'Barbell Curl', muscles: [primary('biceps'), secondary('forearms')] },
  { slug: 'hammer-curl', name: 'Hammer Curl', muscles: [primary('biceps'), secondary('forearms')] },
  { slug: 'triceps-pushdown', name: 'Triceps Pushdown', muscles: [primary('triceps')] },
  { slug: 'close-grip-bench-press', name: 'Close-Grip Bench Press', muscles: [primary('triceps'), secondary('chest')] },
  { slug: 'wrist-curl', name: 'Wrist Curl', muscles: [primary('forearms')] },
  { slug: 'back-squat', name: 'Back Squat', muscles: [primary('quads'), secondary('glutes'), secondary('hamstrings'), secondary('lower-back')] },
  { slug: 'front-squat', name: 'Front Squat', muscles: [primary('quads'), secondary('glutes'), secondary('abs')] },
  { slug: 'romanian-deadlift', name: 'Romanian Deadlift', muscles: [primary('hamstrings'), secondary('glutes'), secondary('lower-back')] },
  { slug: 'conventional-deadlift', name: 'Conventional Deadlift', muscles: [primary('lower-back'), secondary('glutes'), secondary('hamstrings'), secondary('upper-back'), secondary('forearms')] },
  { slug: 'walking-lunge', name: 'Walking Lunge', muscles: [primary('glutes'), secondary('quads'), secondary('hamstrings')] },
  { slug: 'hip-thrust', name: 'Hip Thrust', muscles: [primary('glutes'), secondary('hamstrings')] },
  { slug: 'leg-extension', name: 'Leg Extension', muscles: [primary('quads')] },
  { slug: 'leg-curl', name: 'Leg Curl', muscles: [primary('hamstrings')] },
  { slug: 'standing-calf-raise', name: 'Standing Calf Raise', muscles: [primary('calves')] },
  { slug: 'seated-calf-raise', name: 'Seated Calf Raise', muscles: [primary('calves')] },
  { slug: 'plank', name: 'Plank', muscles: [primary('abs'), secondary('obliques')] },
  { slug: 'cable-crunch', name: 'Cable Crunch', muscles: [primary('abs')] },
  { slug: 'side-plank', name: 'Side Plank', muscles: [primary('obliques'), secondary('abs')] },
  { slug: 'pallof-press', name: 'Pallof Press', muscles: [primary('obliques'), secondary('abs')] },
  { slug: 'good-morning', name: 'Good Morning', muscles: [primary('lower-back'), secondary('hamstrings'), secondary('glutes')] },
  { slug: 'reverse-fly', name: 'Reverse Fly', muscles: [primary('upper-back'), secondary('shoulders')] },
];
