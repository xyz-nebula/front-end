import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuthRuntime } from '@/auth/runtime'
import { ArenaConversation } from '@/components/arena/ArenaConversation'
import { ArenaHeader } from '@/components/arena/ArenaHeader'
import { DuelPreparation } from '@/components/arena/DuelPreparation'
import { FinishDialog } from '@/components/arena/FinishDialog'
import { TextComposer } from '@/components/arena/TextComposer'
import { VoiceControls } from '@/components/arena/VoiceControls'
import { AppButton } from '@/components/ui/AppButton'
import { useArenaSession } from '@/features/arena/useArenaSession'
import { useArenaAudio } from '@/features/arena/useArenaAudio'
import { useProductTour } from '@/features/product-tour/useProductTour'
import { trainingCases } from '@/mocks/cases'
import { getDuelPreparation } from '@/mocks/duelPreparation'
import { readSessionPreparation } from '@/features/preparation/preparation'
import { useDomainServices } from '@/services/domainServices'
import type { TrainingCase } from '@/types/case'
import '@/styles/duel.css'

function fallbackCase(title: string): TrainingCase {
  return {
    id: title,
    title,
    description: 'Голосовой разговор с AI. Сценарий и роль оппонента пока не привязаны к карточке.',
    synopsis: 'Переговорная сессия из истории.',
    category: 'Карьера',
    duration: 'Без ограничения',
    difficulty: 'Средне',
    opponent: 'AI-оппонент',
    roles: ['Участник', 'AI-оппонент'],
    roleSummaries: ['Участник переговоров.', 'AI-оппонент.'],
    accent: 'violet',
    icon: 'dialogue',
  }
}

