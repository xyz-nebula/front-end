import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCompletedTranscriptDraft,
  findNewPersistedMessage,
  mergeMessages,
  reconcileCompletedTranscript,
} from '../../src/features/arena/messageReconciliation.ts'

function message(id, sequence, speaker, text) {
  return { id, sequence, speaker, text, createdAt: `2026-09-28T00:00:0${sequence}Z` }
}

test('completed transcripts replace the previous draft instead of appending to it', () => {
  const first = createCompletedTranscriptDraft('Первая реплика', 1)
  const second = createCompletedTranscriptDraft('Вторая реплика', 2)

  assert.equal(first.targetText, 'Первая реплика')
  assert.equal(second.targetText, 'Вторая реплика')
  assert.equal(second.text, '')
  assert.equal(second.completionId, 2)
})

test('an existing message with the same text cannot confirm a new transcript', () => {
  const oldMessage = message('old', 1, 'user', 'Да')
  const candidate = findNewPersistedMessage({
    messages: [oldMessage],
    baselineMessageIds: new Set([oldMessage.id]),
    claimedMessageIds: new Set(),
    speaker: 'user',
    text: 'Да',
  })

  assert.equal(candidate, undefined)
})

test('identical consecutive transcripts claim different persisted messages', () => {
  const oldMessage = message('old', 1, 'user', 'Да')
  const firstNewMessage = message('new-1', 2, 'user', 'Да')
  const secondNewMessage = message('new-2', 3, 'user', 'Да')
  const baselineMessageIds = new Set([oldMessage.id])
  const claimedMessageIds = new Set()
  const messages = [oldMessage, firstNewMessage, secondNewMessage]

  const first = findNewPersistedMessage({
    messages,
    baselineMessageIds,
    claimedMessageIds,
    speaker: 'user',
    text: 'Да',
  })
  assert.equal(first?.id, firstNewMessage.id)
  claimedMessageIds.add(first.id)

  const second = findNewPersistedMessage({
    messages,
    baselineMessageIds,
    claimedMessageIds,
    speaker: 'user',
    text: 'Да',
  })
  assert.equal(second?.id, secondNewMessage.id)
})

test('a stale refresh cannot remove newer messages', () => {
  const first = message('one', 1, 'user', 'Первая')
  const second = message('two', 2, 'ai', 'Вторая')

  assert.deepEqual(mergeMessages([first, second], [first]), [first, second])
})

test('incoming messages replace matching IDs and remain sequence ordered', () => {
  const first = message('one', 1, 'user', 'Черновик')
  const corrected = message('one', 1, 'user', 'Итог')
  const second = message('two', 2, 'ai', 'Ответ')

  assert.deepEqual(mergeMessages([second, first], [corrected]), [corrected, second])
})

test('reconciliation stops without refreshing after its session becomes stale', async () => {
  let current = true
  let refreshCount = 0

  const result = await reconcileCompletedTranscript({
    speaker: 'user',
    text: 'Поздняя реплика',
    baselineMessageIds: new Set(),
    claimedMessageIds: new Set(),
    persistedMessageIds: new Set(),
    delays: [250],
    wait: async () => { current = false },
    refresh: async () => {
      refreshCount += 1
      return { messages: [] }
    },
    isCurrent: () => current,
  })

  assert.deepEqual(result, { status: 'stale' })
  assert.equal(refreshCount, 0)
})
