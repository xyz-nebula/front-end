import type { NegotiationMessage } from '@/types/negotiation'

export interface SessionTimerSnapshot {
  startedAt: string | null
  deadline: number | null
  remainingSeconds: number
  started: boolean
  expired: boolean
}

export function getFirstMessageStartedAt(messages: NegotiationMessage[]): string | null {
  if (messages.length === 0) return null
  return messages.reduce((first, message) => (
    message.sequence < first.sequence ? message : first
  )).createdAt
}

export function getSessionTimerSnapshot(
  messages: NegotiationMessage[],
  timeLimitSeconds: number,
  now: number,
): SessionTimerSnapshot {
  const startedAt = getFirstMessageStartedAt(messages)
  if (!startedAt) {
    return {
      startedAt: null,
      deadline: null,
      remainingSeconds: timeLimitSeconds,
      started: false,
      expired: false,
    }
  }

  const parsedStart = Date.parse(startedAt)
  if (!Number.isFinite(parsedStart)) {
    return {
      startedAt: null,
      deadline: null,
      remainingSeconds: timeLimitSeconds,
      started: false,
      expired: false,
    }
  }

  const deadline = parsedStart + timeLimitSeconds * 1_000
  const remainingSeconds = Math.min(
    timeLimitSeconds,
    Math.max(0, Math.ceil((deadline - now) / 1_000)),
  )
  return {
    startedAt,
    deadline,
    remainingSeconds,
    started: true,
    expired: remainingSeconds === 0,
  }
}

export function formatRemainingTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