export function ArenaPage() {
  const { sessionId = '' } = useParams()
  const { mockOwnerKey } = useAuthRuntime()
  if (!mockOwnerKey) throw new Error('ArenaPage requires an authenticated owner.')
  const navigate = useNavigate()
  const { isRealVoice } = useDomainServices()
  const arena = useArenaSession(sessionId)
  const productTour = useProductTour()
  const { send: sendTourEvent, state: tourState } = productTour
  const audio = useArenaAudio(sessionId, arena.session?.mode === 'voice' && arena.session.status === 'active', arena.addCommittedMessage, arena.refreshSession)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const finishButtonRef = useRef<HTMLButtonElement>(null)
  const trainingCase = trainingCases.find(
    (item) => item.id === arena.session?.caseId || item.title === arena.session?.name,
  ) ?? (arena.session ? fallbackCase(arena.session.name ?? 'Переговоры с AI') : undefined)
  const sessionPreparation = arena.session ? readSessionPreparation(mockOwnerKey, arena.session.id) : null

  useEffect(() => {
    const session = arena.session
    if (!session || session.mode !== 'voice' || tourState?.status !== 'active') return
    const userMessages = session.messages.filter((message) => message.speaker === 'user').length
    const aiMessages = session.messages.filter((message) => message.speaker === 'ai').length
    if (!tourState.sessionId && ['voice-format', 'analysis', 'strategy', 'tactics', 'start-duel'].includes(tourState.stepId)) {
      sendTourEvent({ type: 'session-created', sessionId: session.id, userMessages, aiMessages })
    }
    if (session.status !== 'active') sendTourEvent({ type: 'session-finished' })
  }, [arena.session, sendTourEvent, tourState])

  useEffect(() => {
    if (audio.state !== 'connected' || !arena.session) return
    sendTourEvent({
      type: 'audio-connected',
      userMessages: arena.session.messages.filter((message) => message.speaker === 'user').length,
      aiMessages: arena.session.messages.filter((message) => message.speaker === 'ai').length,
    })
  }, [arena.session, audio.state, sendTourEvent])

  useEffect(() => {
    const baseline = tourState?.dialogueBaseline
    const messages = arena.session?.messages ?? []
    if (tourState?.status !== 'active' || tourState.stepId !== 'dialogue' || !baseline) return
    const messagesAfterBaseline = messages
      .slice(baseline.userMessages + baseline.aiMessages)
      .sort((left, right) => left.sequence - right.sequence)
    const userIndex = messagesAfterBaseline.findIndex((message) => message.speaker === 'user')
    if (userIndex >= 0 && messagesAfterBaseline.slice(userIndex + 1).some((message) => message.speaker === 'ai')) {
      sendTourEvent({ type: 'dialogue-completed' })
    }
  }, [arena.session?.messages, sendTourEvent, tourState])

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
        <h1>Связь прервалась</h1>
        <p>{arena.error ?? 'Эта тренировка больше недоступна.'}</p>
        <div><AppButton type="button" onClick={() => void arena.reload()}>Повторить</AppButton><AppButton to="/home" variant="secondary">К кейсам</AppButton></div>
      </main>
    )
  }

  const isFinished = arena.viewState === 'finished' || arena.session.status !== 'active'
  const isSending = arena.turnState === 'sending' || arena.turnState === 'thinking'
  const isConnecting = audio.state === 'connecting' || audio.state === 'reconnecting'
  const preparation = getDuelPreparation(trainingCase.id)

  const confirmFinish = async () => {
    if (isFinishing) return
    setIsFinishing(true)
    setFinishError(null)
    try {
      if (arena.session?.mode === 'voice') await audio.stop()
      const finished = await arena.finishSession()
      if (finished) {
        sendTourEvent({ type: 'session-finished' })
        setShowFinishDialog(false)
      }
    } catch (caught) {
      setFinishError(caught instanceof Error
        ? caught.message
        : 'Не удалось завершить тренировку. Попробуйте ещё раз.')
    } finally {
      setIsFinishing(false)
    }
  }

  const openFinishDialog = () => {
    sendTourEvent({ type: 'finish-opened' })
    setShowFinishDialog(true)
  }

  const closeFinishDialog = () => {
    sendTourEvent({ type: 'finish-cancelled' })
    setShowFinishDialog(false)
  }

  return (
    <div className="arena-page">
      <ArenaHeader
        title={trainingCase.title}
        userRole={sessionPreparation?.userRole ?? preparation?.userRole ?? 'Вы'}
        opponentRole={sessionPreparation?.opponentRole ?? preparation?.opponentRole ?? trainingCase.opponent}
        startedAt={arena.session.startedAt}
        mode={arena.session.mode}
        audioState={audio.state}
        isDemoVoice={!isRealVoice}
        isSending={isSending}
        finishDisabled={isSending || isFinished || isConnecting}
        onFinish={openFinishDialog}
        finishButtonRef={finishButtonRef}
      />
      <main className="duel-shell arena-layout">
        <section className="arena-dialog-panel">
          <h2 className="arena-dialog-panel__title">Диалог</h2>
          <ArenaConversation messages={arena.session.messages} opponent={sessionPreparation?.opponentRole ?? preparation?.opponentRole ?? trainingCase.opponent} isThinking={isSending} mode={arena.session.mode} partial={audio.partial} />
          {arena.error && <div className="arena-inline-error" role="alert"><span>{arena.error}</span><button type="button" onClick={() => arena.turnState === 'error' ? void arena.sendTextTurn() : openFinishDialog()}>Повторить</button></div>}
        </section>
        <DuelPreparation data={preparation} description={trainingCase.description} isRealVoice={isRealVoice} snapshot={sessionPreparation} />
        <div className="duel-controls">
          {isFinished ? (
            <div className="arena-finished" role="status"><div><strong>Переговоры завершены</strong><span>Открываем разбор…</span></div><Link to={`/result/${sessionId}`}>Посмотреть результат →</Link></div>
          ) : arena.session.mode === 'voice' ? (
            <VoiceControls state={audio.state} error={audio.error} isPlaying={audio.isPlaying} disabled={arena.viewState !== 'ready'} isDemo={!isRealVoice} isUserSpeaking={Boolean(audio.partial.user)} getInputLevel={audio.getInputLevel} onConnect={() => void audio.connect()} onPause={audio.pause} onResume={audio.resume} onStop={() => void audio.stop()} />
          ) : (
            <TextComposer
              value={arena.draft}
              disabled={isSending || arena.turnState === 'error' || arena.viewState !== 'ready'}
              isSending={isSending}
              onChange={arena.setDraft}
              onSubmit={() => void arena.sendTextTurn()}
            />
          )}
        </div>
      </main>
      {showFinishDialog && <FinishDialog
        busy={isFinishing}
        error={finishError ?? arena.error}
        onCancel={closeFinishDialog}
        onConfirm={() => { void confirmFinish() }}
        returnFocusRef={finishButtonRef}
      />}
    </div>
  )
}
