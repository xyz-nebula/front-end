import { createContext, useContext } from 'react'

import type { AudioClient } from '@/services/contracts/audioClient'
import type { NegotiationClient } from '@/services/contracts/negotiationClient'

export interface DomainServices {
  negotiationClient: NegotiationClient
  createAudioClient: () => AudioClient
  isRealVoice: boolean
}

export const DomainServicesContext = createContext<DomainServices | null>(null)

export function useDomainServices(): DomainServices {
  const context = useContext(DomainServicesContext)
  if (!context) throw new Error('useDomainServices must be used inside DomainServicesProvider')
  return context
}
