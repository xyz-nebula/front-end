export type CaseCategory = 'Все' | 'Карьера' | 'Управление' | 'Конфликты' | 'Продажи'

export interface TrainingCase {
  id: string
  title: string
  description: string
  category: Exclude<CaseCategory, 'Все'>
  duration: string
  difficulty: 'Легко' | 'Средне' | 'Сложно'
  opponent: string
  accent: 'violet' | 'lime' | 'orange' | 'blue' | 'pink' | 'mint'
  icon: 'wallet' | 'people' | 'clock' | 'receipt' | 'tag' | 'dialogue'
}

export interface TrainingHistoryItem {
  caseTitle: string
  date: string
  score: number
  change: number
}
