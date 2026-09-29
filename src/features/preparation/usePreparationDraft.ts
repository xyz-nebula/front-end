import { useEffect, useMemo, useRef, useState } from 'react'

import { completedPreparationSteps, readPreparationDraft, savePreparationDraft } from '@/features/preparation/preparation'
import type { PreparationDraft } from '@/types/preparation'

export type PreparationSaveState = 'saving' | 'saved' | 'error'
export type UpdatePreparationDraft = (updater: (current: PreparationDraft) => PreparationDraft) => void

interface PendingDraftSave {
  ownerKey: string
  caseId: string
  roleIndex: 0 | 1
  draft: PreparationDraft
}

function persistDraft(pending: PendingDraftSave): boolean {
  try {
    savePreparationDraft(pending.ownerKey, pending.caseId, pending.roleIndex, pending.draft)
    return true
  } catch {
    return false
  }
}

export function usePreparationDraft(ownerKey: string, caseId: string, roleIndex: 0 | 1 | null) {
  const storageRole = roleIndex ?? 0
  const identity = `${ownerKey}\u0000${caseId}\u0000${storageRole}`
  const identityRef = useRef(identity)
  const [draft, setDraft] = useState<PreparationDraft>(() => readPreparationDraft(ownerKey, caseId, storageRole))
  const draftRef = useRef(draft)
  const pendingSaveRef = useRef<PendingDraftSave | null>(null)
  const [saveState, setSaveState] = useState<PreparationSaveState>('saved')

  useEffect(() => {
    if (identityRef.current === identity) return
    const pending = pendingSaveRef.current
    if (pending && persistDraft(pending)) pendingSaveRef.current = null
    identityRef.current = identity
    const storedDraft = readPreparationDraft(ownerKey, caseId, storageRole)
    draftRef.current = storedDraft
    setDraft(storedDraft)
    setSaveState('saved')
  }, [caseId, identity, ownerKey, storageRole])

  useEffect(() => {
    const pending = pendingSaveRef.current
    if (roleIndex === null || !pending) return
    const timer = window.setTimeout(() => {
      const saved = persistDraft(pending)
      if (pendingSaveRef.current === pending && saved) pendingSaveRef.current = null
      setSaveState(saved ? 'saved' : 'error')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [caseId, draft, ownerKey, roleIndex])

  useEffect(() => () => {
    const pending = pendingSaveRef.current
    if (pending && persistDraft(pending)) pendingSaveRef.current = null
  }, [])

  const updateDraft: UpdatePreparationDraft = (updater) => {
    const nextDraft = updater(draftRef.current)
    draftRef.current = nextDraft
    if (roleIndex !== null) pendingSaveRef.current = { ownerKey, caseId, roleIndex, draft: nextDraft }
    setSaveState('saving')
    setDraft(nextDraft)
  }
  const completed = useMemo(() => completedPreparationSteps(draft), [draft])
  return { completed, draft, saveState, updateDraft }
}
