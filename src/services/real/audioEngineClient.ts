import type { AudioClient } from '@/services/contracts/audioClient'
import type { RunAuthorized } from '@/services/serviceAdapters'
import {
  parseAudioEngineEvent,
  toAudioControlDto,
  toAudioInputDto,
} from '@/services/real/targetContract'
import type {
  AudioConnectionState,
  AudioControlAction,
  AudioEngineEvent,
  AudioInputFrame,
} from '@/types/audio'
import { isServiceError, ServiceError } from '@/types/api'

interface AudioEngineClientOptions {
  wsPath: string
  runAuthorized: RunAuthorized
  createSocket?: (url: string) => WebSocket
}

type EventListener = (event: AudioEngineEvent) => void
type StateListener = (state: AudioConnectionState) => void

const MAX_BUFFERED_BYTES = 1024 * 1024

function unauthorized(message: string, code: string): ServiceError {
  return new ServiceError(message, { reason: 'http', status: 401, code, recoverable: true })
}

export class AudioEngineClient implements AudioClient {
  readonly requiresTicket = false
  readonly acceptsAudioInput = true
  private state: AudioConnectionState = 'idle'
  private readonly eventListeners = new Set<EventListener>()
  private readonly stateListeners = new Set<StateListener>()
  private readonly createSocket: (url: string) => WebSocket
  private socket: WebSocket | null = null
  private generation = 0
  private manualClose = false
  private authRefreshAttempted = false

  constructor(private readonly options?: AudioEngineClientOptions) {
    this.createSocket = options?.createSocket ?? ((url) => new WebSocket(url))
  }

  getState(): AudioConnectionState { return this.state }

  private setState(state: AudioConnectionState): void {
    if (this.state === state) return
    this.state = state
    for (const listener of this.stateListeners) listener(state)
  }

  private emit(event: AudioEngineEvent): void {
    for (const listener of this.eventListeners) listener(event)
  }

  private socketUrl(accessToken: string): string {
    if (!this.options) throw new ServiceError('Голосовой сервис не настроен.', {
      reason: 'feature-unavailable', code: 'AUDIO_FEATURE_UNAVAILABLE',
    })
    const url = new URL(this.options.wsPath, window.location.href)
    url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('token', accessToken)
    return url.toString()
  }

  private async open(accessToken: string, generation: number): Promise<void> {
    const socket = this.createSocket(this.socketUrl(accessToken))
    this.socket = socket
    await new Promise<void>((resolve, reject) => {
      let opened = false
      socket.onopen = () => {
        if (generation !== this.generation || this.socket !== socket) {
          socket.close(1000, 'stale connection')
          return
        }
        opened = true
        this.setState('connected')
        resolve()
      }
      socket.onmessage = (message) => {
        if (generation !== this.generation || this.socket !== socket) return
        try {
          const parsed: unknown = JSON.parse(String(message.data))
          const event = parseAudioEngineEvent(parsed)
          if (event.type === 'transcript_delta' || event.type === 'audio_frame') {
            this.emit(event)
          } else if (event.type === 'error') {
            this.emit({ ...event, recoverable: true })
          } else {
            this.emit(event)
            void this.reconnectAfterAuthError(accessToken, generation, event)
          }
        } catch (error) {
          this.emit({
            type: 'error', code: 'INVALID_AUDIO_EVENT',
            message: error instanceof Error ? error.message : 'Некорректное сообщение голосового сервиса.',
            recoverable: false,
          })
        }
      }
      socket.onerror = () => {
        if (!opened) {
          reject(new ServiceError('Не удалось подключиться к голосовому сервису.', {
            reason: 'network', code: 'AUDIO_CONNECTION_FAILED', recoverable: true,
          }))
        }
      }
      socket.onclose = (event) => {
        if (generation !== this.generation || this.socket !== socket) return
        this.socket = null
        const reconnectAllowed = !this.manualClose && event.code !== 1000
        this.emit({ type: 'closed', code: event.code, reason: event.reason || 'connection_closed', reconnectAllowed })
        if (this.state !== 'reconnecting') this.setState(this.manualClose ? 'idle' : 'error')
        if (!opened) {
          reject(new ServiceError('Голосовой сервис закрыл соединение.', {
            reason: 'websocket-close', code: 'AUDIO_SOCKET_CLOSED', recoverable: reconnectAllowed,
          }))
        }
      }
    })
  }

