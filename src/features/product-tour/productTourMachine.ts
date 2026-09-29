import {
  PRODUCT_TOUR_VERSION,
  type ProductTourState,
  type ProductTourStepId,
} from './productTourStorage.ts'

export type ProductTourEvent =
  | { type: 'start' }
  | { type: 'dismiss' }
  | { type: 'case-opened'; caseId: string; caseIndex: number }
  | { type: 'role-selected'; roleIndex: 0 | 1 }
  | { type: 'preparation-opened' }
  | { type: 'section-opened'; section: 'analysis' | 'strategy' | 'tactics' }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'session-created'; sessionId: string; userMessages: number; aiMessages: number }
  | { type: 'audio-connected'; userMessages: number; aiMessages: number }
  | { type: 'dialogue-completed' }
  | { type: 'finish-opened' }
  | { type: 'finish-cancelled' }
  | { type: 'session-finished' }
  | { type: 'result-ready' }
  | { type: 'complete' }

const forwardSteps: Partial<Record<ProductTourStepId, ProductTourStepId>> = {
  analysis: 'strategy',
  strategy: 'tactics',
  tactics: 'start-duel',
}

const backwardSteps: Partial<Record<ProductTourStepId, ProductTourStepId>> = {
  strategy: 'analysis',
  tactics: 'strategy',
  'start-duel': 'tactics',
}

function initialState(now: string): ProductTourState {
  return {
    schemaVersion: 1,
    tourVersion: PRODUCT_TOUR_VERSION,
    status: 'active',
    stepId: 'case',
    updatedAt: now,
  }
}

function update(
  state: ProductTourState,
  now: string,
  changes: Partial<ProductTourState>,
): ProductTourState {
  return { ...state, ...changes, updatedAt: now }
}

export function transitionProductTour(
  state: ProductTourState | null,
  event: ProductTourEvent,
  now = new Date().toISOString(),
): ProductTourState | null {
  if (event.type === 'start') return initialState(now)
  if (!state) return event.type === 'dismiss'
    ? { ...initialState(now), status: 'never' }
    : null

  if (event.type === 'dismiss') {
    return {
      ...initialState(now),
      status: 'never',
    }
  }
  if (state.status !== 'active') return state

  switch (event.type) {
    case 'case-opened':
      return state.stepId === 'case'
        ? update(state, now, { stepId: 'role', caseId: event.caseId, caseIndex: event.caseIndex })
        : state
    case 'role-selected':
      return state.stepId === 'role'
        ? update(state, now, { stepId: 'voice-format', roleIndex: event.roleIndex })
        : state
    case 'preparation-opened':
      return state.stepId === 'voice-format' && state.caseId && state.roleIndex !== undefined
        ? update(state, now, { stepId: 'analysis' })
        : state
    case 'section-opened':
      return ['analysis', 'strategy', 'tactics', 'start-duel'].includes(state.stepId)
        ? update(state, now, { stepId: event.section })
        : state
    case 'next': {
      const stepId = forwardSteps[state.stepId]
      return stepId ? update(state, now, { stepId }) : state
    }
    case 'back': {
      const stepId = backwardSteps[state.stepId]
      return stepId ? update(state, now, { stepId }) : state
    }
    case 'session-created':
      return ['analysis', 'strategy', 'tactics', 'start-duel', 'voice-format'].includes(state.stepId)
        ? update(state, now, {
            stepId: 'microphone',
            sessionId: event.sessionId,
            dialogueBaseline: { userMessages: event.userMessages, aiMessages: event.aiMessages },
          })
        : state
    case 'audio-connected':
      return state.stepId === 'microphone'
        ? update(state, now, {
            stepId: 'dialogue',
            dialogueBaseline: { userMessages: event.userMessages, aiMessages: event.aiMessages },
          })
        : state
    case 'dialogue-completed':
      return state.stepId === 'dialogue' ? update(state, now, { stepId: 'finish' }) : state
    case 'finish-opened':
      return ['microphone', 'dialogue', 'finish'].includes(state.stepId)
        ? update(state, now, { stepId: 'confirm-finish' })
        : state
    case 'finish-cancelled':
      return state.stepId === 'confirm-finish' ? update(state, now, { stepId: 'finish' }) : state
    case 'session-finished':
      return ['microphone', 'dialogue', 'finish', 'confirm-finish'].includes(state.stepId)
        ? update(state, now, { stepId: 'result' })
        : state
    case 'result-ready':
      return state.sessionId && state.stepId !== 'result' ? update(state, now, { stepId: 'result' }) : state
    case 'complete':
      return state.stepId === 'result' ? update(state, now, { status: 'completed' }) : state
    default:
      return state
  }
}
