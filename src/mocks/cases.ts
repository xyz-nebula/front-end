import type { CaseCategory, TrainingCase, TrainingHistoryItem } from '@/types/case'

export const caseCategories: CaseCategory[] = ['Все', 'Карьера', 'Управление', 'Конфликты', 'Продажи']

export const trainingCases: TrainingCase[] = [
  {
    id: 'salary-review',
    title: 'Повышение зарплаты',
    description: 'Аргументируй свою ценность и договорись о новых условиях с руководителем.',
    category: 'Карьера',
    duration: '10–15 мин',
    difficulty: 'Средне',
    opponent: 'Анна, руководитель',
    accent: 'violet',
    icon: 'wallet',
  },
  {
    id: 'difficult-employee',
    title: 'Сложный сотрудник',
    description: 'Дай честную обратную связь, сохранив доверие и рабочий настрой.',
    category: 'Управление',
    duration: '12–15 мин',
    difficulty: 'Сложно',
    opponent: 'Максим, сотрудник',
    accent: 'lime',
    icon: 'people',
  },
  {
    id: 'missed-deadline',
    title: 'Срыв дедлайна',
    description: 'Обсуди последствия задержки и найди реалистичный план восстановления.',
    category: 'Управление',
    duration: '8–12 мин',
    difficulty: 'Средне',
    opponent: 'Илья, подрядчик',
    accent: 'orange',
    icon: 'clock',
  },
  {
    id: 'refund',
    title: 'Возврат денег',
    description: 'Добейся справедливого решения в разговоре с непреклонным менеджером.',
    category: 'Конфликты',
    duration: '7–10 мин',
    difficulty: 'Легко',
    opponent: 'Олег, менеджер',
    accent: 'blue',
    icon: 'receipt',
  },
  {
    id: 'price-talks',
    title: 'Переговоры о цене',
    description: 'Защити маржу и найди обмен условиями вместо прямой скидки.',
    category: 'Продажи',
    duration: '10–12 мин',
    difficulty: 'Сложно',
    opponent: 'Елена, закупщик',
    accent: 'pink',
    icon: 'tag',
  },
  {
    id: 'team-conflict',
    title: 'Конфликт в команде',
    description: 'Сними напряжение между коллегами и верни разговор к общей задаче.',
    category: 'Конфликты',
    duration: '12–15 мин',
    difficulty: 'Средне',
    opponent: 'Двое коллег',
    accent: 'mint',
    icon: 'dialogue',
  },
]

export const recentTrainings: TrainingHistoryItem[] = [
  { caseTitle: 'Повышение зарплаты', date: 'Сегодня, 10:24', score: 78, change: 6 },
  { caseTitle: 'Возврат денег', date: '5 сентября', score: 71, change: 4 },
  { caseTitle: 'Срыв дедлайна', date: '2 сентября', score: 67, change: 0 },
]
