import { useEffect, useMemo, useRef, useState } from 'react'

import { completedPreparationSteps, readPreparationDraft, savePreparationDraft } from '@/features/preparation/preparation'
import type { PreparationDraft } from '@/types/preparation'

export type PreparationSaveState = 'saving' | 'saved' | 'error'
export type UpdatePreparationDraft = (updater: (current: PreparationDraft) => PreparationDraft) => void

export function usePreparationDraft(ownerKey: string, caseId: string, roleIndex: 0 | 1 | null) {
  const storageRole = roleIndex ?? 0
  const identity = `${ownerKey}\u0000${caseId}\u0000${storageRole}`
  const identityRef = useRef(identity)
  const [draft, setDraft] = useState<PreparationDraft>(() => readPreparationDraft(ownerKey, caseId, storageRole))
  const [saveState, setSaveState] = useState<PreparationSaveState>('saved')

  useEffect(() => {
    if (identityRef.current === identity) return
    identityRef.current = identity
    setDraft(readPreparationDraft(ownerKey, caseId, storageRole))
    setSaveState('saved')
  }, [caseId, identity, ownerKey, storageRole])

  useEffect(() => {
    if (roleIndex === null) return
    const timer = window.setTimeout(() => {
      try {
        savePreparationDraft(ownerKey, caseId, roleIndex, draft)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [caseId, draft, ownerKey, roleIndex])

  const updateDraft: UpdatePreparationDraft = (updater) => {
    setSaveState('saving')
    setDraft(updater)
  }
  const completed = useMemo(() => completedPreparationSteps(draft), [draft])
  return { completed, draft, saveState, updateDraft }
}
