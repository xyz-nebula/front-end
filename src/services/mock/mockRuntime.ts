import { getMockAiResponse } from '@/mocks/negotiation-scenarios'
import { createMockResultAnalysis } from '@/mocks/resultAnalysis'
import { MockStorage, type MockData, type MockSessionRecord } from '@/services/mock/mockStorage'
import type {
  AudioTicket,
  MessageSpeaker,
  NegotiationMessage,
  NegotiationResult,
  NegotiationResultState,
  NegotiationSession,
} from '@/types/negotiation'
import { ServiceError } from '@/types/api'

const AUDIO_TICKET_LIFETIME_MS = 60_000

function clone<T>(value: T): T {
  return structuredClone(value)
}

function domainError(message: string, code: string, status = 400): ServiceError {
  return new ServiceError(message, { reason: 'http', code, status })
}

function findOwnedSession(data: MockData, ownerKey: string, sessionId: string): MockSessionRecord {
  const session = data.sessions.find((candidate) => candidate.id === sessionId)
  if (!session || session.ownerKey !== ownerKey) {
    throw domainError('Переговорная сессия не найдена.', 'SESSION_NOT_FOUND', 404)
  }
  return session
}

function toSession(record: MockSessionRecord): NegotiationSession {
  return {
    id: record.id,
    caseId: record.caseId,
    mode: record.mode,
    status: record.status,
    startedAt: record.startedAt,
    ...(record.finishedAt ? { finishedAt: record.finishedAt } : {}),
    messages: clone(record.messages).sort((left, right) => left.sequence - right.sequence),
  }
}

function appendMessage(
  session: MockSessionRecord,
  speaker: MessageSpeaker,
  text: string,
): NegotiationMessage {
  const message: NegotiationMessage = {
    id: crypto.randomUUID(),
    sequence: session.nextSequence,
    speaker,
    text,
    createdAt: new Date().toISOString(),
  }
  session.nextSequence += 1
  session.messages.push(message)
  return message
}

function createResult(session: MockSessionRecord): NegotiationResult {
  const userTurns = session.messages.filter((message) => message.speaker === 'user').length
  const outcome = userTurns >= 2 ? 'agreement' : 'no-agreement'
  const publicSession = toSession(session)
  return {
    sessionId: session.id,
    source: 'mock',
    ...createMockResultAnalysis(publicSession, outcome),
  }
}

export interface ConsumedAudioTicket {
  ownerKey: string
  sessionId: string
  caseId: string
}

export interface AudioCommitResult {
  message: NegotiationMessage
  duplicated: boolean
}

export class MockRuntime {
  constructor(readonly storage: MockStorage) {}

  createSession(ownerKey: string, input: {
    caseId: string
    mode: 'text' | 'voice'
    clientCommandId: string
  }): Promise<NegotiationSession> {
    return this.storage.mutate((data) => {
      const existing = data.sessions.find(
        (session) => session.ownerKey === ownerKey && session.createCommandId === input.clientCommandId,
      )
      if (existing) return toSession(existing)

      const record: MockSessionRecord = {
        id: crypto.randomUUID(),
        ownerKey,
        caseId: input.caseId,
        mode: input.mode,
        status: 'active',
        startedAt: new Date().toISOString(),
        messages: [],
        nextSequence: 1,
        createCommandId: input.clientCommandId,
        textTurns: {},
        finishCommands: {},
        audioEvents: {},
      }
      data.sessions.push(record)
      return toSession(record)
    })
  }

  getSession(ownerKey: string, sessionId: string): NegotiationSession {
    return this.storage.read((data) => toSession(findOwnedSession(data as MockData, ownerKey, sessionId)))
  }

  sendTextTurn(ownerKey: string, input: {
    sessionId: string
    text: string
    clientTurnId: string
  }): Promise<{ userMessage: NegotiationMessage; aiMessage: NegotiationMessage; sessionStatus: 'active' | 'finishing' | 'finished' }> {
    return this.storage.mutate((data) => {
      const session = findOwnedSession(data, ownerKey, input.sessionId)
      const existing = session.textTurns[input.clientTurnId]
      if (existing) {
        const userMessage = session.messages.find((message) => message.id === existing.userMessageId)
        const aiMessage = session.messages.find((message) => message.id === existing.aiMessageId)
        if (!userMessage || !aiMessage) {
          throw domainError('Сохранённый ход повреждён.', 'CORRUPTED_TEXT_TURN', 500)
        }
        return { userMessage: clone(userMessage), aiMessage: clone(aiMessage), sessionStatus: session.status }
      }
      if (session.status !== 'active') {
        throw domainError('Нельзя отправить сообщение в завершённую сессию.', 'SESSION_NOT_ACTIVE', 409)
      }
      const text = input.text.trim()
      if (!text) throw domainError('Введите сообщение.', 'EMPTY_TEXT', 422)

      const turnNumber = session.messages.filter((message) => message.speaker === 'user').length + 1
      const userMessage = appendMessage(session, 'user', text)
      const aiMessage = appendMessage(session, 'ai', getMockAiResponse(session.caseId, turnNumber))
      session.textTurns[input.clientTurnId] = {
        userMessageId: userMessage.id,
        aiMessageId: aiMessage.id,
      }
      return {
        userMessage: clone(userMessage),
        aiMessage: clone(aiMessage),
        sessionStatus: session.status,
      }
    })
  }

