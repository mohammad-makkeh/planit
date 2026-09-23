export type MovementType = 'push' | 'pull' | 'static'

export type SeedEquipment = { name: string; imageUrl: string; isFallback: boolean }

export const EQUIPMENT: SeedEquipment[] = [
  { name: 'Any', imageUrl: '/equipment/any.svg', isFallback: true },
  { name: 'Barbell', imageUrl: '/equipment/barbell.svg', isFallback: false },
  { name: 'Dumbbell', imageUrl: '/equipment/dumbbell.svg', isFallback: false },
  { name: 'Kettlebell', imageUrl: '/equipment/kettlebell.svg', isFallback: false },
  { name: 'Cable', imageUrl: '/equipment/cable.svg', isFallback: false },
  { name: 'Machine', imageUrl: '/equipment/machine.svg', isFallback: false },
  { name: 'Bodyweight', imageUrl: '/equipment/bodyweight.svg', isFallback: false },
  { name: 'Resistance band', imageUrl: '/equipment/band.svg', isFallback: false },
  { name: 'EZ bar', imageUrl: '/equipment/ez-bar.svg', isFallback: false },
  { name: 'Smith machine', imageUrl: '/equipment/smith-machine.svg', isFallback: false },
]

/** `muscles` are names from the global catalog seeded by migration 0003 (`data/muscles.json`). */
export type SeedExercise = { name: string; muscles: string[]; movementType: MovementType }

export const SEED_EXERCISES: SeedExercise[] = [
  // From the digitized 5-day plan
  { name: 'Leg curl (seated or lying)', muscles: ['Hamstrings'], movementType: 'static' },
  { name: 'Hack squat', muscles: ['Quads', 'Glutes'], movementType: 'static' },
  { name: 'Sumo squat', muscles: ['Quads', 'Glutes'], movementType: 'static' },
  { name: 'Leg press', muscles: ['Quads', 'Glutes'], movementType: 'static' },
  { name: 'Leg extension', muscles: ['Quads'], movementType: 'static' },
  { name: 'Lying leg raises', muscles: ['Abs'], movementType: 'static' },
  { name: 'Standing calf raise', muscles: ['Calves'], movementType: 'static' },
  { name: 'Squat', muscles: ['Quads', 'Glutes'], movementType: 'static' },
  { name: 'Walking lunges', muscles: ['Quads', 'Glutes'], movementType: 'static' },
  { name: 'Single leg hip thrust', muscles: ['Glutes', 'Hamstrings'], movementType: 'static' },
  { name: 'Sit ups', muscles: ['Abs'], movementType: 'static' },
  { name: 'Plank', muscles: ['Abs', 'Obliques'], movementType: 'static' },
  { name: 'Incline smith machine press', muscles: ['Upper Chest', 'Front Shoulder'], movementType: 'push' },
  { name: 'Incline cable fly', muscles: ['Upper Chest'], movementType: 'push' },
  { name: 'Machine fly', muscles: ['Middle Chest'], movementType: 'push' },
  { name: 'Dumbbell press soft decline', muscles: ['Lower Chest', 'Triceps'], movementType: 'push' },
  { name: 'Shoulder dumbbell press', muscles: ['Front Shoulder', 'Triceps'], movementType: 'push' },
  { name: 'Shoulder machine press', muscles: ['Front Shoulder', 'Triceps'], movementType: 'push' },
  { name: 'Lateral raises', muscles: ['Side Shoulder'], movementType: 'static' },
  { name: 'Incline dumbbell Y raise', muscles: ['Side Shoulder', 'Upper Back'], movementType: 'static' },
  { name: 'Front rope raise', muscles: ['Front Shoulder'], movementType: 'static' },
  { name: 'Incline dumbbell curl', muscles: ['Biceps'], movementType: 'static' },
  { name: 'Reverse barbell curl', muscles: ['Biceps', 'Forearms'], movementType: 'static' },
  { name: 'Preacher curl machine', muscles: ['Biceps'], movementType: 'pull' },
  { name: 'Rope overhead extension', muscles: ['Triceps'], movementType: 'push' },
  { name: 'Single arm push down', muscles: ['Triceps'], movementType: 'push' },
  { name: 'V-bar push down', muscles: ['Triceps'], movementType: 'push' },
  { name: 'Upper abs plated', muscles: ['Abs'], movementType: 'static' },
  { name: 'T-bar row wide grip', muscles: ['Upper Back', 'Lats'], movementType: 'pull' },
  { name: 'Seated row narrow grip', muscles: ['Lats', 'Upper Back'], movementType: 'pull' },
  { name: 'Lat pull down wide grip', muscles: ['Lats'], movementType: 'pull' },
  { name: 'Seated face pull', muscles: ['Rear Shoulder', 'Upper Back'], movementType: 'pull' },
  { name: 'Incline dumbbell shrug row', muscles: ['Upper Back'], movementType: 'pull' },
  { name: 'Hyperextension weighted', muscles: ['Lower Back', 'Glutes'], movementType: 'static' },
  // Common staples
  { name: 'Bench press', muscles: ['Middle Chest', 'Triceps', 'Front Shoulder'], movementType: 'push' },
  { name: 'Deadlift', muscles: ['Lower Back', 'Glutes', 'Hamstrings'], movementType: 'pull' },
  { name: 'Romanian deadlift', muscles: ['Hamstrings', 'Glutes'], movementType: 'pull' },
  { name: 'Pull ups', muscles: ['Lats', 'Biceps'], movementType: 'pull' },
  { name: 'Barbell curl', muscles: ['Biceps'], movementType: 'static' },
  { name: 'Overhead press', muscles: ['Front Shoulder', 'Triceps'], movementType: 'push' },
  { name: 'Dips', muscles: ['Lower Chest', 'Triceps'], movementType: 'push' },
  { name: 'Cable crunch', muscles: ['Abs'], movementType: 'static' },
]

export const SEED_WARMUPS: string[] = [
  'Body weight squats 2 sets x 10',
  'Hip airplanes 2x12',
  'Reverse snow angels (scapular retraction)',
  'Hip mobility drills, dynamic stretches',
  'Band shoulder dislocates 10 rep x 3',
  'Face pulls 2x20 / light DB lateral raises',
  'Dynamic stretch (arm circles forward and backward)',
  'Dead hang',
  'Scap pull-ups 2x12',
  'Band pull aparts 2x20',
  'Cat cow stretch',
  'Cobra stretch',
  'Jefferson curl 10kg',
  'Plank 1 min constant',
]
