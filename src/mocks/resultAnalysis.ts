import { getDuelPreparation } from '@/mocks/duelPreparation'
import type { NegotiationEvidence, NegotiationOutcomeKind, NegotiationResult, NegotiationSession } from '@/types/negotiation'

type MockAnalysis = Pick<NegotiationResult, 'outcome' | 'judges' | 'trainer'>

interface MockOutcomeContent {
  summary: string
  agreedTerms: string[]
  openPoints: string[]
  nextStep: string | null
}

const outcomeContent: Record<NegotiationOutcomeKind, MockOutcomeContent> = {
  agreement: {
    summary: 'Вы удерживали фокус на интересах сторон и завершили разговор конкретными договорённостями.',
    agreedTerms: ['Стороны согласовали основные условия', 'Определили ответственных', 'Зафиксировали следующий шаг'],
    openPoints: [],
    nextStep: 'Вернуться к договорённости в согласованный срок и сверить результат.',
  },
  'partial-agreement': {
    summary: 'Стороны согласовали часть условий, но несколько существенных вопросов остались открытыми.',
    agreedTerms: ['Стороны обозначили общую рамку решения', 'Согласовали ближайший шаг'],
    openPoints: ['Итоговые условия', 'Критерии проверки результата'],
    nextStep: 'Уточнить оставшиеся условия и зафиксировать итоговую договорённость.',
  },
  deferred: {
    summary: 'Стороны прояснили позиции, но отложили окончательное решение до следующего разговора.',
    agreedTerms: ['Определили вопросы для дополнительной проверки'],
    openPoints: ['Окончательное решение', 'Сроки и ответственные'],
    nextStep: 'Собрать недостающую информацию и вернуться к обсуждению в согласованный срок.',
  },
  'no-agreement': {
    summary: 'Вы обозначили позицию, но сторонам не удалось найти приемлемые условия договорённости.',
    agreedTerms: [],
    openPoints: ['Критерии второй стороны', 'Приемлемые условия решения'],
    nextStep: 'Уточнить ограничения второй стороны и подготовить новые варианты решения.',
  },
  'not-assessable': {
    summary: 'В разговоре недостаточно данных, чтобы надёжно определить итог переговоров.',
    agreedTerms: [],
    openPoints: ['Позиции сторон', 'Конкретные условия', 'Следующие шаги'],
    nextStep: null,
  },
}

function evidenceForSpeaker(
  session: NegotiationSession,
  speaker: 'user' | 'ai',
  fallback: string,
  fromEnd = false,
): NegotiationEvidence {
  const messages = fromEnd ? [...session.messages].reverse() : session.messages
  const message = messages.find((candidate) => candidate.speaker === speaker)
  const messageIndex = message ? session.messages.findIndex((candidate) => candidate.id === message.id) : 0
  return { messageIndex, isAi: speaker === 'ai', quote: message?.text ?? fallback }
}

export function createMockResultAnalysis(session: NegotiationSession, kind: NegotiationOutcomeKind): MockAnalysis {
  const preparation = getDuelPreparation(session.caseId)
  const firstUser = evidenceForSpeaker(session, 'user', 'Давайте сначала уточним интересы обеих сторон.')
  const lastUser = evidenceForSpeaker(session, 'user', 'Предлагаю зафиксировать конкретные следующие шаги.', true)
  const opponent = evidenceForSpeaker(session, 'ai', 'Мне важно понять, какие условия вы предлагаете.', true)
  const goal = preparation?.goal ?? 'Найти рабочее решение и зафиксировать следующие шаги.'
  const planSteps = preparation?.steps ?? [
    'Выяснить позицию второй стороны',
    'Предложить взаимовыгодное решение',
    'Зафиксировать договорённость',
  ]
  const content = outcomeContent[kind]
  const goalStatus = kind === 'agreement'
    ? 'achieved'
    : kind === 'not-assessable'
      ? 'not-assessable'
      : kind === 'no-agreement'
        ? 'not-achieved'
        : 'partially-achieved'

  return {
    outcome: {
      status: 'ready',
      kind,
      summary: content.summary,
      agreedTerms: content.agreedTerms,
      openPoints: content.openPoints,
      nextStep: content.nextStep,
      evidence: [firstUser, opponent],
    },
    judges: [
      { college: 'hiring', status: 'ready', verdict: { choice: 'user', criterion: 'Надёжность', evidence: firstUser, observation: 'Вы обозначили понятную рамку разговора и предложили двигаться по шагам.', effect: 'Разговор сохранил конструктивный тон.', comparison: 'Ваша позиция звучала яснее и спокойнее позиции оппонента.' } },
      { college: 'negotiation', status: 'ready', verdict: { choice: 'user', criterion: 'Движение к цели', evidence: lastUser, observation: 'Вы возвращали обсуждение к цели и искали применимое решение.', effect: 'Стороны приблизились к конкретным следующим шагам.', comparison: 'Вы чаще связывали аргументы с целью переговоров.' } },
      { college: 'ownership', status: 'ready', verdict: { choice: 'opponent', criterion: 'Управление рисками', evidence: opponent, observation: 'Не все ограничения и контрольные точки были проговорены до конца.', effect: 'В договорённости осталось пространство для разных трактовок.', comparison: 'Оппонент внимательнее удерживал риски и возможные ограничения.' } },
    ],
    trainer: {
      status: 'ready',
      feedback: {
        summary: `Целью было: ${goal} Вы вели разговор конструктивно, но часть критериев второй стороны стоило раскрыть подробнее.`,
        strengths: [{ evidence: firstUser, action: 'Задали рабочую рамку и обозначили предмет разговора.', situationChange: 'Диалог стал более предметным.', consequence: 'Оппонент включился в обсуждение условий.' }],
        mistakes: [{ evidence: lastUser, action: 'Уступка прозвучала до фиксации встречного обязательства.', situationChange: 'Переговорная позиция стала слабее.', consequence: 'Часть ценности осталась у второй стороны.' }],
        missedOpportunities: [{ evidence: opponent, action: 'Не уточнили критерий проверки результата.', situationChange: 'Следующий шаг остался недостаточно измеримым.', consequence: 'Договорённость можно истолковать по-разному.' }],
        nextTry: ['Перед следующим раундом подготовьте три открытых вопроса', 'Сформулируйте желаемый результат и приемлемую альтернативу', 'Закрепляйте уступки встречными обязательствами и сроками'],
        planVsReality: {
          summary: 'Основные шаги плана были использованы, один из них потребовал адаптации.',
          items: planSteps.slice(0, 3).map((preparationText, index) => ({
            preparationText,
            status: index === 0 ? 'followed' : index === 1 ? 'adapted' : 'unused',
            evidence: index === 2 ? null : index === 0 ? firstUser : lastUser,
            observation: index === 0 ? 'Вы начали с уточнения позиции и контекста второй стороны.' : index === 1 ? 'По ходу разговора адаптировали аргументы под ответ оппонента.' : 'Этот шаг явно не наблюдался в разговоре.',
          })),
        },
        goalAssessment: {
          status: goalStatus,
          goalText: goal,
          explanation: kind === 'agreement'
            ? 'Цель подтверждается достигнутыми договорённостями.'
            : kind === 'not-assessable'
              ? 'В разговоре недостаточно данных, чтобы оценить достижение цели.'
              : kind === 'no-agreement'
                ? 'Заявленная цель не была достигнута.'
                : 'К цели удалось приблизиться, но часть условий осталась открытой.',
          evidence: [lastUser],
        },
      },
    },
  }
}
