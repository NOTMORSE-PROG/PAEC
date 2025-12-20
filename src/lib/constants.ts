// Training Module Types
export const TRAINING_MODULES = {
  SCENARIO: 'scenario',
  READBACK: 'readback',
  JUMBLED: 'jumbled',
  PRONUNCIATION: 'pronunciation',
} as const

export type TrainingModuleType = typeof TRAINING_MODULES[keyof typeof TRAINING_MODULES]

// Corpus Categories
export const CORPUS_CATEGORIES = {
  APP_DEP: 'APP/DEP',
  GND: 'GND',
  RAMP: 'RAMP',
} as const

export type CorpusCategoryType = typeof CORPUS_CATEGORIES[keyof typeof CORPUS_CATEGORIES]

// User Roles
export const USER_ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
} as const

export type UserRoleType = typeof USER_ROLES[keyof typeof USER_ROLES]

// Error Types
export const ERROR_TYPES = {
  LANGUAGE_BASED: 'language_based',
  NUMBER_RELATED: 'number_related',
} as const

// ICAO Number Pronunciations
export const ICAO_NUMBERS: Record<string, string> = {
  '0': 'ZERO',
  '1': 'WUN',
  '2': 'TOO',
  '3': 'TREE',
  '4': 'FOW-ER',
  '5': 'FIFE',
  '6': 'SIX',
  '7': 'SEV-EN',
  '8': 'AIT',
  '9': 'NIN-ER',
}

// NATO Phonetic Alphabet
export const NATO_ALPHABET: Record<string, string> = {
  A: 'ALFA',
  B: 'BRAVO',
  C: 'CHARLIE',
  D: 'DELTA',
  E: 'ECHO',
  F: 'FOXTROT',
  G: 'GOLF',
  H: 'HOTEL',
  I: 'INDIA',
  J: 'JULIETT',
  K: 'KILO',
  L: 'LIMA',
  M: 'MIKE',
  N: 'NOVEMBER',
  O: 'OSCAR',
  P: 'PAPA',
  Q: 'QUEBEC',
  R: 'ROMEO',
  S: 'SIERRA',
  T: 'TANGO',
  U: 'UNIFORM',
  V: 'VICTOR',
  W: 'WHISKEY',
  X: 'X-RAY',
  Y: 'YANKEE',
  Z: 'ZULU',
}

// Training module configuration
export const TRAINING_MODULE_CONFIG = {
  [TRAINING_MODULES.SCENARIO]: {
    id: 'scenario',
    title: 'Scenario-Based Simulation',
    shortTitle: 'Scenario Simulation',
    description: 'Practice responding to ATC clearances in realistic flight scenarios',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    difficulty: 'Intermediate',
  },
  [TRAINING_MODULES.READBACK]: {
    id: 'readback',
    title: 'Readback/Hearback Correction',
    shortTitle: 'Readback Correction',
    description: 'Identify and correct errors in pilot readbacks to ATC instructions',
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    difficulty: 'Advanced',
  },
  [TRAINING_MODULES.JUMBLED]: {
    id: 'jumbled',
    title: 'Jumbled Clearance',
    shortTitle: 'Jumbled Clearance',
    description: 'Arrange mixed-order clearance words into correct phraseology',
    color: 'from-violet-500 to-pink-500',
    bgColor: 'bg-violet-50',
    difficulty: 'Beginner',
  },
  [TRAINING_MODULES.PRONUNCIATION]: {
    id: 'pronunciation',
    title: 'Radiotelephony Pronunciation Drill',
    shortTitle: 'Pronunciation Drill',
    description: 'Master ICAO standard pronunciation for numbers and aviation terms',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    difficulty: 'Beginner',
  },
} as const

// Corpus configuration
export const CORPUS_CONFIG = {
  [CORPUS_CATEGORIES.APP_DEP]: {
    id: 'APP/DEP',
    name: 'Approach/Departure Control',
    shortName: 'APP/DEP',
    description: 'Communications between pilots and approach/departure control',
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
  },
  [CORPUS_CATEGORIES.GND]: {
    id: 'GND',
    name: 'Ground Control',
    shortName: 'GND',
    description: 'Ground movement communications including taxi instructions',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
  },
  [CORPUS_CATEGORIES.RAMP]: {
    id: 'RAMP',
    name: 'Ramp Control',
    shortName: 'RAMP',
    description: 'Ramp and apron communications for parking and push-back',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
  },
} as const

// Navigation items
export const MAIN_NAVIGATION = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Training Mode', href: '/dashboard/training' },
  { name: 'Analysis Mode', href: '/dashboard/analysis' },
  { name: 'Score Dashboard', href: '/dashboard/scores' },
] as const

export const USER_NAVIGATION = [
  { name: 'Your Profile', href: '/dashboard/profile' },
  { name: 'Settings', href: '/dashboard/settings' },
] as const
