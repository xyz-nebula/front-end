import { expect, test } from './helpers'

test('normalizes microphone loudness with an adaptive noise floor', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { AdaptiveVoiceLevel } = await import('/src/features/arena/voiceLevel.ts')
    const meter = new AdaptiveVoiceLevel()
    const invalid = [meter.push(Number.NaN), meter.push(-1), meter.push(0)]
    const background = Array.from({ length: 180 }, () => meter.push(0.003))
    const quietSpeech = meter.push(0.012)
    const loudSpeech = meter.push(0.25)
    const clipped = meter.push(2)
    meter.reset()
    return {
      invalid,
      initialBackground: background[0],
      settledBackground: background.at(-1),
      quietSpeech,
      loudSpeech,
      clipped,
      resetSilence: meter.push(0),
    }
  })

  expect(result.invalid).toEqual([0, 0, 0])
  expect(result.initialBackground).toBeGreaterThan(0)
  expect(result.settledBackground).toBe(0)
  expect(result.quietSpeech).toBeGreaterThan(0)
  expect(result.loudSpeech).toBeGreaterThan(result.quietSpeech)
  expect(result.clipped).toBe(1)
  expect(result.resetSilence).toBe(0)
})

test('voice controls react to input, mock speech and AI playback without rerenders', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runVoiceControlsVisualizationScenario } = await import('/tests/visual/voice-controls-harness.tsx')
    return runVoiceControlsVisualizationScenario()
  })

  expect(result.rings).toBe(3)
  expect(result.bars).toBe(18)
  expect(result.idleLevel).toBeLessThan(0.01)
  expect(result.loudLevel).toBeGreaterThan(0.7)
  expect(result.aiLevel).toBeLessThan(0.3)
  expect(result.demoLevel).toBeGreaterThan(0.1)
  expect(result.quietDemoLevel).toBeLessThan(0.2)
})

test('voice visualization stays static with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const level = await page.evaluate(async () => {
    const { runReducedMotionVisualizationScenario } = await import('/tests/visual/voice-controls-harness.tsx')
    return runReducedMotionVisualizationScenario()
  })

  expect(level).toBe(0)
})

test('capture worklet messages preserve PCM and expose a resettable input level', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runCaptureLevelScenario } = await import('/tests/visual/capture-level-harness.tsx')
    return runCaptureLevelScenario()
  })

  expect(result.activeLevel).toBeGreaterThan(0.8)
  expect(result.pausedLevel).toBe(0)
  expect(result.sent).toEqual(['AAECAw=='])
  expect(result.portMessages).toContain('pause')
  expect(result.controls).toEqual(['pause', 'stop'])
  expect(result.stoppedTracks).toBeGreaterThan(0)
})

test('audio client and pending connection work stay bound to the current arena context', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runAudioContextScenario } = await import('/tests/visual/arena-audio-harness.tsx')
    return runAudioContextScenario()
  })

  expect(result).toEqual({
    whileBConnects: {
      reconnectBCalls: 1,
      partial: { user: null, ai: null },
      clientAConnects: 0,
    },
    afterReconnect: {
      ticketsB: ['ticket-b-1', 'ticket-b-2'],
      committed: ['message-b'],
      clientADisconnects: 1,
      clientAListeners: 0,
    },
    afterUserChange: { clientBDisconnects: 1, clientBListeners: 0 },
    afterUnmount: { disconnects: 1, listeners: 0 },
  })
})

test('transcript deltas type into one bubble and committed text does not flash or duplicate', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runTranscriptStreamingScenario } = await import('/tests/visual/arena-audio-harness.tsx')
    return runTranscriptStreamingScenario()
  })

  expect(result.duringDelta).toMatchObject({
    target: 'Добрый день',
    bubbles: 1,
    hasEmptyState: true,
  })
  expect(result.duringDelta.displayed).not.toBe('Добрый день')
  expect(result.duringDelta.displayed?.length).toBeGreaterThan(0)
  expect(result.immediatelyAfterCommit).toMatchObject({ phase: 'finishing', bubbles: 1 })
  expect(result.immediatelyAfterCommit.displayed).not.toBe('Добрый день')
  expect(result.afterCommit).toEqual({
    partial: null,
    texts: ['Добрый день'],
    bubbles: 1,
  })
  expect(result.userSnapshot.target).toBe('Моя реплика')
  expect(result.userSnapshot.displayed?.length).toBeGreaterThan(0)
  expect(result.userSnapshot.displayed).not.toBe('Моя реплика')
})

test('queues PCM frames and invalidates scheduled playback during cleanup', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runAudioPlaybackScenario } = await import('/tests/visual/arena-audio-playback-harness.tsx')
    return runAudioPlaybackScenario()
  })

  expect(result).toEqual({
    queued: {
      startTimes: [10, 10.01],
      stopCalls: [0, 0],
      isPlaying: true,
    },
    pausedAndResumed: {
      suspendCalls: 1,
      manualResumeCalls: 1,
      stopCalls: [0, 0],
      hasError: true,
    },
    playingAfterFirstEnd: true,
    playingAfterQueueEnd: false,
    decodeFailure: { committed: ['saved-message'], hasError: true },
    afterArenaChange: {
      stops: [1, 1],
      oldContextClosed: 1,
      isPlaying: false,
    },
    afterStop: {
      stops: [1, 1],
      isPlaying: false,
      controls: ['stop'],
      disconnectCalls: 1,
      stopRejected: false,
      hasError: true,
    },
    unmountStopCalls: 1,
  })
})

test('audio transport failures do not block finish or leak rejected promises', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runAudioFinishFailureScenario } = await import('/tests/visual/arena-finish-harness.tsx')
    return runAudioFinishFailureScenario()
  })

  expect(result.finishCommands).toHaveLength(2)
  expect(result.afterFailure).toEqual({
    dialogOpen: true,
    error: 'Backend finish unavailable',
  })
  expect(result.finishCommands[0]).toBe(result.finishCommands[1])
  expect(result.audio.stopCalls).toBeGreaterThanOrEqual(2)
  expect(result.audio.disconnectCalls).toBeGreaterThanOrEqual(2)
  expect(result.reachedResult).toBe(true)
  expect(result.unhandled).toEqual([])
})
