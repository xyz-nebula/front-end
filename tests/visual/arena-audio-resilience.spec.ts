import { expect, test } from './helpers'

test('audio client and pending connection work stay bound to the current arena context', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { runAudioContextScenario } = await import('/tests/visual/arena-audio-harness.tsx')
    return runAudioContextScenario()
  })

  expect(result).toEqual({
    whileBConnects: {
      reconnectBCalls: 1,
      partial: { user: '', ai: '' },
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
    },
    unmountStopCalls: 1,
  })
})
