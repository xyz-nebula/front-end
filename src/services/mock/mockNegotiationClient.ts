import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { MockRuntime } from '@/services/mock/mockRuntime'
import type { NegotiationSessionSummary } from '@/types/negotiation'
import { ServiceError } from '@/types/api'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export class MockNegotiationClient implements NegotiationClient {
  constructor(
    private readonly runtime: MockRuntime,
    private readonly ownerKey: string | null,
    private readonly latencyMs: number,
  ) {}

  private requireOwner(): string {
    if (!this.ownerKey) {
      throw new ServiceError('Войдите, чтобы начать переговоры.', {
        reason: 'http',
        status: 401,
        code: 'MOCK_AUTH_REQUIRED',
      })
    }
    return this.ownerKey
  }

  private async delay(): Promise<void> {
    await wait(this.latencyMs)
  }

  async createSession(input: Parameters<NegotiationClient['createSession']>[0]) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.createSession(ownerKey, input)
  }

  async getSession(sessionId: string) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.getSession(ownerKey, sessionId)
  }

  async sendTextTurn(input: Parameters<NegotiationClient['sendTextTurn']>[0]) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.sendTextTurn(ownerKey, input)
  }

  async createAudioTicket(sessionId: string) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.createAudioTicket(ownerKey, sessionId)
  }

  async finishSession(input: Parameters<NegotiationClient['finishSession']>[0]) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.finishSession(ownerKey, input.sessionId, input.clientCommandId, this.latencyMs * 2)
  }

  async getResult(sessionId: string) {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.getResult(ownerKey, sessionId)
  }

  async listSessions(): Promise<NegotiationSessionSummary[]> {
    const ownerKey = this.requireOwner()
    await this.delay()
    return this.runtime.storage.read((data) => data.sessions
      .filter((session) => session.ownerKey === ownerKey)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map((session) => {
        const result = data.results.find((candidate) => candidate.sessionId === session.id)
        return {
          id: session.id,
          caseId: session.caseId,
          mode: session.mode,
          status: session.status,
          startedAt: session.startedAt,
          ...(session.finishedAt ? { finishedAt: session.finishedAt } : {}),
          ...(result?.result ? { score: result.result.score } : {}),
        }
      }))
  }
}
