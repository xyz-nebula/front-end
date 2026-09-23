import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import type { RunAuthorized } from '@/services/serviceAdapters'
import { featureUnavailable } from '@/types/api'

export class BackendNegotiationClient implements NegotiationClient {
  constructor(private readonly runAuthorized?: RunAuthorized) {}

  private unavailable<T>(): Promise<T> {
    if (!this.runAuthorized) return Promise.reject(featureUnavailable('negotiation'))
    return this.runAuthorized(async (accessToken) => {
      void accessToken
      throw featureUnavailable('negotiation')
    })
  }

  async createSession(): ReturnType<NegotiationClient['createSession']> {
    return this.unavailable()
  }

  async getSession(): ReturnType<NegotiationClient['getSession']> {
    return this.unavailable()
  }

  async sendTextTurn(): ReturnType<NegotiationClient['sendTextTurn']> {
    return this.unavailable()
  }

  async createAudioTicket(): ReturnType<NegotiationClient['createAudioTicket']> {
    return this.unavailable()
  }

  async finishSession(): ReturnType<NegotiationClient['finishSession']> {
    return this.unavailable()
  }

  async getResult(): ReturnType<NegotiationClient['getResult']> {
    return this.unavailable()
  }

  async listSessions(): ReturnType<NegotiationClient['listSessions']> {
    return this.unavailable()
  }
}
