export type CaseCategory = 'Все' | 'Карьера' | 'Управление' | 'Конфликты' | 'Продажи'

export type CaseAccent = 'violet' | 'lime' | 'orange' | 'blue' | 'pink' | 'mint'
export type CaseIcon = 'wallet' | 'people' | 'clock' | 'receipt' | 'tag' | 'dialogue'

export interface TrainingCase {
  id: string
  title: string
  description: string
  synopsis: string
  category: string
  duration: string
  difficulty: 'Легко' | 'Средне' | 'Сложно'
  opponent: string
  roles: [string, string]
  roleSummaries: [string, string]
  accent: CaseAccent
  icon: CaseIcon
}

export interface TrainingHistoryItem {
  caseTitle: string
  date: string
  score: number
  change: number
}
