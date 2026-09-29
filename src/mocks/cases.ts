import type { CaseCategory, TrainingCase, TrainingHistoryItem } from '@/types/case'
import { getCasePresentation } from '@/features/cases/casePresentation'

function defineTrainingCase(
  item: Omit<TrainingCase, 'duration' | 'presentation'>,
): TrainingCase {
  return {
    ...item,
    duration: `${Math.ceil(item.timeLimitSeconds / 60)} мин`,
    presentation: getCasePresentation(item),
  }
}

export const caseCategories: CaseCategory[] = ['Все', 'Карьера', 'Управление', 'Конфликты', 'Продажи']

export const trainingCases: TrainingCase[] = [
  defineTrainingCase({
    id: 'salary-review',
    title: 'Повышение зарплаты',
    description: 'Аргументируй свою ценность и договорись о новых условиях с руководителем.',
    goal: 'Договориться о пересмотре зарплаты на основе результатов и новых обязанностей.',
    synopsis: 'Вы считаете, что ваши результаты и выросшая ответственность заслуживают пересмотра зарплаты. Руководитель ценит ваш вклад, но бюджет команды ограничен и решение потребует убедительных аргументов.',
    category: 'Карьера',
    timeLimitSeconds: 15 * 60,
    difficulty: 'moderate',
    opponent: 'Анна, руководитель',
    roles: ['Сотрудник', 'Руководитель'],
  }),
  defineTrainingCase({
    id: 'difficult-employee',
    title: 'Сложный сотрудник',
    description: 'Дай честную обратную связь, сохранив доверие и рабочий настрой.',
    goal: 'Согласовать понятный план улучшения работы, сохранив доверие.',
    synopsis: 'Работа сотрудника стала менее предсказуемой: задачи задерживаются, а обратная связь вызывает защитную реакцию. Обсудите конкретные примеры, выясните причины и договоритесь о понятных следующих шагах.',
    category: 'Управление',
    timeLimitSeconds: 15 * 60,
    difficulty: 'hard',
    opponent: 'Максим, сотрудник',
    roles: ['Руководитель', 'Сотрудник'],
  }),
  defineTrainingCase({
    id: 'missed-deadline',
    title: 'Срыв дедлайна',
    description: 'Обсуди последствия задержки и найди реалистичный план восстановления.',
    goal: 'Получить реалистичный срок и план восстановления проекта.',
    synopsis: 'Важный срок сорван, и это влияет на работу всей команды. Причины задержки и новый реалистичный план пока не согласованы.',
    category: 'Управление',
    timeLimitSeconds: 12 * 60,
    difficulty: 'moderate',
    opponent: 'Илья, подрядчик',
    roles: ['Заказчик', 'Подрядчик'],
  }),
  defineTrainingCase({
    id: 'refund',
    title: 'Возврат денег',
    description: 'Добейся справедливого решения в разговоре с непреклонным менеджером.',
    goal: 'Договориться о возврате денег или равнозначном решении.',
    synopsis: 'Купленный продукт не оправдал ожиданий, но менеджер не спешит подтверждать возврат. Сформулируйте факты и желаемое решение, сохраняя спокойный тон.',
    category: 'Конфликты',
    timeLimitSeconds: 10 * 60,
    difficulty: 'easy',
    opponent: 'Олег, менеджер',
    roles: ['Покупатель', 'Менеджер'],
  }),
  defineTrainingCase({
    id: 'price-talks',
    title: 'Переговоры о цене',
    description: 'Защити маржу и найди обмен условиями вместо прямой скидки.',
    goal: 'Сохранить маржу и договориться об обмене условиями.',
    synopsis: 'Покупатель просит дополнительную скидку, которая заметно сократит маржу сделки. Найдите обмен условиями вместо уступки без компенсации.',
    category: 'Продажи',
    timeLimitSeconds: 12 * 60,
    difficulty: 'hard',
    opponent: 'Елена, закупщик',
    roles: ['Продавец', 'Закупщик'],
  }),
  defineTrainingCase({
    id: 'team-conflict',
    title: 'Конфликт в команде',
    description: 'Сними напряжение между коллегами и верни разговор к общей задаче.',
    goal: 'Снизить напряжение и согласовать общую задачу команды.',
    synopsis: 'Между коллегами накопилось напряжение, и рабочее обсуждение быстро переходит в взаимные претензии. Отделите факты от эмоций и вернитесь к общей задаче.',
    category: 'Конфликты',
    timeLimitSeconds: 15 * 60,
    difficulty: 'moderate',
    opponent: 'Двое коллег',
    roles: ['Тимлид', 'Сотрудник'],
  }),
]

export const recentTrainings: TrainingHistoryItem[] = [
  { caseTitle: 'Повышение зарплаты', date: 'Сегодня, 10:24', score: 78, change: 6 },
  { caseTitle: 'Возврат денег', date: '5 сентября', score: 71, change: 4 },
  { caseTitle: 'Срыв дедлайна', date: '2 сентября', score: 67, change: 0 },
]
