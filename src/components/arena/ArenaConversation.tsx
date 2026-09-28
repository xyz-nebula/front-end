import { useEffect, useRef } from 'react'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import directorArtwork from '@/assets/home/role-director.webp'
import type { AudioTranscriptDrafts } from '@/types/audio'
import type { NegotiationMessage } from '@/types/negotiation'
import type { NegotiationMode } from '@/types/negotiation'

interface ArenaConversationProps {
  messages: NegotiationMessage[]
  opponent: string
  isThinking: boolean
  mode?: NegotiationMode
  partial?: AudioTranscriptDrafts
}

export function ArenaConversation({ messages, opponent, isThinking, mode = 'text', partial = { user: null, ai: null } }: ArenaConversationProps) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const streamingMessageIds = new Set(
    (['user', 'ai'] as const).flatMap((speaker) => partial[speaker]?.committedMessageId ?? []),
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isThinking, messages, partial.ai?.text, partial.user?.text])

  return (
    <section className="arena-conversation" aria-label="Диалог переговоров" aria-live="polite" data-tour-id="dialogue">
      {messages.length === 0 && !isThinking && (
        <div className="arena-conversation__empty">
          <span>Ваш ход</span>
          <h2>Начните разговор</h2>
          <p>{mode === 'voice' ? 'Начните голосовой раунд. Реплики появятся здесь после сохранения.' : 'Представьтесь, обозначьте цель встречи или задайте первый открытый вопрос.'}</p>
        </div>
      )}
      {messages.filter((message) => !streamingMessageIds.has(message.id)).map((message) => (
        <article className={`arena-message arena-message--${message.speaker}`} key={message.id}>
          <img className="arena-message__avatar" src={message.speaker === 'user' ? profileArtwork : directorArtwork} alt="" width={400} height={400} decoding="async" />
          <div>
            <span>{message.speaker === 'user' ? 'Вы' : opponent}</span>
            <p>{message.text}</p>
          </div>
        </article>
      ))}
      {(['user', 'ai'] as const).map((speaker) => partial[speaker]?.text && (
        <article className={`arena-message arena-message--${speaker} arena-message--partial`} key={`partial-${speaker}`} aria-live="off">
          <img className="arena-message__avatar" src={speaker === 'user' ? profileArtwork : directorArtwork} alt="" width={400} height={400} decoding="async" />
          <div>
            <span>{speaker === 'user' ? 'Вы · распознаём' : `${opponent} · отвечает`}</span>
            <p>{partial[speaker]?.text}<i className="arena-message__typing-cursor" aria-hidden="true" /></p>
          </div>
        </article>
      ))}
      {isThinking && (
        <article className="arena-message arena-message--ai arena-message--thinking" role="status">
          <img className="arena-message__avatar" src={directorArtwork} alt="" width={400} height={400} decoding="async" />
          <div><span>{opponent}</span><p><i /><i /><i /><b>Формулирует ответ…</b></p></div>
        </article>
      )}
      <div ref={endRef} />
    </section>
  )
}
