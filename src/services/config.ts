import { ServiceError } from '@/types/api'

export type ServiceMode = 'mock' | 'real'

export interface ServiceConfig {
  mode: ServiceMode
  apiBaseUrl: string
  apiTimeoutMs: number
  mockLatencyMs: number
  audioWsUrl: string
}

export type ServiceEnv = Partial<Record<
  | 'VITE_SERVICE_MODE'
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

function parseMode(value: string | undefined): ServiceMode {
  if (value === 'mock' || value === 'real') return value
  return invalidConfig('VITE_SERVICE_MODE must be explicitly set to "mock" or "real".')
}

function parsePositiveInteger(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return invalidConfig(`${name} must be a positive integer.`)
  }
  return parsed
}

function parseWsPath(value: string | undefined): string {
  const candidate = value || '/audio/v1/audio-stream'
  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return invalidConfig('VITE_AUDIO_WS_URL must be a same-origin path starting with "/".')
  }
  const parsed = new URL(candidate, 'https://arena.invalid')
  if (parsed.origin !== 'https://arena.invalid' || parsed.pathname !== candidate) {
    return invalidConfig('VITE_AUDIO_WS_URL must not contain an origin, query, or fragment.')
  }
  return candidate
}

export function parseServiceConfig(env: ServiceEnv): ServiceConfig {
  const apiBaseUrl = env.VITE_API_BASE_URL || '/api'
  if (!apiBaseUrl.startsWith('/') && !/^https?:\/\//.test(apiBaseUrl)) {
    return invalidConfig('VITE_API_BASE_URL must be relative to the origin or an HTTP(S) URL.')
  }

  return {
    mode: parseMode(env.VITE_SERVICE_MODE),
    apiBaseUrl: apiBaseUrl.replace(/\/$/, '') || '/',
    apiTimeoutMs: parsePositiveInteger('VITE_API_TIMEOUT_MS', env.VITE_API_TIMEOUT_MS, 20_000),
    mockLatencyMs: parsePositiveInteger('VITE_MOCK_LATENCY_MS', env.VITE_MOCK_LATENCY_MS, 350),
    audioWsUrl: parseWsPath(env.VITE_AUDIO_WS_URL),
  }
}
