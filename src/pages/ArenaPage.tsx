import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ArenaConversation } from '@/components/arena/ArenaConversation'
import { ArenaHeader } from '@/components/arena/ArenaHeader'
import { FinishDialog } from '@/components/arena/FinishDialog'
import { TextComposer } from '@/components/arena/TextComposer'
import { VoiceControls } from '@/components/arena/VoiceControls'
import { AppButton } from '@/components/ui/AppButton'
import { useArenaSession } from '@/features/arena/useArenaSession'
import { useArenaAudio } from '@/features/arena/useArenaAudio'
import { trainingCases } from '@/mocks/cases'

export function ArenaPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const arena = useArenaSession(sessionId)
  const audio = useArenaAudio(sessionId, arena.session?.mode === 'voice' && arena.session.status === 'active', arena.addCommittedMessage, arena.refreshSession)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const trainingCase = trainingCases.find((item) => item.id === arena.session?.caseId)

  useEffect(() => {
    if (arena.viewState === 'finished') navigate(`/result/${sessionId}`, { replace: true })
  }, [arena.viewState, navigate, sessionId])

  if (arena.viewState === 'loading') {
    return (
      <main className="arena-state" aria-live="polite">
        <span className="arena-state__spinner" aria-hidden="true" />
        <p className="eyebrow">Арена переговоров</p>
        <h1>Загружаем тренировку…</h1>
      </main>
    )
  }

  if (arena.viewState === 'error' || !arena.session || !trainingCase) {
    return (
      <main className="arena-state">
        <span className="arena-state__mark" aria-hidden="true">!</span>
        <p className="eyebrow">Не удалось открыть арену</p>
        <h1>{trainingCase === undefined && arena.session ? 'Кейс не найден' : 'Связь прервалась'}</h1>
        <p>{arena.error ?? 'Эта тренировка больше недоступна.'}</p>
        <div><AppButton type="button" onClick={() => void arena.reload()}>Повторить</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div>
      </main>
    )
  }

  const isFinished = arena.viewState === 'finished' || arena.session.status !== 'active'
  const isSending = arena.turnState === 'sending' || arena.turnState === 'thinking'
  const isConnecting = audio.state === 'connecting' || audio.state === 'reconnecting'

  return (
    <div className="arena-page">
      <ArenaHeader
        trainingCase={trainingCase}
        startedAt={arena.session.startedAt}
        mode={arena.session.mode}
        finishDisabled={isSending || isFinished || isConnecting}
        onFinish={() => setShowFinishDialog(true)}
      />
      <main className="arena-layout">
        <aside className="arena-brief">
          <p className="eyebrow">Бриф перед встречей</p>
          <div className="arena-brief__opponent"><span>{trainingCase.opponent.charAt(0)}</span><div><small>Ваш AI-оппонент</small><strong>{trainingCase.opponent}</strong></div></div>
          <h1>{trainingCase.title}</h1>
          <p>{trainingCase.description}</p>
          <dl><div><dt>Сложность</dt><dd>{trainingCase.difficulty}</dd></div><div><dt>Время</dt><dd>{trainingCase.duration}</dd></div></dl>
          <blockquote>«Сначала выясните ограничения собеседника, затем предлагайте решение»</blockquote>
        </aside>
        <section className="arena-dialog-panel">
          <div className="arena-dialog-panel__head"><div><span className="arena-live-dot" />Диалог активен</div><span>{arena.session.messages.length} реплик</span></div>
          <ArenaConversation messages={arena.session.messages} opponent={trainingCase.opponent} isThinking={isSending} mode={arena.session.mode} />
          {arena.error && <div className="arena-inline-error" role="alert"><span>{arena.error}</span><button type="button" onClick={() => arena.turnState === 'error' ? void arena.sendTextTurn() : setShowFinishDialog(true)}>Повторить</button></div>}
          {isFinished ? (
            <div className="arena-finished" role="status"><div><strong>Переговоры завершены</strong><span>Открываем разбор…</span></div><Link to={`/result/${sessionId}`}>Посмотреть результат →</Link></div>
          ) : arena.session.mode === 'voice' ? (
            <VoiceControls state={audio.state} partial={audio.partial} error={audio.error} isPlaying={audio.isPlaying} disabled={arena.viewState !== 'ready'} onConnect={() => void audio.connect()} onPause={audio.pause} onResume={audio.resume} onStop={() => void audio.stop()} />
          ) : (
            <TextComposer
              value={arena.draft}
              disabled={isSending || arena.turnState === 'error' || arena.viewState !== 'ready'}
              isSending={isSending}
              onChange={arena.setDraft}
              onSubmit={() => void arena.sendTextTurn()}
            />
          )}
        </section>
      </main>
      {showFinishDialog && <FinishDialog onCancel={() => setShowFinishDialog(false)} onConfirm={() => { setShowFinishDialog(false); void (async () => { if (arena.session?.mode === 'voice') await audio.stop(); await arena.finishSession() })() }} />}
    </div>
  )
}
