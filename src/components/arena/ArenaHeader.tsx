import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import type { AudioConnectionState } from '@/types/audio'
import type { NegotiationMode } from '@/types/negotiation'

function formatElapsed(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

interface ArenaHeaderProps {
  title: string
  userRole: string
  opponentRole: string
  startedAt: string
  mode: NegotiationMode
  audioState: AudioConnectionState
  isDemoVoice: boolean
  isSending: boolean
  finishDisabled: boolean
  onFinish: () => void
}

export function ArenaHeader({ title, userRole, opponentRole, startedAt, mode, audioState, isDemoVoice, isSending, finishDisabled, onFinish }: ArenaHeaderProps) {
  const [now, setNow] = useState(Date.now)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const status = mode === 'text'
    ? isSending ? 'Оппонент отвечает' : 'Ваш ход'
    : audioState === 'connected' ? 'Разговор идёт'
      : audioState === 'paused' ? 'Пауза'
        : audioState === 'connecting' || audioState === 'reconnecting' ? 'Подключаемся'
          : audioState === 'error' ? 'Ошибка связи' : 'Начните разговор'

  return (
    <>
      <header className="duel-header">
        <div className="duel-shell duel-header__inner">
          <Link className="duel-header__brand" to="/" aria-label="Арена — на главную"><ArenaCubeMark /><span>АРЕНА</span></Link>
          <div className="duel-header__actions">
            <span className="duel-header__streak" aria-label="Демо: серия 4 дня"><span aria-hidden="true">🔥</span> Серия: <strong>4 дня</strong></span>
            <div className="duel-header__profile">
              <button type="button" aria-label="Меню профиля" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><img src={profileArtwork} alt="" width={400} height={400} decoding="async" /></button>
              {profileOpen && <div className="duel-header__profile-menu"><span>Кирилл · демо-профиль</span><Link to="/home">К кейсам</Link></div>}
            </div>
          </div>
        </div>
      </header>
      <div className="duel-shell duel-heading">
        <div><h1>{title}</h1><span>· Поединок</span></div>
        <button type="button" onClick={onFinish} disabled={finishDisabled} aria-label="Завершить"><span className="duel-heading__finish-full">Завершить переговоры</span><span className="duel-heading__finish-short">Завершить</span></button>
      </div>
      <section className="duel-shell duel-participants" aria-label="Участники и время поединка">
        <div className="duel-participants__person duel-participants__person--user"><img src={profileArtwork} alt="" width={400} height={400} decoding="async" /><div><strong>{userRole}</strong><span>Вы</span></div></div>
        <div className="duel-participants__center"><time aria-label="Время тренировки">{formatElapsed(startedAt, now)}</time><strong>{status}</strong><span>{mode === 'voice' ? audioState === 'connected' ? isDemoVoice ? 'Демо-реплики появятся автоматически' : 'Говорите — система завершит реплику по паузе' : 'Подключите голосовой разговор' : isSending ? 'Ожидайте ответ оппонента' : 'Напишите реплику ниже'}</span></div>
        <div className="duel-participants__person duel-participants__person--ai"><img src={directorArtwork} alt="" width={400} height={400} decoding="async" /><div><strong>{opponentRole}</strong><span>AI-оппонент</span></div></div>
      </section>
    </>
  )
}
