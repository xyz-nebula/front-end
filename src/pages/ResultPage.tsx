import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ResultAnalysis } from '@/components/result/ResultAnalysis'
import { ResultHeader } from '@/components/result/ResultHeader'
import { ResultStatus } from '@/components/result/ResultStatus'
import {
  clearPendingSessionCreate,
  getOrCreatePendingSessionCreate,
  type PendingSessionCreate,
} from '@/features/arena/pendingSessionCreate'
import { getDuelPreparation } from '@/mocks/duelPreparation'
import { useDomainServices } from '@/services/domainServices'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'
import '@/styles/result.css'

const POLL_DELAYS = [400, 700, 1_000, 1_500, 2_000, 3_000]

export function ResultPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const { isRealVoice, negotiationClient } = useDomainServices()
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [result, setResult] = useState<NegotiationResultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const [restartingSessionId, setRestartingSessionId] = useState<string | null>(null)
  const generationRef = useRef(0)
  const restartOperationRef = useRef<{ sessionId: string; generation: number } | null>(null)
  const pendingRepeatRef = useRef<PendingSessionCreate | null>(null)

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

  const repeatCase = useCallback(async () => {
    if (!session || restartOperationRef.current?.sessionId === session.id) return
    const storageKey = `arena.pending-repeat.${session.id}`
    const command = getOrCreatePendingSessionCreate(storageKey, {
      sourceContext: `repeat:${session.id}`,
      caseId: session.caseId,
      mode: session.mode,
    }, pendingRepeatRef.current)
    pendingRepeatRef.current = command
    const generation = generationRef.current
    const operation = { sessionId: session.id, generation }
    restartOperationRef.current = operation
    setRestartingSessionId(session.id)
    setError(null)
    try {
      const created = await negotiationClient.createSession({
        caseId: command.caseId,
        mode: command.mode,
        clientCommandId: command.clientCommandId,
      })
      clearPendingSessionCreate(storageKey)
      pendingRepeatRef.current = null
      if (generation !== generationRef.current) return
      navigate(`/arena/${created.id}`)
    } catch (caught) {
      if (generation !== generationRef.current) return
      setError(caught instanceof Error ? caught.message : 'Не удалось начать новый раунд.')
      if (restartOperationRef.current === operation) {
        restartOperationRef.current = null
        setRestartingSessionId(null)
      }
    }
  }, [navigate, negotiationClient, session])

  const ready = result?.status === 'ready' ? result.result : null
  const isRestarting = restartingSessionId === session?.id
  const preparation = getDuelPreparation(session?.caseId ?? '')

  return (
    <div className="result-page">
      <ResultHeader />
      <main className="result-shell result-main">
        {ready && session ? <ResultAnalysis
          result={ready}
          session={session}
          preparation={preparation}
          isDemo={isRealVoice}
          isRestarting={isRestarting}
          error={error}
          onRepeat={() => void repeatCase()}
        /> : <ResultStatus
          result={result}
          error={error}
          onRetry={() => { setError(null); setResult(null); setRetryVersion((version) => version + 1) }}
        />}
      </main>
    </div>
  )
}
