import { useMemo, type ReactNode } from 'react'

import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { parseServiceConfig } from '@/services/config'
import { AudioEngineClient } from '@/services/real/audioEngineClient'
import { BackendAuthClient } from '@/services/real/backendAuthClient'
import { BackendNegotiationClient } from '@/services/real/backendNegotiationClient'
import {
  ServiceAdaptersContext,
  type ServiceAdapters,
} from '@/services/serviceAdapters'
import type { AuthClient } from '@/services/contracts/authClient'
import { ServiceError, featureUnavailable } from '@/types/api'

function pendingMockAuthClient(): AuthClient {
  const unavailable = (): never => {
    throw new ServiceError('Mock-аутентификация будет подключена на этапе 3.', {
      reason: 'feature-unavailable',
      code: 'MOCK_AUTH_PENDING',
    })
  }

  return {
    register: async () => unavailable(),
    activate: async () => unavailable(),
    login: async () => unavailable(),
    refresh: async () => unavailable(),
    logout: async () => unavailable(),
    enrollTotp: async () => unavailable(),
    confirmTotp: async () => unavailable(),
    disableTotp: async () => unavailable(),
  }
}

function pendingMockNegotiationClient(): NegotiationClient {
  const unavailable = (): never => {
    throw featureUnavailable('negotiation')
  }

  return {
    createSession: async () => unavailable(),
    getSession: async () => unavailable(),
    sendTextTurn: async () => unavailable(),
    createAudioTicket: async () => unavailable(),
    finishSession: async () => unavailable(),
    getResult: async () => unavailable(),
    listSessions: async () => unavailable(),
  }
}

function pendingMockAudioClient(): AudioClient {
  const unavailable = (): never => {
    throw featureUnavailable('audio')
  }

  return {
    getState: () => 'idle',
    connect: async () => unavailable(),
    sendAudio: () => unavailable(),
    sendControl: () => unavailable(),
    subscribe: () => () => undefined,
    subscribeState: () => () => undefined,
    disconnect: async () => undefined,
  }
}

export function ServiceAdaptersProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ServiceAdapters>(() => {
    const config = parseServiceConfig({
      VITE_AUTH_SOURCE: import.meta.env.VITE_AUTH_SOURCE,
      VITE_NEGOTIATION_SOURCE: import.meta.env.VITE_NEGOTIATION_SOURCE,
      VITE_AUDIO_SOURCE: import.meta.env.VITE_AUDIO_SOURCE,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_TIMEOUT_MS: import.meta.env.VITE_API_TIMEOUT_MS,
      VITE_MOCK_LATENCY_MS: import.meta.env.VITE_MOCK_LATENCY_MS,
      VITE_AUDIO_WS_URL: import.meta.env.VITE_AUDIO_WS_URL,
    })
    const authClient = config.authSource === 'real'
      ? new BackendAuthClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs })
      : pendingMockAuthClient()

    return {
      config,
      authClient,
      createNegotiationClient: (context) => {
        return config.negotiationSource === 'real'
          ? new BackendNegotiationClient(context.runAuthorized)
          : pendingMockNegotiationClient()
      },
      createAudioClient: () => config.audioSource === 'real'
        ? new AudioEngineClient()
        : pendingMockAudioClient(),
    }
  }, [])

  return (
    <ServiceAdaptersContext.Provider value={value}>
      {children}
    </ServiceAdaptersContext.Provider>
  )
}
