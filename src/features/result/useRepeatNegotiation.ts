import { useCallback, useEffect, useRef, useState } from 'react'

import { clearPendingSessionCreate, getOrCreatePendingSessionCreate, type PendingSessionCreate } from '@/features/arena/pendingSessionCreate'
import { readSessionPreparation, saveSessionPreparation, serializePreparation } from '@/features/preparation/preparation'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { NegotiationSession } from '@/types/negotiation'

export function useRepeatNegotiation(
  negotiationClient: NegotiationClient,
  ownerKey: string,
  session: NegotiationSession | null,
  onCreated: (sessionId: string) => void,
) {
  const [failure, setFailure] = useState<{ sessionId: string; message: string } | null>(null)
  const [restartingSessionId, setRestartingSessionId] = useState<string | null>(null)
  const generationRef = useRef(0)
  const operationRef = useRef<{ sessionId: string; generation: number } | null>(null)
  const pendingRef = useRef<PendingSessionCreate | null>(null)

  useEffect(() => {
    generationRef.current += 1
    operationRef.current = null
    pendingRef.current = null
    return () => { generationRef.current += 1 }
  }, [session?.id])

  const repeat = useCallback(async () => {
    if (!session || operationRef.current?.sessionId === session.id) return
    const storageKey = `arena.pending-repeat.${session.id}`
    const command = getOrCreatePendingSessionCreate(storageKey, {
      sourceContext: `repeat:${session.id}`,
      caseId: session.caseId,
      mode: session.mode,
    }, pendingRef.current)
    pendingRef.current = command
    const generation = generationRef.current
    const operation = { sessionId: session.id, generation }
    operationRef.current = operation
    setRestartingSessionId(session.id)
    setFailure(null)
    try {
      const previousPreparation = readSessionPreparation(ownerKey, session.id)
      const created = await negotiationClient.createSession({
        caseId: command.caseId,
        timeLimitSeconds: session.timeLimitSeconds,
        mode: command.mode,
        clientCommandId: command.clientCommandId,
        preparations: previousPreparation ? serializePreparation(previousPreparation.draft) : '# Подготовка\n\nПользователь не заполнял карточку подготовки.',
        selectedRole: previousPreparation?.selectedRole ?? 0,
      })
      if (previousPreparation) saveSessionPreparation(ownerKey, created.id, previousPreparation)
      clearPendingSessionCreate(storageKey)
      pendingRef.current = null
      if (generation !== generationRef.current) return
      onCreated(created.id)
    } catch (caught) {
      if (generation !== generationRef.current) return
      setFailure({ sessionId: session.id, message: caught instanceof Error ? caught.message : 'Не удалось начать новый раунд.' })
      if (operationRef.current === operation) {
        operationRef.current = null
        setRestartingSessionId(null)
      }
    }
  }, [negotiationClient, onCreated, ownerKey, session])

  const error = failure && failure.sessionId === session?.id ? failure.message : null
  return { error, isRestarting: restartingSessionId === session?.id, repeat }
}
