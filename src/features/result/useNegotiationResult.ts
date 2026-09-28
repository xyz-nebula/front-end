import { useCallback, useEffect, useRef, useState } from 'react'

import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'

export interface NegotiationResultPollingPolicy {
  initialDelaysMs: readonly number[]
  intervalMs: number
  deadlineMs: number
}

export const negotiationResultPollingPolicy: NegotiationResultPollingPolicy = {
  initialDelaysMs: [500, 1_000, 2_000],
  intervalMs: 4_000,
  deadlineMs: 6 * 60 * 1_000,
}

interface InFlightResultRequest {
  client: NegotiationClient
  sessionId: string
  promise: Promise<NegotiationResultState>
}

export function useNegotiationResult(
  negotiationClient: NegotiationClient,
  sessionId: string,
  pollingPolicy: NegotiationResultPollingPolicy = negotiationResultPollingPolicy,
) {
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [result, setResult] = useState<NegotiationResultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const generationRef = useRef(0)
  const inFlightResultRef = useRef<InFlightResultRequest | null>(null)

  useEffect(() => {
    const generation = ++generationRef.current
    const deadlineAt = Date.now() + pollingPolicy.deadlineMs
    let timer: number | undefined
    let releaseWait: (() => void) | undefined
    const wait = (delay: number) => new Promise<void>((resolve) => {
      releaseWait = resolve
      timer = window.setTimeout(() => { timer = undefined; releaseWait = undefined; resolve() }, delay)
    })
    const getResult = () => {
      const inFlight = inFlightResultRef.current
      if (inFlight?.client === negotiationClient && inFlight.sessionId === sessionId) {
        return inFlight.promise
      }

      const promise = negotiationClient.getResult(sessionId)
      const request = { client: negotiationClient, sessionId, promise }
      inFlightResultRef.current = request
      void promise.then(
        () => { if (inFlightResultRef.current === request) inFlightResultRef.current = null },
        () => { if (inFlightResultRef.current === request) inFlightResultRef.current = null },
      )
      return promise
    }
    const load = async () => {
      try {
        const loaded = await negotiationClient.getSession(sessionId)
        if (generation !== generationRef.current) return
        setSession(loaded)
        let attempt = 0
        while (generation === generationRef.current) {
          if (attempt > 0 && Date.now() >= deadlineAt) break
          const next = await getResult()
          if (generation !== generationRef.current) return
          setResult(next)
          if (next.status !== 'processing') return

          const remainingMs = deadlineAt - Date.now()
          if (remainingMs <= 0) break
          const delayMs = pollingPolicy.initialDelaysMs[attempt] ?? pollingPolicy.intervalMs
          attempt += 1
          await wait(Math.min(delayMs, remainingMs))
        }
        if (generation === generationRef.current) setError('Разбор готовится дольше обычного. Проверьте ещё раз.')
      } catch (caught) {
        if (generation === generationRef.current) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить результат.')
      }
    }
    void load()
    return () => {
      generationRef.current += 1
      if (timer !== undefined) window.clearTimeout(timer)
      releaseWait?.()
    }
  }, [negotiationClient, pollingPolicy, retryVersion, sessionId])

  const retry = useCallback(() => {
    setSession(null)
    setResult(null)
    setError(null)
    setRetryVersion((version) => version + 1)
  }, [])
  return { error, result, retry, session }
}
