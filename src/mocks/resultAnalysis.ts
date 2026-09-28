import { getDuelPreparation } from '@/mocks/duelPreparation'
import type { NegotiationEvidence, NegotiationOutcomeKind, NegotiationResult, NegotiationSession } from '@/types/negotiation'

type MockAnalysis = Pick<NegotiationResult, 'outcome' | 'judges' | 'trainer'>

function evidence(session: NegotiationSession, preferredIndex: number, fallback: string): NegotiationEvidence {
  const messageIndex = session.messages.length === 0 ? 0 : Math.min(preferredIndex, session.messages.length - 1)
  const message = session.messages[messageIndex]
  return { messageIndex, isAi: message?.speaker === 'ai', quote: message?.text ?? fallback }
}

export function createMockResultAnalysis(session: NegotiationSession, kind: NegotiationOutcomeKind): MockAnalysis {
  const preparation = getDuelPreparation(session.caseId)
  const first = evidence(session, 0, 'Давайте сначала уточним интересы обеих сторон.')
  const last = evidence(session, Math.max(0, session.messages.length - 1), 'Предлагаю зафиксировать конкретные следующие шаги.')
  const goal = preparation?.goal ?? 'Найти рабочее решение и зафиксировать следующие шаги.'
  const planSteps = preparation?.steps ?? [
    'Выяснить позицию второй стороны',
    'Предложить взаимовыгодное решение',
    'Зафиксировать договорённость',
  ]
  const successful = kind === 'agreement' || kind === 'partial-agreement'

  return {
    outcome: {
      status: 'ready',
      kind,
      summary: successful
        ? 'Вы удерживали фокус на интересах сторон и завершили разговор конкретными договорённостями.'
        : 'Вы обозначили позицию, но договорённости стоит подкреплять вопросами и конкретными условиями.',
      agreedTerms: preparation?.limits.slice(0, 3) ?? ['Стороны обозначили свои позиции', 'Обсудили возможные условия', 'Определили следующий шаг'],
      openPoints: successful ? [] : ['Критерии второй стороны', 'Измеримые условия результата'],
      nextStep: successful ? 'Вернуться к договорённости в согласованный срок и сверить результат.' : 'Уточнить критерии второй стороны и повторно обсудить условия.',
      evidence: [first, last],
    },
    judges: [
      { college: 'hiring', status: 'ready', verdict: { choice: 'user', criterion: 'Надёжность', evidence: first, observation: 'Вы обозначили понятную рамку разговора и предложили двигаться по шагам.', effect: 'Разговор сохранил конструктивный тон.', comparison: 'Ваша позиция звучала яснее и спокойнее позиции оппонента.' } },
      { college: 'negotiation', status: 'ready', verdict: { choice: 'user', criterion: 'Движение к цели', evidence: last, observation: 'Вы возвращали обсуждение к цели и искали применимое решение.', effect: 'Стороны приблизились к конкретным следующим шагам.', comparison: 'Вы чаще связывали аргументы с целью переговоров.' } },
      { college: 'ownership', status: 'ready', verdict: { choice: 'opponent', criterion: 'Управление рисками', evidence: last, observation: 'Не все ограничения и контрольные точки были проговорены до конца.', effect: 'В договорённости осталось пространство для разных трактовок.', comparison: 'Оппонент внимательнее удерживал риски и возможные ограничения.' } },
    ],
    trainer: {
      status: 'ready',
      feedback: {
        summary: `Целью было: ${goal} Вы вели разговор конструктивно, но часть критериев второй стороны стоило раскрыть подробнее.`,
        strengths: [{ evidence: first, action: 'Задали рабочую рамку и обозначили предмет разговора.', situationChange: 'Диалог стал более предметным.', consequence: 'Оппонент включился в обсуждение условий.' }],
        mistakes: [{ evidence: last, action: 'Уступка прозвучала до фиксации встречного обязательства.', situationChange: 'Переговорная позиция стала слабее.', consequence: 'Часть ценности осталась у второй стороны.' }],
        missedOpportunities: [{ evidence: last, action: 'Не уточнили критерий проверки результата.', situationChange: 'Следующий шаг остался недостаточно измеримым.', consequence: 'Договорённость можно истолковать по-разному.' }],
        nextTry: ['Перед следующим раундом подготовьте три открытых вопроса', 'Сформулируйте желаемый результат и приемлемую альтернативу', 'Закрепляйте уступки встречными обязательствами и сроками'],
        planVsReality: {
          summary: 'Основные шаги плана были использованы, один из них потребовал адаптации.',
          items: planSteps.slice(0, 3).map((preparationText, index) => ({
            preparationText,
            status: index === 0 ? 'followed' : index === 1 ? 'adapted' : 'unused',
            evidence: index === 2 ? null : index === 0 ? first : last,
            observation: index === 0 ? 'Вы начали с уточнения позиции и контекста второй стороны.' : index === 1 ? 'По ходу разговора адаптировали аргументы под ответ оппонента.' : 'Этот шаг явно не наблюдался в разговоре.',
          })),
        },
        goalAssessment: {
          status: successful ? 'achieved' : 'partially-achieved',
          goalText: goal,
          explanation: successful ? 'Цель подтверждается достигнутыми договорённостями.' : 'К цели удалось приблизиться, но часть условий осталась открытой.',
          evidence: [last],
        },
      },
    },
  }
}
