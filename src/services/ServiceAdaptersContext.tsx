import { useMemo, type ReactNode } from 'react'

import { parseServiceConfig } from '@/services/config'
import { MockAudioClient } from '@/services/mock/mockAudioClient'
import { MockAuthClient } from '@/services/mock/mockAuthClient'
import { MockNegotiationClient } from '@/services/mock/mockNegotiationClient'
import { MockRuntime } from '@/services/mock/mockRuntime'
import { MockStorage } from '@/services/mock/mockStorage'
import { AudioEngineClient } from '@/services/real/audioEngineClient'
import { BackendAuthClient } from '@/services/real/backendAuthClient'
import { BackendNegotiationClient } from '@/services/real/backendNegotiationClient'
import {
  ServiceAdaptersContext,
  type ServiceAdapters,
} from '@/services/serviceAdapters'

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
    const mockStorage = new MockStorage()
    const mockRuntime = new MockRuntime(mockStorage)
    const authClient = config.authSource === 'real'
      ? new BackendAuthClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs })
      : new MockAuthClient(mockStorage, config.mockLatencyMs)

    return {
      config,
      authClient,
      createNegotiationClient: (context) => {
        return config.negotiationSource === 'real'
          ? new BackendNegotiationClient(context.runAuthorized, {
              baseUrl: config.apiBaseUrl,
              timeoutMs: config.apiTimeoutMs,
            })
          : new MockNegotiationClient(mockRuntime, context.mockOwnerKey, config.mockLatencyMs)
      },
      createAudioClient: () => config.audioSource === 'real'
        ? new AudioEngineClient()
        : new MockAudioClient(mockRuntime, { latencyMs: config.mockLatencyMs }),
    }
  }, [])

  return (
    <ServiceAdaptersContext.Provider value={value}>
      {children}
    </ServiceAdaptersContext.Provider>
  )
}
