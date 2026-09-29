export type CaseCategory = 'Все' | 'Карьера' | 'Управление' | 'Конфликты' | 'Продажи'

export type CaseAccent = 'violet' | 'lime' | 'orange' | 'blue' | 'pink' | 'mint'
export type CaseIcon = 'wallet' | 'people' | 'clock' | 'receipt' | 'tag' | 'dialogue'
export type CaseDifficulty = 'easy' | 'moderate' | 'hard' | 'insane'

export const caseDifficultyLabels: Record<CaseDifficulty, string> = {
  easy: 'Легко',
  moderate: 'Средне',
  hard: 'Сложно',
  insane: 'Экстремально',
}

export const caseDifficultyLevels: Record<CaseDifficulty, number> = {
  easy: 1,
  moderate: 2,
  hard: 3,
  insane: 4,
}

export interface CasePresentation {
  roleSummaries: [string, string]
  accent: CaseAccent
  icon: CaseIcon
  artwork?: string
}

export interface TrainingCase {
  id: string
  title: string
  description: string
  synopsis: string
  category: string
  duration: string
  timeLimitSeconds: number
  difficulty: CaseDifficulty
  opponent: string
  roles: [string, string]
  presentation: CasePresentation
}

export interface TrainingHistoryItem {
  caseTitle: string
  date: string
  score: number
  change: number
}