  private async reconnectAfterAuthError(
    rejectedToken: string,
    generation: number,
    event: Extract<ReturnType<typeof parseAudioEngineEvent>, { type: 'auth_error' }>,
  ): Promise<void> {
    if (!this.options || this.authRefreshAttempted || generation !== this.generation) {
      this.setState('error')
      return
    }
    this.authRefreshAttempted = true
    this.setState('reconnecting')
    this.socket?.close(1000, 'refreshing credentials')
    try {
      await this.options.runAuthorized(async (accessToken) => {
        if (accessToken === rejectedToken) throw unauthorized(event.message, event.code)
        await this.open(accessToken, generation)
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.setState('error')
      this.emit({
        type: 'error', code: isServiceError(error) ? (error.code ?? 'AUDIO_AUTH_FAILED') : 'AUDIO_AUTH_FAILED',
        message: 'Не удалось обновить голосовое подключение. Подключитесь снова.', recoverable: true,
      })
    }
  }

  async connect(): Promise<void> {
    if (!this.options) {
      throw new ServiceError('Голосовой режим пока недоступен в real-режиме.', {
        reason: 'feature-unavailable', code: 'AUDIO_FEATURE_UNAVAILABLE',
      })
    }
    const reconnecting = this.state !== 'idle'
    const generation = ++this.generation
    this.manualClose = false
    this.authRefreshAttempted = false
    this.socket?.close(1000, 'replaced connection')
    this.setState(reconnecting ? 'reconnecting' : 'connecting')
    try {
      await this.options.runAuthorized((accessToken) => this.open(accessToken, generation))
    } catch (error) {
      if (generation === this.generation) this.setState('error')
      throw error
    }
  }

  sendAudio(frame: AudioInputFrame | string): void {
    if (!this.options) {
      throw new ServiceError('Голосовой режим пока недоступен в real-режиме.', {
        reason: 'feature-unavailable', code: 'AUDIO_FEATURE_UNAVAILABLE',
      })
    }
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN || this.state !== 'connected') {
      throw new ServiceError('Голосовое подключение не установлено.', {
        reason: 'websocket-close', code: 'AUDIO_NOT_CONNECTED', recoverable: true,
      })
    }
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.setState('error')
      socket.close(1009, 'audio backpressure')
      throw new ServiceError('Соединение не успевает передавать звук. Подключитесь снова.', {
        reason: 'websocket-close', code: 'AUDIO_BACKPRESSURE', recoverable: true,
      })
    }
    socket.send(JSON.stringify(toAudioInputDto(typeof frame === 'string' ? frame : frame.payload)))
  }

  sendControl(action: AudioControlAction): void {
    if (!this.options) {
      throw new ServiceError('Голосовой режим пока недоступен в real-режиме.', {
        reason: 'feature-unavailable', code: 'AUDIO_FEATURE_UNAVAILABLE',
      })
    }
    const socket = this.socket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new ServiceError('Голосовое подключение не установлено.', {
        reason: 'websocket-close', code: 'AUDIO_NOT_CONNECTED', recoverable: true,
      })
    }
    socket.send(JSON.stringify(toAudioControlDto(action)))
    if (action === 'pause') this.setState('paused')
    if (action === 'resume') this.setState('connected')
    if (action === 'stop' || action === 'close') this.setState('stopped')
  }

  subscribe(listener: EventListener): () => void {
    this.eventListeners.add(listener)
    return () => { this.eventListeners.delete(listener) }
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => { this.stateListeners.delete(listener) }
  }

  async disconnect(): Promise<void> {
    this.manualClose = true
    this.generation += 1
    const socket = this.socket
    this.socket = null
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'client disconnect')
    this.setState('idle')
  }
}
