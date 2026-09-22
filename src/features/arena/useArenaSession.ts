import { useCallback, useEffect, useRef, useState } from 'react'

import { useDomainServices } from '@/services/domainServices'
import { isServiceError } from '@/types/api'
import type {
  NegotiationMessage,
  NegotiationSession,
  SessionViewState,
  TurnState,
} from '@/types/negotiation'

interface PendingTurn {
  id: string
  text: string
}

interface UseArenaSessionValue {
  session: NegotiationSession | null
  viewState: SessionViewState
  turnState: TurnState
  error: string | null
  draft: string
  setDraft: (value: string) => void
  reload: () => Promise<void>
  sendTextTurn: () => Promise<void>
  finishSession: () => Promise<void>
}

const pendingTurnKey = (sessionId: string) => `arena.pending-turn.${sessionId}`
const pendingFinishKey = (sessionId: string) => `arena.pending-finish.${sessionId}`

function readSessionValue(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // In-memory state still keeps the current operation safe from duplicate clicks.
  }
}

function removeSessionValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in privacy modes; the current tab still works.
  }
}

function readPendingTurn(sessionId: string): PendingTurn | null {
  const serialized = readSessionValue(pendingTurnKey(sessionId))
  if (!serialized) return null
  try {
    const value: unknown = JSON.parse(serialized)
    if (
      typeof value === 'object'
      && value !== null
      && 'id' in value
      && 'text' in value
      && typeof value.id === 'string'
      && typeof value.text === 'string'
      && value.id.length > 0
      && value.text.trim().length > 0
    ) {
      return { id: value.id, text: value.text }
    }
  } catch {
    // Corrupted tab-local recovery data should never break session loading.
  }
  removeSessionValue(pendingTurnKey(sessionId))
  return null
}

function savePendingTurn(sessionId: string, turn: PendingTurn): void {
  writeSessionValue(pendingTurnKey(sessionId), JSON.stringify(turn))
}

function errorMessage(error: unknown, fallback: string): string {
  if (isServiceError(error) || error instanceof Error) return error.message
  return fallback
}

function mergeMessages(
  current: readonly NegotiationMessage[],
  incoming: readonly NegotiationMessage[],
): NegotiationMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
}

export function useArenaSession(sessionId: string): UseArenaSessionValue {
  const { negotiationClient } = useDomainServices()
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [viewState, setViewState] = useState<SessionViewState>('loading')
  const [turnState, setTurnState] = useState<TurnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => readPendingTurn(sessionId)?.text ?? '')
  const mountedRef = useRef(true)
  const turnInFlightRef = useRef(false)
  const finishInFlightRef = useRef(false)

  const executePendingTurn = useCallback(async (pending: PendingTurn) => {
    if (turnInFlightRef.current) return
    turnInFlightRef.current = true
    setTurnState('thinking')
    setError(null)
    try {
      const result = await negotiationClient.sendTextTurn({
        sessionId,
        text: pending.text,
        clientTurnId: pending.id,
      })
      if (!mountedRef.current) return
      setSession((current) => current ? {
        ...current,
        status: result.sessionStatus,
        messages: mergeMessages(current.messages, [result.userMessage, result.aiMessage]),
      } : current)
      removeSessionValue(pendingTurnKey(sessionId))
      setDraft('')
      setTurnState('idle')
    } catch (caught) {
      if (!mountedRef.current) return
      setTurnState('error')
      setError(errorMessage(caught, 'Не удалось отправить сообщение. Попробуйте ещё раз.'))
    } finally {
      turnInFlightRef.current = false
    }
  }, [negotiationClient, sessionId])

  const finishWithCommand = useCallback(async (commandId: string) => {
    if (finishInFlightRef.current) return
    finishInFlightRef.current = true
    setViewState('finishing')
    setError(null)
    try {
      const result = await negotiationClient.finishSession({ sessionId, clientCommandId: commandId })
      if (!mountedRef.current) return
      removeSessionValue(pendingFinishKey(sessionId))
      setSession((current) => current ? {
        ...current,
        status: result.status === 'ready' ? 'finished' : 'finishing',
        ...(result.status === 'ready' ? { finishedAt: new Date().toISOString() } : {}),
      } : current)
      setViewState('finished')
    } catch (caught) {
      if (!mountedRef.current) return
      setViewState('ready')
      setError(errorMessage(caught, 'Не удалось завершить тренировку. Попробуйте ещё раз.'))
    } finally {
      finishInFlightRef.current = false
    }
  }, [negotiationClient, sessionId])

  const reload = useCallback(async () => {
    setViewState('loading')
    setError(null)
    try {
      const loaded = await negotiationClient.getSession(sessionId)
      if (!mountedRef.current) return
      setSession(loaded)
      if (loaded.status === 'finished' || loaded.status === 'finishing') {
        setViewState('finished')
        removeSessionValue(pendingTurnKey(sessionId))
        if (loaded.status === 'finished') removeSessionValue(pendingFinishKey(sessionId))
        return
      }
      setViewState('ready')
      const pendingFinish = readSessionValue(pendingFinishKey(sessionId))
      if (pendingFinish) {
        await finishWithCommand(pendingFinish)
        return
      }
      const pendingTurn = readPendingTurn(sessionId)
      if (pendingTurn) await executePendingTurn(pendingTurn)
    } catch (caught) {
      if (!mountedRef.current) return
      setViewState('error')
      setError(errorMessage(caught, 'Не удалось загрузить переговоры.'))
    }
  }, [executePendingTurn, finishWithCommand, negotiationClient, sessionId])

  useEffect(() => {
    mountedRef.current = true
    const startupTimer = window.setTimeout(() => void reload(), 0)
    return () => {
      window.clearTimeout(startupTimer)
      mountedRef.current = false
    }
  }, [reload])

  const sendTextTurn = useCallback(async () => {
    const text = draft.trim()
    if (!text || turnInFlightRef.current || viewState !== 'ready' || session?.status !== 'active') return
    const existing = readPendingTurn(sessionId)
    const pending = existing ?? { id: crypto.randomUUID(), text }
    if (!existing) savePendingTurn(sessionId, pending)
    await executePendingTurn(pending)
  }, [draft, executePendingTurn, session?.status, sessionId, viewState])

  const finishSession = useCallback(async () => {
    if (finishInFlightRef.current || turnInFlightRef.current || session?.status !== 'active') return
    const key = pendingFinishKey(sessionId)
    const commandId = readSessionValue(key) ?? crypto.randomUUID()
    writeSessionValue(key, commandId)
    await finishWithCommand(commandId)
  }, [finishWithCommand, session?.status, sessionId])

  return {
    session,
    viewState,
    turnState,
    error,
    draft,
    setDraft,
    reload,
    sendTextTurn,
    finishSession,
  }
}
