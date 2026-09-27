import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { VoiceControls } from '@/components/arena/VoiceControls'

class ManualAnimationClock {
  private readonly originalRequestAnimationFrame = window.requestAnimationFrame
  private readonly originalCancelAnimationFrame = window.cancelAnimationFrame
  private readonly originalPerformanceNow = Object.getOwnPropertyDescriptor(performance, 'now')
  private readonly callbacks = new Map<number, FrameRequestCallback>()
  private nextId = 1
  private now = performance.now()

  install(): void {
    window.requestAnimationFrame = (callback) => {
      const id = this.nextId
      this.nextId += 1
      this.callbacks.set(id, callback)
      return id
    }
    window.cancelAnimationFrame = (id) => { this.callbacks.delete(id) }
    Object.defineProperty(performance, 'now', { configurable: true, value: () => this.now })
  }

  advance(frames: number, frameDuration = 16): void {
    for (let frame = 0; frame < frames; frame += 1) {
      this.now += frameDuration
      const pending = [...this.callbacks.values()]
      this.callbacks.clear()
      pending.forEach((callback) => callback(this.now))
    }
  }

  restore(): void {
    window.requestAnimationFrame = this.originalRequestAnimationFrame
    window.cancelAnimationFrame = this.originalCancelAnimationFrame
    if (this.originalPerformanceNow) {
      Object.defineProperty(performance, 'now', this.originalPerformanceNow)
    } else {
      delete (performance as Performance & { now?: () => number }).now
    }
  }
}

export async function runVoiceControlsVisualizationScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  host.className = 'arena-page'
  document.body.append(host)
  const root = createRoot(host)
  const clock = new ManualAnimationClock()
  clock.install()
  let level = 0

  const render = async (input: { isPlaying?: boolean; isDemo?: boolean; isUserSpeaking?: boolean; state?: 'connected' | 'paused' }) => {
    await act(async () => {
      root.render(
        <VoiceControls
          state={input.state ?? 'connected'}
          error={null}
          isPlaying={input.isPlaying ?? false}
          disabled={false}
          isDemo={input.isDemo ?? false}
          isUserSpeaking={input.isUserSpeaking ?? false}
          getInputLevel={() => level}
          onConnect={() => undefined}
          onPause={() => undefined}
          onResume={() => undefined}
          onStop={() => undefined}
        />,
      )
    })
  }
  const readLevel = () => Number.parseFloat(
    (host.querySelector('.voice-controls') as HTMLElement).style.getPropertyValue('--voice-level'),
  )

  try {
    await render({})
    clock.advance(3)
    const idleLevel = readLevel()
    level = 1
    clock.advance(22)
    const loudLevel = readLevel()
    await render({ isPlaying: true })
    clock.advance(19)
    const aiLevel = readLevel()
    await render({ isDemo: true, isUserSpeaking: true })
    clock.advance(10)
    const demoLevel = readLevel()
    await render({ isDemo: true, isUserSpeaking: false })
    clock.advance(19)
    const quietDemoLevel = readLevel()
    return {
      idleLevel,
      loudLevel,
      aiLevel,
      demoLevel,
      quietDemoLevel,
      rings: host.querySelectorAll('.voice-controls__ring').length,
      bars: host.querySelectorAll('.voice-controls__equalizer i').length,
    }
  } finally {
    await act(async () => root.unmount())
    clock.restore()
    host.remove()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  }
}

export async function runReducedMotionVisualizationScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  host.className = 'arena-page'
  document.body.append(host)
  const root = createRoot(host)
  const clock = new ManualAnimationClock()
  clock.install()
  try {
    await act(async () => {
      root.render(
        <VoiceControls
          state="connected"
          error={null}
          isPlaying={false}
          disabled={false}
          isDemo={false}
          isUserSpeaking
          getInputLevel={() => 1}
          onConnect={() => undefined}
          onPause={() => undefined}
          onResume={() => undefined}
          onStop={() => undefined}
        />,
      )
    })
    clock.advance(8)
    return Number.parseFloat(
      (host.querySelector('.voice-controls') as HTMLElement).style.getPropertyValue('--voice-level'),
    )
  } finally {
    await act(async () => root.unmount())
    clock.restore()
    host.remove()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  }
}
