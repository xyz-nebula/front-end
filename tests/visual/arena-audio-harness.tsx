import { act, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { ArenaConversation } from '@/components/arena/ArenaConversation'
import { useArenaAudio } from '@/features/arena/useArenaAudio'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { DomainServicesContext } from '@/services/domainServices'
import type { AudioConnectionState, AudioControlAction, AudioEngineEvent, AudioInputFrame } from '@/types/audio'
import type { AudioTicket, NegotiationMessage } from '@/types/negotiation'

type AudioValue = ReturnType<typeof useArenaAudio>

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

class TestAudioClient implements AudioClient {
  readonly requiresTicket = true
  state: AudioConnectionState = 'idle'
  connectCalls: Array<{ sessionId: string; ticket: string }> = []
  disconnectCalls = 0
  activeEventListeners = new Set<(event: AudioEngineEvent) => void>()
  activeStateListeners = new Set<(state: AudioConnectionState) => void>()
  allEventListeners: Array<(event: AudioEngineEvent) => void> = []

  getState() { return this.state }
  async connect(input: { sessionId: string; ticket: AudioTicket }) {
    this.connectCalls.push({ sessionId: input.sessionId, ticket: input.ticket })
    this.emitState('connected')
  }
  sendAudio(frame: AudioInputFrame) { void frame }
  sendControl(action: AudioControlAction) { void action }
  subscribe(listener: (event: AudioEngineEvent) => void) {
    this.activeEventListeners.add(listener)
    this.allEventListeners.push(listener)
    return () => { this.activeEventListeners.delete(listener) }
  }
  subscribeState(listener: (state: AudioConnectionState) => void) {
    this.activeStateListeners.add(listener)
    return () => { this.activeStateListeners.delete(listener) }
  }
  async disconnect() { this.disconnectCalls += 1 }
  emit(event: AudioEngineEvent) { this.activeEventListeners.forEach((listener) => listener(event)) }
  emitStale(event: AudioEngineEvent) { this.allEventListeners.forEach((listener) => listener(event)) }
  emitState(state: AudioConnectionState) {
    this.state = state
    this.activeStateListeners.forEach((listener) => listener(state))
  }
}

function negotiationClient(createAudioTicket: (sessionId: string) => Promise<AudioTicket>): NegotiationClient {
  const unavailable = async (): Promise<never> => { throw new Error('Unexpected negotiation call') }
  return {
    createSession: unavailable,
    getSession: unavailable,
    activateSession: async () => undefined,
    sendTextTurn: unavailable,
    createAudioTicket,
    finishSession: unavailable,
    getResult: unavailable,
    listSessions: unavailable,
  }
}

function ticket(value: string): AudioTicket {
  return { ticket: value, expiresAt: '2026-09-23T09:00:00.000Z', protocol: 'audio-engine.v1' }
}

function message(id: string, text: string, speaker: NegotiationMessage['speaker'] = 'ai'): NegotiationMessage {
  return { id, sequence: 1, speaker, text, createdAt: '2026-09-23T08:00:00.000Z' }
}

interface RenderInput {
  sessionId: string
  negotiationClient: NegotiationClient
  createAudioClient: () => AudioClient
  onReconnect: () => Promise<void>
}

export async function runAudioContextScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const clientA = new TestAudioClient()
  const clientB = new TestAudioClient()
  const clientForNewUser = new TestAudioClient()
  const reconnectA = deferred<void>()
  const reconnectB = deferred<void>()
  let reconnectBCalls = 0
  let latest: AudioValue | null = null
  const committed: string[] = []
  const ticketsB: string[] = []
  const clientAService = negotiationClient(() => Promise.resolve(ticket('ticket-a')))
  const clientBService = negotiationClient(() => {
    const value = `ticket-b-${ticketsB.length + 1}`
    ticketsB.push(value)
    return Promise.resolve(ticket(value))
  })

  function Probe({ input }: { input: RenderInput }) {
    const value = useArenaAudio(
      input.sessionId,
      true,
      (next) => { committed.push(next.id) },
      input.onReconnect,
    )
    useLayoutEffect(() => { latest = value }, [value])
    return null
  }

  const render = async (input: RenderInput) => {
    await act(async () => {
      root.render(
        <DomainServicesContext.Provider value={{
          negotiationClient: input.negotiationClient,
          createAudioClient: input.createAudioClient,
        }}>
          <Probe input={input} />
        </DomainServicesContext.Provider>,
      )
    })
  }
  const value = () => {
    if (!latest) throw new Error('Audio harness has not rendered')
    return latest
  }

  await render({
    sessionId: 'arena-a', negotiationClient: clientAService,
    createAudioClient: () => clientA, onReconnect: () => reconnectA.promise,
  })
  await act(async () => { void value().connect() })
  await act(async () => {
    clientA.emit({ type: 'transcript_partial', speaker: 'user', text: 'Старая реплика' })
  })

  await render({
    sessionId: 'arena-b', negotiationClient: clientBService,
    createAudioClient: () => clientB,
    onReconnect: () => { reconnectBCalls += 1; return reconnectB.promise },
  })
  await act(async () => { void value().connect() })
  await act(async () => { reconnectA.resolve(); await Promise.resolve() })
  await act(async () => { void value().connect() })
  const whileBConnects = {
    reconnectBCalls,
    partial: value().partial,
    clientAConnects: clientA.connectCalls.length,
  }

  await act(async () => {
    clientA.emitStale({ type: 'message_committed', eventId: 'late-a', message: message('message-a', 'Поздняя A') })
    clientA.emitStale({ type: 'transcript_partial', speaker: 'ai', text: 'Поздний partial A' })
  })
  await act(async () => { reconnectB.resolve(); await Promise.resolve(); await Promise.resolve() })
  await act(async () => {
    clientB.emit({ type: 'message_committed', eventId: 'b-1', message: message('message-b', 'Ответ B') })
    clientB.emit({ type: 'message_committed', eventId: 'b-duplicate', message: message('message-b', 'Ответ B') })
  })

  await act(async () => { await value().connect() })
  const afterReconnect = {
    ticketsB,
    committed: [...committed],
    clientADisconnects: clientA.disconnectCalls,
    clientAListeners: clientA.activeEventListeners.size + clientA.activeStateListeners.size,
  }

  const newUserService = negotiationClient(() => Promise.resolve(ticket('ticket-new-user')))
  await render({
    sessionId: 'arena-b', negotiationClient: newUserService,
    createAudioClient: () => clientForNewUser, onReconnect: () => Promise.resolve(),
  })
  const afterUserChange = {
    clientBDisconnects: clientB.disconnectCalls,
    clientBListeners: clientB.activeEventListeners.size + clientB.activeStateListeners.size,
  }
  await act(async () => root.unmount())
  const afterUnmount = {
    disconnects: clientForNewUser.disconnectCalls,
    listeners: clientForNewUser.activeEventListeners.size + clientForNewUser.activeStateListeners.size,
  }
  host.remove()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

  return { whileBConnects, afterReconnect, afterUserChange, afterUnmount }
}