  createAudioTicket(ownerKey: string, sessionId: string): Promise<AudioTicket> {
    return this.storage.mutate((data) => {
      const session = findOwnedSession(data, ownerKey, sessionId)
      if (session.status !== 'active' || session.mode !== 'voice') {
        throw domainError('Голосовое подключение недоступно для этой сессии.', 'AUDIO_NOT_AVAILABLE', 409)
      }
      const expiresAt = new Date(Date.now() + AUDIO_TICKET_LIFETIME_MS).toISOString()
      const ticket = `mock_${crypto.randomUUID()}`
      data.audioTickets.push({ ticket, ownerKey, sessionId, expiresAt, used: false })
      return { ticket, expiresAt, protocol: 'audio-engine.v1' as const }
    })
  }

  consumeAudioTicket(sessionId: string, value: AudioTicket): Promise<ConsumedAudioTicket> {
    return this.storage.mutate((data) => {
      const ticket = data.audioTickets.find((candidate) => candidate.ticket === value.ticket)
      if (
        !ticket
        || ticket.used
        || ticket.sessionId !== sessionId
        || ticket.expiresAt !== value.expiresAt
        || value.protocol !== 'audio-engine.v1'
        || Date.parse(ticket.expiresAt) <= Date.now()
      ) {
        throw new ServiceError('Audio ticket истёк или уже был использован.', {
          reason: 'expired-audio-ticket',
          code: 'AUDIO_TICKET_EXPIRED',
          recoverable: true,
        })
      }
      const session = findOwnedSession(data, ticket.ownerKey, sessionId)
      if (session.mode !== 'voice' || session.status !== 'active') {
        throw domainError('Голосовая сессия уже завершена.', 'AUDIO_SESSION_NOT_ACTIVE', 409)
      }
      ticket.used = true
      return { ownerKey: ticket.ownerKey, sessionId, caseId: session.caseId }
    })
  }

  commitAudioMessage(input: {
    ownerKey: string
    sessionId: string
    eventId: string
    speaker: MessageSpeaker
    text: string
  }): Promise<AudioCommitResult> {
    return this.storage.mutate((data) => {
      const session = findOwnedSession(data, input.ownerKey, input.sessionId)
      if (session.mode !== 'voice') {
        throw domainError('Audio-событие не относится к голосовой сессии.', 'AUDIO_MODE_REQUIRED', 409)
      }
      const existingMessageId = session.audioEvents[input.eventId]
      if (existingMessageId) {
        const existing = session.messages.find((message) => message.id === existingMessageId)
        if (!existing) throw domainError('Сохранённое audio-событие повреждено.', 'CORRUPTED_AUDIO_EVENT', 500)
        return { message: clone(existing), duplicated: true }
      }
      if (session.status !== 'active') {
        throw domainError('Нельзя сохранить реплику в завершённую сессию.', 'SESSION_NOT_ACTIVE', 409)
      }
      const message = appendMessage(session, input.speaker, input.text.trim())
      session.audioEvents[input.eventId] = message.id
      return { message: clone(message), duplicated: false }
    })
  }

  finishSession(ownerKey: string, sessionId: string, commandId: string, processingMs: number): Promise<NegotiationResultState> {
    return this.storage.mutate((data) => {
      const session = findOwnedSession(data, ownerKey, sessionId)
      const existingResult = data.results.find((result) => result.sessionId === sessionId)
      if (session.finishCommands[commandId] && existingResult) return this.resolveResult(data, session, existingResult)
      if (session.status === 'finished' && existingResult) return this.resolveResult(data, session, existingResult)

      session.finishCommands[commandId] = true
      session.status = 'finishing'
      const resultRecord = existingResult ?? {
        sessionId,
        status: 'processing' as const,
        readyAt: Date.now() + processingMs,
      }
      if (!existingResult) data.results.push(resultRecord)
      return this.resolveResult(data, session, resultRecord)
    })
  }

  getResult(ownerKey: string, sessionId: string): Promise<NegotiationResultState> {
    return this.storage.mutate((data) => {
      const session = findOwnedSession(data, ownerKey, sessionId)
      const result = data.results.find((candidate) => candidate.sessionId === sessionId)
      if (!result) throw domainError('Результат ещё не создан.', 'RESULT_NOT_FOUND', 404)
      return this.resolveResult(data, session, result)
    })
  }

  private resolveResult(
    _data: MockData,
    session: MockSessionRecord,
    record: MockData['results'][number],
  ): NegotiationResultState {
    if (record.status === 'processing' && Date.now() >= record.readyAt) {
      record.status = 'ready'
      record.result = createResult(session)
      session.status = 'finished'
      session.finishedAt ??= new Date().toISOString()
    }
    if (record.status === 'ready' && record.result) return { status: 'ready', result: clone(record.result) }
    if (record.status === 'failed') return { status: 'failed', message: record.message ?? 'Не удалось подготовить результат.' }
    return { status: 'processing' }
  }
}

export { toSession }
