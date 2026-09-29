import { Link } from 'react-router-dom'

import { ResultCoach, ResultJudges, ResultNextSteps, ResultOutcome, ResultPlan, ResultTranscript } from '@/components/result/ResultSections'
import { AppButton } from '@/components/ui/AppButton'
import type { NegotiationResult, NegotiationSession } from '@/types/negotiation'

interface ResultAnalysisProps {
  result: NegotiationResult
  session: NegotiationSession
  isRestarting: boolean
  error: string | null
  onRepeat: () => void
}

function formatDuration(session: NegotiationSession): string | null {
  if (!session.finishedAt) return null
  const durationMs = Date.parse(session.finishedAt) - Date.parse(session.startedAt)
  if (!Number.isFinite(durationMs) || durationMs < 0) return null
  const totalSeconds = Math.floor(durationMs / 1_000)
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`
}

export function ResultAnalysis({ result, session, isRestarting, error, onRepeat }: ResultAnalysisProps) {
  const duration = formatDuration(session)
  const selectedRole = session.selectedRole ?? 0
  const userRole = session.caseSnapshot.roles[selectedRole]
  const opponentRole = session.caseSnapshot.roles[selectedRole === 0 ? 1 : 0]

  return <>
    <nav className="result-breadcrumbs" aria-label="Хлебные крошки"><Link to="/home">Кейсы</Link><span>/</span><span>Результат</span></nav>
    <section className="result-intro"><h1>Разбор поединка</h1><p>{userRole} → {opponentRole}{duration && <> <span>·</span> {duration}</>} <span>·</span> {session.mode === 'voice' ? 'Голос' : 'Текст'}</p></section>
    {result.source === 'mock' && <p className="result-demo-note" role="note">Это демонстрационный разбор интерфейса. Оценка и рекомендации не получены от backend или AI-сервиса.</p>}
    <ResultOutcome outcome={result.outcome} />
    <ResultJudges judges={result.judges} />
    <ResultCoach trainer={result.trainer} />
    <ResultPlan trainer={result.trainer} />
    <ResultNextSteps trainer={result.trainer} />
    <div className="result-actions"><AppButton type="button" onClick={onRepeat} disabled={isRestarting}>{isRestarting ? 'Создаём раунд…' : 'Повторить кейс'}</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div>
    <p className="result-actions__note">Повтор сохранит вашу роль и скрытую позицию AI, чтобы честно проверить новую стратегию.</p>
    {error && <p className="result-error" role="alert">{error}</p>}
    <ResultTranscript messages={session.messages} />
  </>
}
