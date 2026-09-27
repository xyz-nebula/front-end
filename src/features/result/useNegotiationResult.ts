import { useCallback, useEffect, useRef, useState } from 'react'

import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'

const POLL_DELAYS = [400, 700, 1_000, 1_500, 2_000, 3_000]

export function useNegotiationResult(negotiationClient: NegotiationClient, sessionId: string) {
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [result, setResult] = useState<NegotiationResultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const generationRef = useRef(0)

  useEffect(() => {
    const generation = ++generationRef.current
    let timer: number | undefined
    let releaseWait: (() => void) | undefined
    const wait = (delay: number) => new Promise<void>((resolve) => {
      releaseWait = resolve
      timer = window.setTimeout(() => { timer = undefined; releaseWait = undefined; resolve() }, delay)
    })
    const load = async () => {
      try {
        const loaded = await negotiationClient.getSession(sessionId)
        if (generation !== generationRef.current) return
        setSession(loaded)
        for (let attempt = 0; attempt <= POLL_DELAYS.length; attempt += 1) {
          const next = await negotiationClient.getResult(sessionId)
          if (generation !== generationRef.current) return
          setResult(next)
          if (next.status !== 'processing') return
          if (attempt < POLL_DELAYS.length) await wait(POLL_DELAYS[attempt])
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
  }, [negotiationClient, retryVersion, sessionId])

  const retry = useCallback(() => {
    setSession(null)
    setResult(null)
    setError(null)
    setRetryVersion((version) => version + 1)
  }, [])
  return { error, result, retry, session }
}
