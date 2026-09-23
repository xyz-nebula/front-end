export type ApiErrorReason =
  | 'http'
  | 'network'
  | 'timeout'
  | 'invalid-response'
  | 'feature-unavailable'

export type ClientErrorReason =
  | ApiErrorReason
  | 'expired-audio-ticket'
  | 'websocket-close'
  | 'local-ai'
  | 'microphone-denied'

export interface ServiceErrorOptions {
  reason: ClientErrorReason
  status?: number
  code?: string
  field?: string
  recoverable?: boolean
  cause?: unknown
}

export class ServiceError extends Error {
  readonly reason: ClientErrorReason
  readonly status?: number
  readonly code?: string
  readonly field?: string
  readonly recoverable: boolean

  constructor(message: string, options: ServiceErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'ServiceError'
    this.reason = options.reason
    this.status = options.status
    this.code = options.code
    this.field = options.field
    this.recoverable = options.recoverable ?? false
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}

export function featureUnavailable(feature: 'negotiation' | 'audio'): ServiceError {
  const message = feature === 'negotiation'
    ? 'Переговоры пока недоступны в real-режиме.'
    : 'Голосовой режим пока недоступен в real-режиме.'
  return new ServiceError(message, {
    reason: 'feature-unavailable',
    code: `${feature.toUpperCase()}_FEATURE_UNAVAILABLE`,
  })
}

export const RETRY_POLICY = {
  read: 'new-attempt-allowed',
  command: 'reuse-original-id',
  audioReconnect: 'request-new-ticket',
} as const
