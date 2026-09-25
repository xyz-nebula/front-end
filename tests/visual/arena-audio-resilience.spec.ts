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

  expect(result.afterFailure).toEqual({
    dialogOpen: true,
    error: 'Backend finish unavailable',
  })
  expect(result.finishCommands).toHaveLength(2)
  expect(result.finishCommands[0]).toBe(result.finishCommands[1])
  expect(result.audio.stopCalls).toBeGreaterThanOrEqual(2)
  expect(result.audio.disconnectCalls).toBeGreaterThanOrEqual(2)
  expect(result.reachedResult).toBe(true)
  expect(result.unhandled).toEqual([])
})
