import type { AudioConnectionState } from '@/types/audio'

interface VoiceControlsProps {
  state: AudioConnectionState
  error: string | null
  isPlaying: boolean
  disabled: boolean
  isDemo?: boolean
  onConnect: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

const stateLabels: Record<AudioConnectionState, string> = {
  idle: 'Начните разговор', connecting: 'Подключаемся…', connected: 'Говорите',
  paused: 'Разговор на паузе', stopped: 'Разговор остановлен',
  reconnecting: 'Переподключаемся…', error: 'Связь прервалась',
}

export function VoiceControls({ state, error, isPlaying, disabled, isDemo = true, onConnect, onPause, onResume, onStop }: VoiceControlsProps) {
  const connecting = state === 'connecting' || state === 'reconnecting'
  const active = state === 'connected' || state === 'paused'
  const primaryLabel = state === 'idle' ? 'Начать разговор'
    : state === 'stopped' || state === 'error' ? 'Подключиться снова'
      : state === 'connected' ? 'Пауза'
        : state === 'paused' ? 'Продолжить' : 'Подключаемся…'
  const primaryAction = state === 'connected' ? onPause : state === 'paused' ? onResume : onConnect

  return (
    <div className="voice-controls">
      {error && <p className="voice-controls__error" role="alert">{error}</p>}
      <div className="voice-controls__main">
        <span className="voice-controls__wave" aria-hidden="true">▂▅▃▆▄▂▅▃▆▄</span>
        <button className={`voice-controls__mic ${active ? 'is-active' : ''}`} type="button" onClick={primaryAction} disabled={disabled || connecting} aria-label={primaryLabel}>
          <svg viewBox="0 0 32 40" fill="none" aria-hidden="true"><rect x="10" y="2" width="12" height="23" rx="6" fill="currentColor"/><path d="M4 19v2a12 12 0 0 0 24 0v-2M16 33v5m-8 0h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
        </button>
        <span className="voice-controls__wave" aria-hidden="true">▄▆▃▅▂▄▆▃▅▂</span>
      </div>
      <div className="voice-controls__status" role="status"><strong>{isPlaying ? 'Оппонент отвечает' : stateLabels[state]}</strong><span>{state === 'connected' ? isDemo ? 'Демо-разговор активен' : 'Микрофон включён' : state === 'paused' ? 'Микрофон на паузе' : connecting ? 'Ожидайте подключения' : 'Нажмите на микрофон'}</span><small>{state === 'connected' ? isDemo ? 'Реплики появятся автоматически' : 'Реплика завершится автоматически после паузы' : 'Реплики появятся в диалоге после сохранения'}</small></div>
      {active && <button className="voice-controls__stop" type="button" onClick={onStop}>Остановить</button>}
    </div>
  )
}
