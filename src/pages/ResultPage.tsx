import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AppButton } from '@/components/ui/AppButton'
import { Logo } from '@/components/ui/Logo'
import { trainingCases } from '@/mocks/cases'
import { useDomainServices } from '@/services/domainServices'
import type { NegotiationResultState, NegotiationSession } from '@/types/negotiation'

const POLL_DELAYS = [400, 700, 1_000, 1_500, 2_000, 3_000]

export function ResultPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const { negotiationClient } = useDomainServices()
  const [session, setSession] = useState<NegotiationSession | null>(null)
  const [result, setResult] = useState<NegotiationResultState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const [isRestarting, setIsRestarting] = useState(false)
  const generationRef = useRef(0)

  useEffect(() => {
    const generation = ++generationRef.current
    let timer: number | undefined
    let releaseWait: (() => void) | undefined
    const wait = (delay: number) => new Promise<void>((resolve) => {
      releaseWait = resolve
      timer = window.setTimeout(() => { timer = undefined; releaseWait = undefined; resolve() }, delay)
    })
    const load = async () => {
      try {
        const loaded = await negotiationClient.getSession(sessionId)
        if (generation !== generationRef.current) return
        setSession(loaded)
        for (let attempt = 0; attempt <= POLL_DELAYS.length; attempt += 1) {
          const next = await negotiationClient.getResult(sessionId)
          if (generation !== generationRef.current) return
          setResult(next)
          if (next.status !== 'processing') return
          if (attempt < POLL_DELAYS.length) await wait(POLL_DELAYS[attempt])
        }
        if (generation === generationRef.current) setError('Разбор готовится дольше обычного. Проверьте ещё раз.')
      } catch (caught) {
        if (generation === generationRef.current) setError(caught instanceof Error ? caught.message : 'Не удалось загрузить результат.')
      }
    }
    void load()
    return () => {
      generationRef.current += 1
      if (timer !== undefined) window.clearTimeout(timer)
      releaseWait?.()
    }
  }, [negotiationClient, retryVersion, sessionId])

  const repeatCase = useCallback(async () => {
    if (!session || isRestarting) return
    setIsRestarting(true)
    setError(null)
    try {
      const created = await negotiationClient.createSession({
        caseId: session.caseId,
        mode: session.mode,
        clientCommandId: crypto.randomUUID(),
      })
      navigate(`/arena/${created.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось начать новый раунд.')
      setIsRestarting(false)
    }
  }, [isRestarting, navigate, negotiationClient, session])

  const trainingCase = trainingCases.find((item) => item.id === session?.caseId)
  const ready = result?.status === 'ready' ? result.result : null

  return (
    <div className="result-page">
      <header className="result-header"><Logo /><Link to="/home">← К тренировкам</Link></header>
      <main className="result-main">
        <p className="eyebrow">Разбор переговоров · демо</p>
        <h1>{ready ? 'Ваш результат' : 'Разбор тренировки'}</h1>
        <p className="result-main__case">{trainingCase?.title ?? 'Переговоры'}{session && ` · ${session.mode === 'voice' ? 'Голос' : 'Текст'}`}</p>
        {ready ? (
          <>
            <section className="result-hero" aria-label="Итог"><div><span>{ready.outcome === 'victory' ? 'Цель достигнута' : 'Есть над чем поработать'}</span><strong>{ready.score}<small>/100</small></strong></div><p>{ready.summary}</p></section>
            <div className="result-grid">
              <section><span className="result-grid__icon">↗</span><h2>Сильные стороны</h2><ul>{ready.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
              <section><span className="result-grid__icon">✦</span><h2>Что улучшить</h2><ul>{ready.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section>
            </div>
            <section className="result-recommendations"><p className="eyebrow">Следующий шаг</p><h2>Рекомендации</h2><ol>{ready.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></section>
            <div className="result-actions"><AppButton type="button" onClick={() => void repeatCase()} disabled={isRestarting}>{isRestarting ? 'Создаём раунд…' : 'Повторить кейс'}</AppButton><AppButton to="/home" variant="secondary">Все тренировки</AppButton></div>
          </>
        ) : (
          <section className="result-pending" role="status"><span className={result?.status === 'processing' || !result ? 'arena-state__spinner' : 'arena-state__mark'} aria-hidden="true">{result?.status === 'failed' ? '!' : ''}</span><h2>{result?.status === 'failed' ? 'Разбор не готов' : error ? 'Не удалось получить разбор' : 'Анализируем разговор…'}</h2><p>{result?.status === 'failed' ? result.message : error ?? 'Собираем выводы по вашим репликам. Это займёт несколько секунд.'}</p><div>{(error || result?.status === 'failed') && <AppButton type="button" onClick={() => { setError(null); setResult(null); setRetryVersion((version) => version + 1) }}>Проверить ещё раз</AppButton>}<AppButton to="/home" variant="secondary">К тренировкам</AppButton></div></section>
        )}
        {ready && error && <p className="result-error" role="alert">{error}</p>}
      </main>
    </div>
  )
}
