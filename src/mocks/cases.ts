import type { CaseCategory, TrainingCase, TrainingHistoryItem } from '@/types/case'

function defineTrainingCase(
  item: Omit<TrainingCase, 'duration'>,
): TrainingCase {
  return {
    ...item,
    duration: `${Math.ceil(item.timeLimitSeconds / 60)} мин`,
  }
}

export const caseCategories: CaseCategory[] = ['Все', 'Карьера', 'Управление', 'Конфликты', 'Продажи']

export const trainingCases: TrainingCase[] = [
  defineTrainingCase({
    id: 'salary-review',
    title: 'Повышение зарплаты',
    description: 'Аргументируй свою ценность и договорись о новых условиях с руководителем.',
    synopsis: 'Вы считаете, что ваши результаты и выросшая ответственность заслуживают пересмотра зарплаты. Руководитель ценит ваш вклад, но бюджет команды ограничен и решение потребует убедительных аргументов.',
    category: 'Карьера',
    timeLimitSeconds: 15 * 60,
    difficulty: 'Средне',
    opponent: 'Анна, руководитель',
    roles: ['Сотрудник', 'Руководитель'],
    roleSummaries: ['Добивается пересмотра условий и готов подтвердить свой вклад.', 'Отвечает за бюджет команды и принимает решение о повышении.'],
    accent: 'violet',
    icon: 'wallet',
  }),
  defineTrainingCase({
    id: 'difficult-employee',
    title: 'Сложный сотрудник',
    description: 'Дай честную обратную связь, сохранив доверие и рабочий настрой.',
    synopsis: 'Работа сотрудника стала менее предсказуемой: задачи задерживаются, а обратная связь вызывает защитную реакцию. Обсудите конкретные примеры, выясните причины и договоритесь о понятных следующих шагах.',
    category: 'Управление',
    timeLimitSeconds: 15 * 60,
    difficulty: 'Сложно',
    opponent: 'Максим, сотрудник',
    roles: ['Руководитель', 'Сотрудник'],
    roleSummaries: ['Хочет сохранить доверие и вернуть результативную работу.', 'Объясняет свою позицию и ожидания от руководителя.'],
    accent: 'lime',
    icon: 'people',
  }),
  defineTrainingCase({
    id: 'missed-deadline',
    title: 'Срыв дедлайна',
    description: 'Обсуди последствия задержки и найди реалистичный план восстановления.',
    synopsis: 'Важный срок сорван, и это влияет на работу всей команды. Причины задержки и новый реалистичный план пока не согласованы.',
    category: 'Управление',
    timeLimitSeconds: 12 * 60,
    difficulty: 'Средне',
    opponent: 'Илья, подрядчик',
    roles: ['Заказчик', 'Подрядчик'],
    roleSummaries: ['Отвечает за общий срок и хочет восстановить контроль над проектом.', 'Объясняет задержку и предлагает план завершения работы.'],
    accent: 'orange',
    icon: 'clock',
  }),
  defineTrainingCase({
    id: 'refund',
    title: 'Возврат денег',
    description: 'Добейся справедливого решения в разговоре с непреклонным менеджером.',
    synopsis: 'Купленный продукт не оправдал ожиданий, но менеджер не спешит подтверждать возврат. Сформулируйте факты и желаемое решение, сохраняя спокойный тон.',
    category: 'Конфликты',
    timeLimitSeconds: 10 * 60,
    difficulty: 'Легко',
    opponent: 'Олег, менеджер',
    roles: ['Покупатель', 'Менеджер'],
    roleSummaries: ['Добивается справедливого возврата денег.', 'Проверяет условия возврата и защищает интересы компании.'],
    accent: 'blue',
    icon: 'receipt',
  }),
  defineTrainingCase({
    id: 'price-talks',
    title: 'Переговоры о цене',
    description: 'Защити маржу и найди обмен условиями вместо прямой скидки.',
    synopsis: 'Покупатель просит дополнительную скидку, которая заметно сократит маржу сделки. Найдите обмен условиями вместо уступки без компенсации.',
    category: 'Продажи',
    timeLimitSeconds: 12 * 60,
    difficulty: 'Сложно',
    opponent: 'Елена, закупщик',
    roles: ['Продавец', 'Закупщик'],
    roleSummaries: ['Сохраняет ценность предложения и маржу.', 'Ищет лучшие условия для своей компании.'],
    accent: 'pink',
    icon: 'tag',
  }),
  defineTrainingCase({
    id: 'team-conflict',
    title: 'Конфликт в команде',
    description: 'Сними напряжение между коллегами и верни разговор к общей задаче.',
    synopsis: 'Между коллегами накопилось напряжение, и рабочее обсуждение быстро переходит в взаимные претензии. Отделите факты от эмоций и вернитесь к общей задаче.',
    category: 'Конфликты',
    timeLimitSeconds: 15 * 60,
    difficulty: 'Средне',
    opponent: 'Двое коллег',
    roles: ['Тимлид', 'Сотрудник'],
    roleSummaries: ['Помогает команде договориться и продолжить работу.', 'Рассказывает о своих потребностях и причинах конфликта.'],
    accent: 'mint',
    icon: 'dialogue',
  }),
]

export const recentTrainings: TrainingHistoryItem[] = [
  { caseTitle: 'Повышение зарплаты', date: 'Сегодня, 10:24', score: 78, change: 6 },
  { caseTitle: 'Возврат денег', date: '5 сентября', score: 71, change: 4 },
  { caseTitle: 'Срыв дедлайна', date: '2 сентября', score: 67, change: 0 },
]
