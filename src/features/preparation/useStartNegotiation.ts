import { useCallback, useRef, useState } from 'react'

import { clearPendingSessionCreate, getOrCreatePendingSessionCreate, type PendingSessionCreate } from '@/features/arena/pendingSessionCreate'
import { saveSessionPreparation, serializePreparation } from '@/features/preparation/preparation'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { isServiceError } from '@/types/api'
import type { TrainingCase } from '@/types/case'
import type { NegotiationMode } from '@/types/negotiation'
import type { PreparationDraft } from '@/types/preparation'

function preparationFingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

interface StartNegotiationInput {
  draft: PreparationDraft
  mode: NegotiationMode | null
  ownerKey: string
  roleIndex: 0 | 1 | null
  trainingCase?: TrainingCase
  supportsTextNegotiation: boolean
}

export function useStartNegotiation(negotiationClient: NegotiationClient, input: StartNegotiationInput, onCreated: (sessionId: string) => void) {
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingRef = useRef<PendingSessionCreate | null>(null)

  const start = useCallback(async () => {
    const { draft, mode, ownerKey, roleIndex, supportsTextNegotiation, trainingCase } = input
    if (!trainingCase || roleIndex === null || mode === null || isStarting) return
    if (mode === 'text' && !supportsTextNegotiation) {
      setError('Текстовые переговоры доступны только в демонстрационном режиме.')
      return
    }
    const preparations = serializePreparation(draft)
    const sourceContext = `preparation:${trainingCase.id}:${roleIndex}:${mode}:${preparationFingerprint(preparations)}`
    const storageKey = `arena.pending-create.${trainingCase.id}.${roleIndex}.${mode}`
    const command = getOrCreatePendingSessionCreate(storageKey, { sourceContext, caseId: trainingCase.id, mode }, pendingRef.current)
    pendingRef.current = command
    setIsStarting(true)
    setError(null)
    try {
      const session = await negotiationClient.createSession({
        caseId: trainingCase.id,
        caseName: trainingCase.title,
        caseSnapshot: {
          id: trainingCase.id,
          title: trainingCase.title,
          description: trainingCase.description,
          goal: trainingCase.goal,
          timeLimitSeconds: trainingCase.timeLimitSeconds,
          roles: trainingCase.roles,
        },
        timeLimitSeconds: trainingCase.timeLimitSeconds,
        mode,
        clientCommandId: command.clientCommandId,
        preparations,
        selectedRole: roleIndex,
      })
      saveSessionPreparation(ownerKey, session.id, {
        caseId: trainingCase.id,
        caseTitle: trainingCase.title,
        userRole: trainingCase.roles[roleIndex],
        opponentRole: trainingCase.roles[roleIndex === 0 ? 1 : 0],
        selectedRole: roleIndex,
        draft,
      })
      clearPendingSessionCreate(storageKey)
      onCreated(session.id)
    } catch (caught) {
      setError(isServiceError(caught) || caught instanceof Error ? caught.message : 'Не удалось начать поединок.')
      setIsStarting(false)
    }
  }, [input, isStarting, negotiationClient, onCreated])

  return { error, isStarting, start }
}
