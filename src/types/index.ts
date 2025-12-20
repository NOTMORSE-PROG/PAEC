// User Types
export interface User {
  id: string
  email: string
  fullName: string
  role: 'student' | 'admin'
  createdAt: Date
  updatedAt: Date
}

export interface UserProfile extends User {
  phone?: string
  location?: string
  organization?: string
  bio?: string
  avatarUrl?: string
}

// Training Types
export interface TrainingSession {
  id: string
  userId: string
  trainingType: 'scenario' | 'readback' | 'jumbled' | 'pronunciation'
  startedAt: Date
  endedAt?: Date
}

export interface TrainingResult {
  id: string
  sessionId: string
  userId: string
  trainingType: 'scenario' | 'readback' | 'jumbled' | 'pronunciation'
  studentResponse: string
  detectedErrors: DetectedError[]
  score: number
  accuracy: number
  timestamp: Date
}

export interface DetectedError {
  type: string
  description: string
  correction: string
  position?: number
}

// Scenario Types
export interface Scenario {
  id: number
  callSign: string
  aircraftType: string
  flightPhase: string
  weather: string
  atcClearance: string
  correctResponse: string
  hints: string[]
}

// Readback Types
export interface ReadbackExercise {
  id: number
  atcInstruction: string
  pilotReadback: string
  errors: ReadbackError[]
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface ReadbackError {
  type: string
  original: string
  incorrect: string
  correct: string
}

// Jumbled Types
export interface JumbledExercise {
  id: number
  instruction: string
  correctOrder: string[]
  jumbledWords: string[]
  category: string
}

// Pronunciation Types
export interface PronunciationExercise {
  id: number
  type: 'number' | 'letter' | 'term'
  display: string
  correctPronunciation: string
  options: string[]
  audioHint: string
}

// Analysis Types
export interface AnalysisSession {
  id: string
  userId: string
  corpusType: 'APP/DEP' | 'GND' | 'RAMP'
  uploadedText: string
  createdAt: Date
}

export interface AnalysisResult {
  id: string
  analysisId: string
  corpusType: string
  totalWords: number
  totalExchanges: number
  nonStandardFreq: number
  clarificationCount: number
  languageErrors: ErrorCategory[]
  numberErrors: ErrorCategory[]
  riskLevel: 'low' | 'medium' | 'high'
}

export interface ErrorCategory {
  type: string
  count: number
  percentage: number
}

// Statistics Types
export interface UserStatistics {
  id: string
  userId: string
  trainingType: 'scenario' | 'readback' | 'jumbled' | 'pronunciation'
  totalExercises: number
  averageScore: number
  commonErrors: CommonError[]
  lastUpdated: Date
}

export interface CommonError {
  type: string
  count: number
  lastOccurred: Date
}

// Dashboard Types
export interface DashboardStats {
  totalExercises: number
  averageScore: number
  totalTimeMinutes: number
  streakDays: number
  improvement: number
  achievements: Achievement[]
}

export interface Achievement {
  id: string
  name: string
  description: string
  earnedAt?: Date
  progress?: number
  total?: number
}

// Module Stats
export interface ModuleStats {
  id: string
  name: string
  avgScore: number
  exercises: number
  bestScore: number
  improvement: number
  progress: number
}

// Activity Types
export interface ActivityLog {
  id: string
  userId: string
  action: string
  details: Record<string, any>
  timestamp: Date
}

export interface RecentActivity {
  id: number
  type: string
  score: number | null
  time: string
  status: 'completed' | 'analyzed' | 'in_progress'
}

// Feedback Types
export interface TrainingFeedback {
  correct: boolean
  score: number
  corrections: string[]
  suggestion: string
  tip?: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
