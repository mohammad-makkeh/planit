export const TAG_NAMES = [
  'chest', 'back', 'shoulders', 'legs', 'glutes', 'arms',
  'biceps', 'triceps', 'core', 'calves',
] as const

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

export type SeedExercise = { name: string; tags: string[]; movementType: MovementType }

export const SEED_EXERCISES: SeedExercise[] = [
  // From the digitized 5-day plan
  { name: 'Leg curl (seated or lying)', tags: ['legs'], movementType: 'static' },
  { name: 'Hack squat', tags: ['legs'], movementType: 'static' },
  { name: 'Sumo squat', tags: ['legs', 'glutes'], movementType: 'static' },
  { name: 'Leg press', tags: ['legs'], movementType: 'static' },
  { name: 'Leg extension', tags: ['legs'], movementType: 'static' },
  { name: 'Lying leg raises', tags: ['core'], movementType: 'static' },
  { name: 'Standing calf raise', tags: ['calves', 'legs'], movementType: 'static' },
  { name: 'Squat', tags: ['legs', 'glutes'], movementType: 'static' },
  { name: 'Walking lunges', tags: ['legs', 'glutes'], movementType: 'static' },
  { name: 'Single leg hip thrust', tags: ['glutes', 'legs'], movementType: 'static' },
  { name: 'Sit ups', tags: ['core'], movementType: 'static' },
  { name: 'Plank', tags: ['core'], movementType: 'static' },
  { name: 'Incline smith machine press', tags: ['chest'], movementType: 'push' },
  { name: 'Incline cable fly', tags: ['chest'], movementType: 'push' },
  { name: 'Machine fly', tags: ['chest'], movementType: 'push' },
  { name: 'Dumbbell press soft decline', tags: ['chest'], movementType: 'push' },
  { name: 'Shoulder dumbbell press', tags: ['shoulders'], movementType: 'push' },
  { name: 'Shoulder machine press', tags: ['shoulders'], movementType: 'push' },
  { name: 'Lateral raises', tags: ['shoulders'], movementType: 'static' },
  { name: 'Incline dumbbell Y raise', tags: ['shoulders'], movementType: 'static' },
  { name: 'Front rope raise', tags: ['shoulders'], movementType: 'static' },
  { name: 'Incline dumbbell curl', tags: ['biceps', 'arms'], movementType: 'static' },
  { name: 'Reverse barbell curl', tags: ['biceps', 'arms'], movementType: 'static' },
  { name: 'Preacher curl machine', tags: ['biceps', 'arms'], movementType: 'pull' },
  { name: 'Rope overhead extension', tags: ['triceps', 'arms'], movementType: 'push' },
  { name: 'Single arm push down', tags: ['triceps', 'arms'], movementType: 'push' },
  { name: 'V-bar push down', tags: ['triceps', 'arms'], movementType: 'push' },
  { name: 'Upper abs plated', tags: ['core'], movementType: 'static' },
  { name: 'T-bar row wide grip', tags: ['back'], movementType: 'pull' },
  { name: 'Seated row narrow grip', tags: ['back'], movementType: 'pull' },
  { name: 'Lat pull down wide grip', tags: ['back'], movementType: 'pull' },
  { name: 'Seated face pull', tags: ['shoulders', 'back'], movementType: 'pull' },
  { name: 'Incline dumbbell shrug row', tags: ['back'], movementType: 'pull' },
  { name: 'Hyperextension weighted', tags: ['back', 'glutes'], movementType: 'static' },
  // Common staples
  { name: 'Bench press', tags: ['chest'], movementType: 'push' },
  { name: 'Deadlift', tags: ['back', 'legs'], movementType: 'pull' },
  { name: 'Romanian deadlift', tags: ['legs', 'glutes'], movementType: 'pull' },
  { name: 'Pull ups', tags: ['back'], movementType: 'pull' },
  { name: 'Barbell curl', tags: ['biceps', 'arms'], movementType: 'static' },
  { name: 'Overhead press', tags: ['shoulders'], movementType: 'push' },
  { name: 'Dips', tags: ['chest', 'triceps'], movementType: 'push' },
  { name: 'Cable crunch', tags: ['core'], movementType: 'static' },
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
