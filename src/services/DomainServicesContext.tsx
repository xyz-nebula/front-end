import { useMemo, type ReactNode } from 'react'

import { useAuthRuntime } from '@/auth/runtime'
import { DomainServicesContext, type DomainServices } from '@/services/domainServices'
import { useServiceAdapters } from '@/services/serviceAdapters'

export function DomainServicesProvider({ children }: { children: ReactNode }) {
  const { createAudioClient, createNegotiationClient } = useServiceAdapters()
  const { mockOwnerKey, runAuthorized } = useAuthRuntime()
  const value = useMemo<DomainServices>(() => ({
    negotiationClient: createNegotiationClient({ mockOwnerKey, runAuthorized }),
    createAudioClient: () => createAudioClient({ mockOwnerKey, runAuthorized }),
  }), [createAudioClient, createNegotiationClient, mockOwnerKey, runAuthorized])

  return (
    <DomainServicesContext.Provider value={value}>
      {children}
    </DomainServicesContext.Provider>
  )
}
