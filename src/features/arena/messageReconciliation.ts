import type { MessageSpeaker, NegotiationMessage } from '@/types/negotiation'

export interface CompletedTranscriptDraft {
  targetText: string
  text: string
  phase: 'finishing'
  completionId: number
}

export function createCompletedTranscriptDraft(
  text: string,
  completionId: number,
): CompletedTranscriptDraft {
  return {
    targetText: text,
    text: '',
    phase: 'finishing',
    completionId,
  }
}

export function mergeMessages(
  current: readonly NegotiationMessage[],
  incoming: readonly NegotiationMessage[],
): NegotiationMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
}

interface PersistedMessageMatch {
  messages: readonly NegotiationMessage[]
  baselineMessageIds: ReadonlySet<string>
  claimedMessageIds: ReadonlySet<string>
  speaker: MessageSpeaker
  text: string
}

export function findNewPersistedMessage({
  messages,
  baselineMessageIds,
  claimedMessageIds,
  speaker,
  text,
}: PersistedMessageMatch): NegotiationMessage | undefined {
  return messages.find((message) => (
    message.speaker === speaker
    && message.text === text
    && !baselineMessageIds.has(message.id)
    && !claimedMessageIds.has(message.id)
  ))
}

export type TranscriptReconciliationResult =
  | { status: 'matched'; message: NegotiationMessage }
  | { status: 'not-found' }
  | { status: 'stale' }

interface ReconcileCompletedTranscriptInput {
  speaker: MessageSpeaker
  text: string
  baselineMessageIds: ReadonlySet<string>
  claimedMessageIds: Set<string>
  persistedMessageIds: Set<string>
  delays: readonly number[]
  wait: (delay: number) => Promise<void>
  refresh: () => Promise<{ messages: NegotiationMessage[] } | null>
  isCurrent: () => boolean
}

export async function reconcileCompletedTranscript({
  speaker,
  text,
  baselineMessageIds,
  claimedMessageIds,
  persistedMessageIds,
  delays,
  wait,
  refresh,
  isCurrent,
}: ReconcileCompletedTranscriptInput): Promise<TranscriptReconciliationResult> {
  for (const delay of delays) {
    await wait(delay)
    if (!isCurrent()) return { status: 'stale' }
    const refreshed = await refresh()
    if (!isCurrent()) return { status: 'stale' }
    refreshed?.messages.forEach((message) => persistedMessageIds.add(message.id))
    const persisted = refreshed && findNewPersistedMessage({
      messages: refreshed.messages,
      baselineMessageIds,
      claimedMessageIds,
      speaker,
      text,
    })
    if (persisted) {
      claimedMessageIds.add(persisted.id)
      return { status: 'matched', message: persisted }
    }
  }
  return { status: 'not-found' }
}
