import { useCallback, useEffect, useRef, useState } from 'react'

import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { TrainingCase } from '@/types/case'
import type { NegotiationSessionSummary } from '@/types/negotiation'

export function useHomeDashboardData(negotiationClient: NegotiationClient) {
  const [activeSession, setActiveSession] = useState<NegotiationSessionSummary | null>(null)
  const [history, setHistory] = useState<NegotiationSessionSummary[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [cases, setCases] = useState<TrainingCase[]>([])
  const [casesError, setCasesError] = useState<string | null>(null)
  const [casesLoading, setCasesLoading] = useState(true)
  const historyRequestRef = useRef(0)
  const casesRequestRef = useRef(0)

  const loadHistory = useCallback(async () => {
    const request = ++historyRequestRef.current
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const [sessions, active] = await Promise.all([
        negotiationClient.listSessions(),
        negotiationClient.getActiveSession(),
      ])
      if (request === historyRequestRef.current) {
        setHistory(sessions)
        setActiveSession(active?.status === 'active' ? active : null)
      }
    } catch (caught) {
      if (request === historyRequestRef.current) setHistoryError(caught instanceof Error ? caught.message : 'Не удалось загрузить историю.')
    } finally {
      if (request === historyRequestRef.current) setHistoryLoading(false)
    }
  }, [negotiationClient])

  const loadCases = useCallback(async () => {
    const request = ++casesRequestRef.current
    setCasesLoading(true)
    setCasesError(null)
    try {
      const items = await negotiationClient.listCases()
      if (request === casesRequestRef.current) setCases(items)
    } catch (caught) {
      if (request === casesRequestRef.current) setCasesError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейсы.')
    } finally {
      if (request === casesRequestRef.current) setCasesLoading(false)
    }
  }, [negotiationClient])

  useEffect(() => {
    const request = ++historyRequestRef.current
    void Promise.all([
      negotiationClient.listSessions(),
      negotiationClient.getActiveSession(),
    ]).then(([sessions, active]) => {
      if (request === historyRequestRef.current) {
        setHistory(sessions)
        setActiveSession(active?.status === 'active' ? active : null)
      }
    }).catch((caught: unknown) => {
      if (request === historyRequestRef.current) setHistoryError(caught instanceof Error ? caught.message : 'Не удалось загрузить историю.')
    }).finally(() => {
      if (request === historyRequestRef.current) setHistoryLoading(false)
    })
    return () => { historyRequestRef.current += 1 }
  }, [negotiationClient])

  useEffect(() => {
    const request = ++casesRequestRef.current
    void negotiationClient.listCases().then((items) => {
      if (request === casesRequestRef.current) setCases(items)
    }).catch((caught: unknown) => {
      if (request === casesRequestRef.current) setCasesError(caught instanceof Error ? caught.message : 'Не удалось загрузить кейсы.')
    }).finally(() => {
      if (request === casesRequestRef.current) setCasesLoading(false)
    })
    return () => { casesRequestRef.current += 1 }
  }, [negotiationClient])

  return { activeSession, cases, casesError, casesLoading, loadCases, history, historyError, historyLoading, loadHistory }
}
