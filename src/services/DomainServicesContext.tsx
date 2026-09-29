import { useMemo, type ReactNode } from 'react'

import { useAuthRuntime } from '@/auth/runtime'
import { DomainServicesContext, type DomainServices } from '@/services/domainServices'
import { useServiceAdapters } from '@/services/serviceAdapters'

export function DomainServicesProvider({ children }: { children: ReactNode }) {
  const { capabilities, config, createAudioClient, createNegotiationClient } = useServiceAdapters()
  const { mockOwnerKey, runAuthorized } = useAuthRuntime()
  const value = useMemo<DomainServices>(() => ({
    negotiationClient: createNegotiationClient({ mockOwnerKey, runAuthorized }),
    createAudioClient: () => createAudioClient({ mockOwnerKey, runAuthorized }),
    isRealVoice: config.mode === 'real',
    supportsTextNegotiation: capabilities.supportsTextNegotiation,
  }), [capabilities.supportsTextNegotiation, config.mode, createAudioClient, createNegotiationClient, mockOwnerKey, runAuthorized])

  return (
    <DomainServicesContext.Provider value={value}>
      {children}
    </DomainServicesContext.Provider>
  )
}
