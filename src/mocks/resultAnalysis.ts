import { getDuelPreparation } from '@/mocks/duelPreparation'
import type {
  NegotiationResultAnalysis,
  NegotiationSession,
} from '@/types/negotiation'

function userQuotes(session: NegotiationSession): string[] {
  return session.messages
    .filter((message) => message.speaker === 'user')
    .map((message) => message.text)
}

export function createMockResultAnalysis(
  session: NegotiationSession,
  outcome: 'victory' | 'defeat',
): NegotiationResultAnalysis {
  const preparation = getDuelPreparation(session.caseId)
  const quotes = userQuotes(session)
  const firstQuote = quotes[0] ?? 'Давайте сначала уточним интересы обеих сторон.'
  const lastQuote = quotes.at(-1) ?? 'Предлагаю зафиксировать конкретные следующие шаги.'
  const goal = preparation?.goal ?? 'Найти рабочее решение и зафиксировать следующие шаги.'
  const planSteps = preparation?.steps ?? [
    'Выяснить позицию второй стороны',
    'Предложить взаимовыгодное решение',
    'Зафиксировать договорённость',
  ]

  return {
    agreement: {
      title: outcome === 'victory' ? 'Договорённость достигнута' : 'Решение требует доработки',
      points: preparation?.limits.slice(0, 3) ?? [
        'Стороны обозначили свои позиции',
        'Обсудили возможные условия',
        'Определили следующий шаг',
      ],
      tradeoff: outcome === 'victory'
        ? 'Стороны сохранили ключевые интересы и нашли пространство для компромисса.'
        : 'Предложение прозвучало, но встречные условия остались недостаточно конкретными.',
      nextStep: outcome === 'victory'
        ? 'Вернуться к договорённости в согласованный срок и сверить результат.'
        : 'Уточнить критерии второй стороны и повторно обсудить условия.',
    },
    judges: [
      {
        name: 'Нанимающий на работу',
        question: 'Пошёл бы я работать к этому человеку?',
        criterion: 'Надёжность',
        verdict: 'user',
        quote: firstQuote,
        observation: 'Вы обозначили понятную рамку разговора и предложили двигаться по шагам.',
        effect: 'Разговор сохранил конструктивный тон.',
        comparison: 'Ваша позиция звучала яснее и спокойнее позиции оппонента.',
      },
      {
        name: 'Отправляющий на переговоры',
        question: 'Кого я отправлю вместо себя на сложные переговоры?',
        criterion: 'Движение к цели',
        verdict: 'user',
        quote: lastQuote,
        observation: 'Вы возвращали обсуждение к цели и искали применимое решение.',
        effect: 'Стороны приблизились к конкретным следующим шагам.',
        comparison: 'Вы чаще связывали аргументы с целью переговоров.',
      },
      {
        name: 'Доверяющий собственность',
        question: 'Кому я доверю значимый ресурс?',
        criterion: 'Управление рисками',
        verdict: 'opponent',
        quote: outcome === 'victory'
          ? 'Давайте отдельно проверим условия и критерии результата.'
          : 'Мне нужны более конкретные гарантии и критерии результата.',
        observation: 'Не все ограничения и контрольные точки были проговорены до конца.',
        effect: 'В договорённости осталось пространство для разных трактовок.',
        comparison: 'Оппонент внимательнее удерживал риски и возможные ограничения.',
      },
    ],
    coachSummary: `Целью было: ${goal} Вы вели разговор конструктивно, но часть критериев второй стороны стоило раскрыть подробнее.`,
    worked: [
      {
        quote: firstQuote,
        action: 'Задали рабочую рамку и обозначили предмет разговора.',
        change: 'Диалог стал более предметным.',
        consequence: 'Оппонент включился в обсуждение условий.',
      },
      {
        quote: lastQuote,
        action: 'Вернули разговор к конкретному следующему шагу.',
        change: 'Снизили уровень неопределённости.',
        consequence: 'Появилась основа для продолжения переговоров.',
      },
    ],
    hindered: [
      {
        quote: 'Можно согласиться на эти условия.',
        action: 'Уступка прозвучала до фиксации встречного обязательства.',
        change: 'Переговорная позиция стала слабее.',
        consequence: 'Часть ценности осталась у второй стороны.',
      },
      {
        quote: 'Думаю, мы сможем вернуться к этому позже.',
        action: 'Срок и критерий следующего обсуждения остались размытыми.',
        change: 'Решение стало сложнее проверить.',
        consequence: 'Договорённость можно истолковать по-разному.',
      },
    ],
    planComparison: planSteps.slice(0, 3).map((plan, index) => ({
      plan,
      reality: index === 0
        ? 'Вы начали с уточнения позиции и контекста второй стороны.'
        : index === 1
          ? 'По ходу разговора адаптировали аргументы под ответ оппонента.'
          : 'Обозначили следующий шаг, но не все критерии зафиксировали явно.',
      status: index === 0 ? 'followed' : index === 1 ? 'adapted' : 'unused',
    })),
  }
}
