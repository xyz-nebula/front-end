import type { AudioConnectionState } from '@/types/audio'

interface VoiceControlsProps {
  state: AudioConnectionState
  partial: { user: string; ai: string }
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
  idle: 'Готовы к голосовому раунду',
  connecting: 'Подключаемся…',
  connected: 'Голосовой раунд идёт',
  paused: 'Раунд на паузе',
  stopped: 'Раунд остановлен',
  reconnecting: 'Переподключаемся…',
  error: 'Связь прервалась',
}

export function VoiceControls({
  state, partial, error, isPlaying, disabled, isDemo = true, onConnect, onPause, onResume, onStop,
}: VoiceControlsProps) {
  const connecting = state === 'connecting' || state === 'reconnecting'
  const active = state === 'connected' || state === 'paused'
  return (
    <div className="voice-controls">
      <div className="voice-controls__status" role="status"><span className={active ? 'is-active' : ''} />{stateLabels[state]}{isPlaying && ' · воспроизводим ответ'}</div>
      {(partial.user || partial.ai) && (
        <div className="voice-controls__partial" aria-live="polite">
          {partial.user && <p><strong>Вы · распознаём</strong>{partial.user}</p>}
          {partial.ai && <p><strong>Оппонент · отвечает</strong>{partial.ai}</p>}
        </div>
      )}
      {error && <p className="voice-controls__error" role="alert">{error}</p>}
      <div className="voice-controls__actions">
        {(state === 'idle' || state === 'stopped' || state === 'error') && <button type="button" className="voice-controls__primary" onClick={onConnect} disabled={disabled}>◉ {state === 'idle' ? 'Начать разговор' : 'Подключиться снова'}</button>}
        {connecting && <button type="button" disabled>Подключаемся…</button>}
        {state === 'connected' && <button type="button" onClick={onPause} disabled={disabled}>Пауза</button>}
        {state === 'paused' && <button type="button" onClick={onResume} disabled={disabled}>Продолжить</button>}
        {active && <button type="button" onClick={onStop}>Остановить</button>}
      </div>
      <small>{isDemo
        ? 'Демо-режим: реплики и голос оппонента имитируются локально.'
        : 'Голос передаётся AI-сервису, а сохранённые транскрипции появляются в истории.'}</small>
    </div>
  )
}
