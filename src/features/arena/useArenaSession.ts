import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { NegotiationClient } from '@/services/contracts/negotiationClient'
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

interface ArenaContext {
  sessionId: string
  negotiationClient: NegotiationClient
}

interface ArenaOperation {
  context: ArenaContext
}

interface UseArenaSessionValue {
  session: NegotiationSession | null
  viewState: SessionViewState
  turnState: TurnState
  error: string | null
  draft: string
  setDraft: (value: string) => void
  reload: () => Promise<void>
  refreshSession: () => Promise<void>
  addCommittedMessage: (message: NegotiationMessage) => void
  sendTextTurn: () => Promise<void>
  finishSession: () => Promise<boolean>
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
  const arenaContext = useMemo<ArenaContext>(
    () => ({ sessionId, negotiationClient }),
    [negotiationClient, sessionId],
  )
  const contextRef = useRef(arenaContext)
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [viewState, setViewState] = useState<SessionViewState>('loading')
  const [turnState, setTurnState] = useState<TurnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => readPendingTurn(sessionId)?.text ?? '')
  const [stateContext, setStateContext] = useState(arenaContext)
  const mountedRef = useRef(true)
  const turnInFlightRef = useRef<ArenaOperation | null>(null)
  const finishInFlightRef = useRef<ArenaOperation | null>(null)

  const isCurrent = useCallback((context: ArenaContext) => (
    mountedRef.current && contextRef.current === context
  ), [])

  const executePendingTurn = useCallback(async (pending: PendingTurn) => {
    const operation: ArenaOperation = { context: arenaContext }
    if (turnInFlightRef.current?.context === arenaContext) return
    turnInFlightRef.current = operation
    setTurnState('thinking')
    setError(null)
    try {
      const result = await arenaContext.negotiationClient.sendTextTurn({
        sessionId: arenaContext.sessionId,
        text: pending.text,
        clientTurnId: pending.id,
      })
      if (!isCurrent(arenaContext)) return
      setSession((current) => current ? {
        ...current,
        status: result.sessionStatus,
        messages: mergeMessages(current.messages, [result.userMessage, result.aiMessage]),
      } : current)
      removeSessionValue(pendingTurnKey(arenaContext.sessionId))
      setDraft('')
      setTurnState('idle')
    } catch (caught) {
      if (!isCurrent(arenaContext)) return
      setTurnState('error')
      setError(errorMessage(caught, 'Не удалось отправить сообщение. Попробуйте ещё раз.'))
    } finally {
      if (turnInFlightRef.current === operation) turnInFlightRef.current = null
    }
  }, [arenaContext, isCurrent])

  const finishWithCommand = useCallback(async (commandId: string): Promise<boolean> => {
    const operation: ArenaOperation = { context: arenaContext }
    if (finishInFlightRef.current?.context === arenaContext) return false
    finishInFlightRef.current = operation
    setViewState('finishing')
    setError(null)
    try {
      const result = await arenaContext.negotiationClient.finishSession({
        sessionId: arenaContext.sessionId,
        clientCommandId: commandId,
      })
      if (!isCurrent(arenaContext)) return false
      removeSessionValue(pendingFinishKey(arenaContext.sessionId))
      setSession((current) => current ? {
        ...current,
        status: result.status === 'ready' ? 'finished' : 'finishing',
        ...(result.status === 'ready' ? { finishedAt: new Date().toISOString() } : {}),
      } : current)
      setViewState('finished')
      return true
    } catch (caught) {
      if (!isCurrent(arenaContext)) return false
      setViewState('ready')
      setError(errorMessage(caught, 'Не удалось завершить тренировку. Попробуйте ещё раз.'))
      return false
    } finally {
      if (finishInFlightRef.current === operation) finishInFlightRef.current = null
    }
  }, [arenaContext, isCurrent])

  const reload = useCallback(async () => {
    if (!isCurrent(arenaContext)) return
    setViewState('loading')
    setError(null)
    try {
      const loaded = await arenaContext.negotiationClient.getSession(arenaContext.sessionId)
      if (!isCurrent(arenaContext)) return
      setSession(loaded)
      if (loaded.status === 'finished' || loaded.status === 'finishing') {
        setViewState('finished')
        removeSessionValue(pendingTurnKey(arenaContext.sessionId))
        if (loaded.status === 'finished') {
          removeSessionValue(pendingFinishKey(arenaContext.sessionId))
        }
        return
      }
      setViewState('ready')
      const pendingFinish = readSessionValue(pendingFinishKey(arenaContext.sessionId))
      if (pendingFinish) {
        await finishWithCommand(pendingFinish)
        return
      }
      const pendingTurn = readPendingTurn(arenaContext.sessionId)
      if (pendingTurn) await executePendingTurn(pendingTurn)
    } catch (caught) {
      if (!isCurrent(arenaContext)) return
      setViewState('error')
      setError(errorMessage(caught, 'Не удалось загрузить переговоры.'))
    }
  }, [arenaContext, executePendingTurn, finishWithCommand, isCurrent])

  const refreshSession = useCallback(async () => {
    try {
      const loaded = await arenaContext.negotiationClient.getSession(arenaContext.sessionId)
      if (isCurrent(arenaContext)) setSession(loaded)
    } catch (caught) {
      if (!isCurrent(arenaContext)) return
      setError(errorMessage(caught, 'Не удалось обновить переговоры.'))
    }
  }, [arenaContext, isCurrent])

  const addCommittedMessage = useCallback((message: NegotiationMessage) => {
    if (!isCurrent(arenaContext)) return
    setSession((current) => current ? {
      ...current,
      messages: mergeMessages(current.messages, [message]),
    } : current)
  }, [arenaContext, isCurrent])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    contextRef.current = arenaContext
    const startupTimer = window.setTimeout(() => {
      setStateContext(arenaContext)
      setSession(null)
      setViewState('loading')
      setTurnState('idle')
      setError(null)
      setDraft(readPendingTurn(arenaContext.sessionId)?.text ?? '')
      void reload()
    }, 0)
    return () => window.clearTimeout(startupTimer)
  }, [arenaContext, reload])

  const sendTextTurn = useCallback(async () => {
    const text = draft.trim()
    if (
      !text
      || turnInFlightRef.current?.context === arenaContext
      || viewState !== 'ready'
      || session?.status !== 'active'
    ) return
    const existing = readPendingTurn(arenaContext.sessionId)
    const pending = existing ?? { id: crypto.randomUUID(), text }
    if (!existing) savePendingTurn(arenaContext.sessionId, pending)
    await executePendingTurn(pending)
  }, [arenaContext, draft, executePendingTurn, session?.status, viewState])

  const finishSession = useCallback(async () => {
    if (
      finishInFlightRef.current?.context === arenaContext
      || turnInFlightRef.current?.context === arenaContext
      || session?.status !== 'active'
    ) return false
    const key = pendingFinishKey(arenaContext.sessionId)
    const commandId = readSessionValue(key) ?? crypto.randomUUID()
    writeSessionValue(key, commandId)
    return finishWithCommand(commandId)
  }, [arenaContext, finishWithCommand, session?.status])

  const contextStateIsCurrent = stateContext === arenaContext

  return {
    session: contextStateIsCurrent ? session : null,
    viewState: contextStateIsCurrent ? viewState : 'loading',
    turnState: contextStateIsCurrent ? turnState : 'idle',
    error: contextStateIsCurrent ? error : null,
    draft: contextStateIsCurrent ? draft : readPendingTurn(arenaContext.sessionId)?.text ?? '',
    setDraft: (value) => {
      if (isCurrent(arenaContext)) setDraft(value)
    },
    reload,
    refreshSession,
    addCommittedMessage,
    sendTextTurn,
    finishSession,
  }
}
