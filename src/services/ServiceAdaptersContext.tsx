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

function createRealAdapters(config: ServiceAdapters['config']): ServiceAdapters {
  return {
    config,
    capabilities: { supportsTextNegotiation: false },
    authClient: new BackendAuthClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.apiTimeoutMs }),
    createNegotiationClient: ({ runAuthorized }) => new BackendNegotiationClient(runAuthorized, {
      baseUrl: config.apiBaseUrl,
      timeoutMs: config.apiTimeoutMs,
    }),
    createAudioClient: ({ runAuthorized }) => new AudioEngineClient({
      wsPath: config.audioWsUrl,
      runAuthorized,
    }),
  }
}

function createMockAdapters(config: ServiceAdapters['config']): ServiceAdapters {
  const storage = new MockStorage()
  const runtime = new MockRuntime(storage)

  return {
    config,
    capabilities: { supportsTextNegotiation: true },
    authClient: new MockAuthClient(storage, config.mockLatencyMs),
    createNegotiationClient: ({ mockOwnerKey }) => new MockNegotiationClient(
      runtime,
      mockOwnerKey,
      config.mockLatencyMs,
    ),
    createAudioClient: () => new MockAudioClient(runtime, { latencyMs: config.mockLatencyMs }),
  }
}

export function ServiceAdaptersProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ServiceAdapters>(() => {
    const config = parseServiceConfig({
      VITE_SERVICE_MODE: import.meta.env.VITE_SERVICE_MODE,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_TIMEOUT_MS: import.meta.env.VITE_API_TIMEOUT_MS,
      VITE_MOCK_LATENCY_MS: import.meta.env.VITE_MOCK_LATENCY_MS,
      VITE_AUDIO_WS_URL: import.meta.env.VITE_AUDIO_WS_URL,
    })
    return config.mode === 'real' ? createRealAdapters(config) : createMockAdapters(config)
  }, [])

  return (
    <ServiceAdaptersContext.Provider value={value}>
      {children}
    </ServiceAdaptersContext.Provider>
  )
}
