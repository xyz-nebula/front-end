import { createContext, useContext } from 'react'

import type { AuthClient } from '@/services/contracts/authClient'
import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { ServiceConfig } from '@/services/config'

export type RunAuthorized = <T>(operation: (accessToken: string) => Promise<T>) => Promise<T>

export interface DomainAdapterContext {
  runAuthorized: RunAuthorized
  mockOwnerKey: string | null
}

export interface ServiceAdapters {
  config: ServiceConfig
  authClient: AuthClient
  createNegotiationClient: (context: DomainAdapterContext) => NegotiationClient
  createAudioClient: (context: DomainAdapterContext) => AudioClient
}

export const ServiceAdaptersContext = createContext<ServiceAdapters | null>(null)

export function useServiceAdapters(): ServiceAdapters {
  const context = useContext(ServiceAdaptersContext)
  if (!context) {
    throw new Error('useServiceAdapters must be used inside ServiceAdaptersProvider')
  }
  return context
}
