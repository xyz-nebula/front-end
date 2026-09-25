import { useEffect, useRef } from 'react'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import type { NegotiationMessage } from '@/types/negotiation'
import type { NegotiationMode } from '@/types/negotiation'

interface ArenaConversationProps {
  messages: NegotiationMessage[]
  opponent: string
  isThinking: boolean
  mode?: NegotiationMode
}

export function ArenaConversation({ messages, opponent, isThinking, mode = 'text' }: ArenaConversationProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isThinking, messages])

  return (
    <section className="arena-conversation" aria-label="Диалог переговоров" aria-live="polite">
      {messages.length === 0 && !isThinking && (
        <div className="arena-conversation__empty">
          <span>Ваш ход</span>
          <h2>Начните разговор</h2>
          <p>{mode === 'voice' ? 'Начните голосовой раунд. Реплики появятся здесь после сохранения.' : 'Представьтесь, обозначьте цель встречи или задайте первый открытый вопрос.'}</p>
        </div>
      )}
      {messages.map((message) => (
        <article className={`arena-message arena-message--${message.speaker}`} key={message.id}>
          <img className="arena-message__avatar" src={message.speaker === 'user' ? profileArtwork : directorArtwork} alt="" />
          <div>
            <span>{message.speaker === 'user' ? 'Вы' : opponent}</span>
            <p>{message.text}</p>
          </div>
        </article>
      ))}
      {isThinking && (
        <article className="arena-message arena-message--ai arena-message--thinking" role="status">
          <img className="arena-message__avatar" src={directorArtwork} alt="" />
          <div><span>{opponent}</span><p><i /><i /><i /><b>Формулирует ответ…</b></p></div>
        </article>
      )}
      <div ref={endRef} />
    </section>
  )
}
