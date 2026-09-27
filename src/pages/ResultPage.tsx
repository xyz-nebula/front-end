import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { ResultAnalysis } from '@/components/result/ResultAnalysis'
import { ResultHeader } from '@/components/result/ResultHeader'
import { ResultStatus } from '@/components/result/ResultStatus'
import { useNegotiationResult } from '@/features/result/useNegotiationResult'
import { useRepeatNegotiation } from '@/features/result/useRepeatNegotiation'
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
  const openCreatedSession = useCallback((createdSessionId: string) => navigate(`/arena/${createdSessionId}`), [navigate])
  const repeated = useRepeatNegotiation(negotiationClient, mockOwnerKey, loaded.session, openCreatedSession)
  const ready = loaded.result?.status === 'ready' ? loaded.result.result : null
  const preparation = getDuelPreparation(loaded.session?.caseId ?? '')

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
