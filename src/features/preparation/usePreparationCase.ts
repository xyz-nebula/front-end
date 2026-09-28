import { useCallback, useEffect, useRef, useState } from 'react'

import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { TrainingCase } from '@/types/case'

export function usePreparationCase(negotiationClient: NegotiationClient, caseId: string) {
  const [cases, setCases] = useState<TrainingCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const items = await negotiationClient.listCases()
      if (request === requestRef.current) setCases(items)
    } catch (caught) {
      if (request === requestRef.current) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейс.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [negotiationClient])

  useEffect(() => {
    const request = ++requestRef.current
    void negotiationClient.listCases().then((items) => {
      if (request === requestRef.current) setCases(items)
    }).catch((caught: unknown) => {
      if (request === requestRef.current) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейс.')
    }).finally(() => {
      if (request === requestRef.current) setLoading(false)
    })
    return () => { requestRef.current += 1 }
  }, [negotiationClient])

  return { error, load, loading, trainingCase: cases.find((item) => item.id === caseId) }
}
