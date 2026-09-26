import { useEffect, useRef } from 'react'

import type { AudioConnectionState } from '@/types/audio'

interface VoiceControlsProps {
  state: AudioConnectionState
  error: string | null
  isPlaying: boolean
  disabled: boolean
  isDemo?: boolean
  isUserSpeaking: boolean
  getInputLevel: () => number
  onConnect: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

const BAR_WEIGHTS = [0.42, 0.66, 0.86, 1, 0.74, 0.92, 0.62, 0.78, 0.48]
const ATTACK_MS = 70
const RELEASE_MS = 220

function mockVoiceLevel(elapsedSeconds: number): number {
  const primary = Math.sin(elapsedSeconds * Math.PI * 4.6)
  const detail = Math.sin(elapsedSeconds * Math.PI * 10.2 + 1.2)
  const cadence = Math.sin(elapsedSeconds * Math.PI * 1.7 - 0.4)
  return Math.min(0.85, Math.max(0.2, 0.5 + primary * 0.17 + detail * 0.1 + cadence * 0.08))
}

function setVisualLevel(element: HTMLDivElement, level: number): void {
  element.style.setProperty('--voice-level', level.toFixed(3))
  element.style.setProperty('--voice-ring-inner-scale', (1 + level * 0.08).toFixed(3))
  element.style.setProperty('--voice-ring-middle-scale', (1 + level * 0.11).toFixed(3))
  element.style.setProperty('--voice-ring-outer-scale', (1 + level * 0.096).toFixed(3))
  element.style.setProperty('--voice-ring-inner-opacity', (0.54 + level * 0.2).toFixed(3))
  element.style.setProperty('--voice-ring-middle-opacity', (0.32 + level * 0.2).toFixed(3))
  element.style.setProperty('--voice-ring-outer-opacity', (0.18 + level * 0.18).toFixed(3))
  element.style.setProperty('--voice-glow-size', `${(13 + level * 16).toFixed(1)}px`)
  for (let index = 0; index < BAR_WEIGHTS.length; index += 1) {
    const base = 0.18 + BAR_WEIGHTS[index] * 0.12
    const scale = base + level * (1 - base) * BAR_WEIGHTS[index]
    element.style.setProperty(`--voice-bar-${index + 1}`, scale.toFixed(3))
  }
}

const stateLabels: Record<AudioConnectionState, string> = {
  idle: 'Начните разговор', connecting: 'Подключаемся…', connected: 'Говорите',
  paused: 'Разговор на паузе', stopped: 'Разговор остановлен',
  reconnecting: 'Переподключаемся…', error: 'Связь прервалась',
}

export function VoiceControls({ state, error, isPlaying, disabled, isDemo = true, isUserSpeaking, getInputLevel, onConnect, onPause, onResume, onStop }: VoiceControlsProps) {
  const visualizationRef = useRef<HTMLDivElement>(null)
  const connecting = state === 'connecting' || state === 'reconnecting'
  const active = state === 'connected' || state === 'paused'
  const primaryLabel = state === 'idle' ? 'Начать разговор'
    : state === 'stopped' || state === 'error' ? 'Подключиться снова'
      : state === 'connected' ? 'Пауза'
        : state === 'paused' ? 'Продолжить' : 'Подключаемся…'
  const primaryAction = state === 'connected' ? onPause : state === 'paused' ? onResume : onConnect

  useEffect(() => {
    const visualization = visualizationRef.current
    if (!visualization) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animationFrame = 0
    let displayedLevel = Number.parseFloat(visualization.style.getPropertyValue('--voice-level')) || 0
    let previousTime = performance.now()
    const demoStartedAt = previousTime

    const update = (time: number) => {
      const canReact = state === 'connected' && !isPlaying && !reducedMotion.matches
      const targetLevel = canReact
        ? isDemo
          ? isUserSpeaking ? mockVoiceLevel((time - demoStartedAt) / 1_000) : 0
          : Math.min(1, Math.max(0, getInputLevel()))
        : 0
      const elapsed = Math.min(64, Math.max(0, time - previousTime))
      const duration = targetLevel > displayedLevel ? ATTACK_MS : RELEASE_MS
      displayedLevel += (targetLevel - displayedLevel) * (1 - Math.exp(-elapsed / duration))
      if (Math.abs(displayedLevel) < 0.001) displayedLevel = 0
      setVisualLevel(visualization, reducedMotion.matches ? 0 : displayedLevel)
      previousTime = time
      animationFrame = window.requestAnimationFrame(update)
    }

    setVisualLevel(visualization, reducedMotion.matches ? 0 : displayedLevel)
    animationFrame = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [getInputLevel, isDemo, isPlaying, isUserSpeaking, state])

  return (
    <div className="voice-controls" ref={visualizationRef}>
      {error && <p className="voice-controls__error" role="alert">{error}</p>}
      <div className="voice-controls__main">
        <span className="voice-controls__equalizer voice-controls__equalizer--left" aria-hidden="true">
          {BAR_WEIGHTS.map((_, index) => <i key={index} />)}
        </span>
        <span className="voice-controls__mic-stage">
          <span className="voice-controls__ring voice-controls__ring--outer" aria-hidden="true" />
          <span className="voice-controls__ring voice-controls__ring--middle" aria-hidden="true" />
          <span className="voice-controls__ring voice-controls__ring--inner" aria-hidden="true" />
          <button className={`voice-controls__mic ${active ? 'is-active' : ''}`} type="button" onClick={primaryAction} disabled={disabled || connecting} aria-label={primaryLabel}>
            <svg viewBox="0 0 32 40" fill="none" aria-hidden="true"><rect x="10" y="2" width="12" height="23" rx="6" fill="currentColor"/><path d="M4 19v2a12 12 0 0 0 24 0v-2M16 33v5m-8 0h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
          </button>
        </span>
        <span className="voice-controls__equalizer voice-controls__equalizer--right" aria-hidden="true">
          {BAR_WEIGHTS.map((_, index) => <i key={index} />)}
        </span>
      </div>
      <div className="voice-controls__status" role="status"><strong>{isPlaying ? 'Оппонент отвечает' : stateLabels[state]}</strong><span>{state === 'connected' ? isDemo ? 'Демо-разговор активен' : 'Микрофон включён' : state === 'paused' ? 'Микрофон на паузе' : connecting ? 'Ожидайте подключения' : 'Нажмите на микрофон'}</span><small>{state === 'connected' ? isDemo ? 'Реплики появятся автоматически' : 'Реплика завершится автоматически после паузы' : 'Реплики появятся в диалоге после сохранения'}</small></div>
      {active && <button className="voice-controls__stop" type="button" onClick={onStop}>Остановить</button>}
    </div>
  )
}