export async function runTranscriptStreamingScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const audioClient = new TestAudioClient()
  let latest: AudioValue | null = null

  function Probe() {
    const [messages, setMessages] = useState<NegotiationMessage[]>([])
    const value = useArenaAudio(
      'streaming-arena',
      true,
      (next) => setMessages((current) => [...current.filter((item) => item.id !== next.id), next]),
      async () => null,
    )
    useLayoutEffect(() => { latest = value }, [value])
    return <ArenaConversation messages={messages} opponent="Оппонент" isThinking={false} mode="voice" partial={value.partial} />
  }

  await act(async () => {
    root.render(
      <DomainServicesContext.Provider value={{
        negotiationClient: negotiationClient(() => Promise.resolve(ticket('streaming-ticket'))),
        createAudioClient: () => audioClient,
      }}>
        <Probe />
      </DomainServicesContext.Provider>,
    )
  })
  const value = () => {
    if (!latest) throw new Error('Streaming harness has not rendered')
    return latest
  }
  const wait = async (milliseconds: number) => {
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, milliseconds)) })
  }

  await act(async () => {
    audioClient.emit({ type: 'transcript_delta', speaker: 'ai', text: 'Доб' })
    audioClient.emit({ type: 'transcript_delta', speaker: 'ai', text: 'рый' })
    audioClient.emit({ type: 'transcript_delta', speaker: 'ai', text: ' ' })
    audioClient.emit({ type: 'transcript_delta', speaker: 'ai', text: 'день' })
  })
  await wait(45)
  const duringDelta = {
    displayed: value().partial.ai?.text,
    target: value().partial.ai?.targetText,
    bubbles: host.querySelectorAll('.arena-message').length,
    hasEmptyState: Boolean(host.querySelector('.arena-conversation__empty')),
  }

  await act(async () => {
    audioClient.emit({
      type: 'message_committed', eventId: 'committed-ai',
      message: message('streamed-ai', 'Добрый день'),
    })
  })
  const immediatelyAfterCommit = {
    displayed: value().partial.ai?.text,
    phase: value().partial.ai?.phase,
    bubbles: host.querySelectorAll('.arena-message').length,
  }
  await wait(300)
  const afterCommit = {
    partial: value().partial.ai,
    texts: Array.from(host.querySelectorAll('.arena-message p'), (node) => node.textContent),
    bubbles: host.querySelectorAll('.arena-message').length,
  }

  await act(async () => {
    audioClient.emit({ type: 'transcript_partial', speaker: 'user', text: 'Моя реплика' })
  })
  await wait(45)
  const userSnapshot = {
    displayed: value().partial.user?.text,
    target: value().partial.user?.targetText,
  }

  await act(async () => root.unmount())
  host.remove()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  return { duringDelta, immediatelyAfterCommit, afterCommit, userSnapshot }
}
