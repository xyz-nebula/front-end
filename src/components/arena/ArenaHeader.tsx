import type { RefObject } from 'react'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import { ProductHeader } from '@/components/chrome/ProductHeader'
import type { AudioConnectionState } from '@/types/audio'
import type { NegotiationMode } from '@/types/negotiation'
import { formatRemainingTime } from '@/features/arena/sessionTimer'

interface ArenaHeaderProps {
  title: string
  userRole: string
  opponentRole: string
  remainingSeconds: number
  timerStarted: boolean
  timerExpired: boolean
  mode: NegotiationMode
  audioState: AudioConnectionState
  isDemoVoice: boolean
  isSending: boolean
  finishDisabled: boolean
  onFinish: () => void
  finishButtonRef?: RefObject<HTMLButtonElement | null>
}

export function ArenaHeader({ title, userRole, opponentRole, remainingSeconds, timerStarted, timerExpired, mode, audioState, isDemoVoice, isSending, finishDisabled, onFinish, finishButtonRef }: ArenaHeaderProps) {
  const status = timerExpired ? 'Время вышло'
    : mode === 'text'
    ? isSending ? 'Оппонент отвечает' : 'Ваш ход'
    : audioState === 'connected' ? 'Разговор идёт'
      : audioState === 'paused' ? 'Пауза'
        : audioState === 'connecting' || audioState === 'reconnecting' ? 'Подключаемся'
          : audioState === 'error' ? 'Ошибка связи' : 'Начните разговор'

  return (
    <>
      <ProductHeader variant="arena" actions={<span className="duel-header__streak" aria-label="Демо: серия 4 дня"><span aria-hidden="true">🔥</span> Серия: <strong>4 дня</strong></span>} />
      <div className="duel-shell duel-heading">
        <div><h1>{title}</h1><span>· Поединок</span></div>
        <button ref={finishButtonRef} type="button" onClick={onFinish} disabled={finishDisabled} aria-label="Завершить" data-tour-id="finish"><span className="duel-heading__finish-full">Завершить переговоры</span><span className="duel-heading__finish-short">Завершить</span></button>
      </div>
      <section className="duel-shell duel-participants" aria-label="Участники и время поединка">
        <div className="duel-participants__person duel-participants__person--user"><img src={profileArtwork} alt="" width={400} height={400} decoding="async" /><div><strong>{userRole}</strong><span>Вы</span></div></div>
        <div className={`duel-participants__center${remainingSeconds <= 60 && timerStarted ? ' duel-participants__center--urgent' : ''}`}><time aria-label="Оставшееся время">{formatRemainingTime(remainingSeconds)}</time><strong>{status}</strong><span>{timerExpired ? 'Завершаем переговоры и готовим разбор' : !timerStarted ? 'Таймер начнётся после первой реплики' : mode === 'voice' ? audioState === 'connected' ? isDemoVoice ? 'Демо-реплики появятся автоматически' : 'Говорите — система завершит реплику по паузе' : 'Подключите голосовой разговор' : isSending ? 'Ожидайте ответ оппонента' : 'Напишите реплику ниже'}</span></div>
        <div className="duel-participants__person duel-participants__person--ai"><img src={directorArtwork} alt="" width={400} height={400} decoding="async" /><div><strong>{opponentRole}</strong><span>AI-оппонент</span></div></div>
      </section>
    </>
  )
}
