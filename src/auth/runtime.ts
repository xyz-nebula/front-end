import { createContext, useContext } from 'react'

import type { RunAuthorized } from '@/services/serviceAdapters'

export interface AuthRuntimeContextValue {
  mockOwnerKey: string | null
  runAuthorized: RunAuthorized
}

export const AuthRuntimeContext = createContext<AuthRuntimeContextValue | null>(null)

export function useAuthRuntime(): AuthRuntimeContextValue {
  const context = useContext(AuthRuntimeContext)
  if (!context) throw new Error('useAuthRuntime must be used inside AuthProvider')
  return context
}
