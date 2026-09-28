import { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { ResultAnalysis } from '@/components/result/ResultAnalysis'
import { ResultHeader } from '@/components/result/ResultHeader'
import { ResultStatus } from '@/components/result/ResultStatus'
import { useNegotiationResult } from '@/features/result/useNegotiationResult'
import { useRepeatNegotiation } from '@/features/result/useRepeatNegotiation'
import { useProductTour } from '@/features/product-tour/useProductTour'
import { getDuelPreparation } from '@/mocks/duelPreparation'
import { useDomainServices } from '@/services/domainServices'
import '@/styles/result.css'

export function ResultPage() {
  const { sessionId = '' } = useParams()
  const { mockOwnerKey } = useAuthRuntime()
  if (!mockOwnerKey) throw new Error('ResultPage requires an authenticated owner.')
  const navigate = useNavigate()
  const { isRealVoice, negotiationClient } = useDomainServices()
  const loaded = useNegotiationResult(negotiationClient, sessionId)
  const productTour = useProductTour()
  const {
    clearScenarioError,
    reportScenarioError,
    send: sendTourEvent,
    state: tourState,
  } = productTour
  const openCreatedSession = useCallback((createdSessionId: string) => navigate(`/arena/${createdSessionId}`), [navigate])
  const repeated = useRepeatNegotiation(negotiationClient, mockOwnerKey, loaded.session, openCreatedSession)
  const ready = loaded.result?.status === 'ready' ? loaded.result.result : null
  const preparation = getDuelPreparation(loaded.session?.caseId ?? '')

  useEffect(() => {
    if (tourState?.status === 'active' && ready && tourState.sessionId === sessionId) {
      sendTourEvent({ type: 'result-ready' })
    }
  }, [ready, sendTourEvent, sessionId, tourState])

  useEffect(() => {
    if (tourState?.status !== 'active' || tourState.stepId !== 'result' || tourState.sessionId !== sessionId) return
    if (loaded.error || loaded.result?.status === 'failed') {
      reportScenarioError('result', loaded.retry)
    } else {
      clearScenarioError()
    }
  }, [clearScenarioError, loaded.error, loaded.result?.status, loaded.retry, reportScenarioError, sessionId, tourState])

  return <div className="result-page">
    <ResultHeader />
    <main className="result-shell result-main">
      {ready && loaded.session ? <ResultAnalysis
        result={ready}
        session={loaded.session}
        preparation={preparation}
        isDemo={isRealVoice}
        isRestarting={repeated.isRestarting}
        error={repeated.error}
        onRepeat={() => void repeated.repeat()}
      /> : <ResultStatus result={loaded.result} error={loaded.error} onRetry={loaded.retry} />}
    </main>
  </div>
}
