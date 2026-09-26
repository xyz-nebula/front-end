import { act } from 'react'
import { createRoot } from 'react-dom/client'

import { VoiceControls } from '@/components/arena/VoiceControls'

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function runVoiceControlsVisualizationScenario() {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  host.className = 'arena-page'
  document.body.append(host)
  const root = createRoot(host)
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
    await wait(40)
    const idleLevel = readLevel()
    level = 1
    await wait(350)
    const loudLevel = readLevel()
    await render({ isPlaying: true })
    await wait(300)
    const aiLevel = readLevel()
    await render({ isDemo: true, isUserSpeaking: true })
    await wait(150)
    const demoLevel = readLevel()
    await render({ isDemo: true, isUserSpeaking: false })
    await wait(300)
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
    await wait(120)
    return Number.parseFloat(
      (host.querySelector('.voice-controls') as HTMLElement).style.getPropertyValue('--voice-level'),
    )
  } finally {
    await act(async () => root.unmount())
    host.remove()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  }
}
