import { useEffect, useMemo, useState } from 'react'

import { getSessionTimerSnapshot } from '@/features/arena/sessionTimer'
import type { NegotiationMessage } from '@/types/negotiation'

export function useSessionTimer(
  messages: NegotiationMessage[],
  timeLimitSeconds: number,
) {
  const [now, setNow] = useState(Date.now)
  const firstMessageAt = useMemo(() => (
    messages.length === 0
      ? null
      : messages.reduce((first, message) => (
          message.sequence < first.sequence ? message : first
        )).createdAt
  ), [messages])
  const snapshot = getSessionTimerSnapshot(messages, timeLimitSeconds, now)

  useEffect(() => {
    if (!firstMessageAt || snapshot.expired) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [firstMessageAt, snapshot.expired])

  return snapshot
}
