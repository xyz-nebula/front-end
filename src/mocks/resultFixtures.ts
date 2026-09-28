import { createMockResultAnalysis } from '@/mocks/resultAnalysis'
import type {
  NegotiationOutcomeKind,
  NegotiationResult,
  NegotiationResultState,
  NegotiationSession,
} from '@/types/negotiation'

export const mockOutcomeFixtureKinds = [
  'agreement',
  'partial-agreement',
  'deferred',
  'no-agreement',
  'not-assessable',
] as const satisfies readonly NegotiationOutcomeKind[]

export function createMockResultFixture(
  session: NegotiationSession,
  kind: NegotiationOutcomeKind,
): NegotiationResult {
  return {
    sessionId: session.id,
    source: 'mock',
    ...createMockResultAnalysis(session, kind),
  }
}

export function createMockResultStateFixtures(
  session: NegotiationSession,
  kind: NegotiationOutcomeKind = 'agreement',
): {
  processing: Extract<NegotiationResultState, { status: 'processing' }>
  ready: Extract<NegotiationResultState, { status: 'ready' }>
  failed: Extract<NegotiationResultState, { status: 'failed' }>
} {
  return {
    processing: { status: 'processing' },
    ready: { status: 'ready', result: createMockResultFixture(session, kind) },
    failed: { status: 'failed', message: 'Не удалось подготовить демонстрационный разбор.' },
  }
}
