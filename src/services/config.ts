import { ServiceError } from '@/types/api'

export type ServiceSource = 'mock' | 'real'

export interface ServiceConfig {
  authSource: ServiceSource
  negotiationSource: ServiceSource
  audioSource: ServiceSource
  apiBaseUrl: string
  apiTimeoutMs: number
  mockLatencyMs: number
  audioWsUrl: string
}

export type ServiceEnv = Partial<Record<
  | 'VITE_AUTH_SOURCE'
  | 'VITE_NEGOTIATION_SOURCE'
  | 'VITE_AUDIO_SOURCE'
  | 'VITE_API_BASE_URL'
  | 'VITE_API_TIMEOUT_MS'
  | 'VITE_MOCK_LATENCY_MS'
  | 'VITE_AUDIO_WS_URL',
  string
>>

function invalidConfig(message: string): never {
  throw new ServiceError(message, {
    reason: 'invalid-response',
    code: 'INVALID_SERVICE_CONFIG',
  })
}

function parseSource(name: string, value: string | undefined): ServiceSource {
  if (value === 'mock' || value === 'real') return value
  return invalidConfig(`${name} must be explicitly set to "mock" or "real".`)
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return invalidConfig(`${name} must be a positive integer.`)
  }
  return parsed
}

function parseWsUrl(value: string | undefined): string {
  const candidate = value || 'ws://localhost:8000/v1/audio-stream'
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('invalid protocol')
    return url.toString()
  } catch {
    return invalidConfig('VITE_AUDIO_WS_URL must be an absolute ws:// or wss:// URL.')
  }
}

export function parseServiceConfig(env: ServiceEnv): ServiceConfig {
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api'
  if (!apiBaseUrl.startsWith('/') && !/^https?:\/\//.test(apiBaseUrl)) {
    return invalidConfig('VITE_API_BASE_URL must be relative to the origin or an HTTP(S) URL.')
  }

  return {
    authSource: parseSource('VITE_AUTH_SOURCE', env.VITE_AUTH_SOURCE),
    negotiationSource: parseSource('VITE_NEGOTIATION_SOURCE', env.VITE_NEGOTIATION_SOURCE),
    audioSource: parseSource('VITE_AUDIO_SOURCE', env.VITE_AUDIO_SOURCE),
    apiBaseUrl: apiBaseUrl.replace(/\/$/, '') || '/',
    apiTimeoutMs: parsePositiveInteger('VITE_API_TIMEOUT_MS', env.VITE_API_TIMEOUT_MS, 20_000),
    mockLatencyMs: parsePositiveInteger('VITE_MOCK_LATENCY_MS', env.VITE_MOCK_LATENCY_MS, 350),
    audioWsUrl: parseWsUrl(env.VITE_AUDIO_WS_URL),
  }
}
