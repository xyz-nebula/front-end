import type { NegotiationClient } from '@/services/contracts/negotiationClient'
import { featureUnavailable } from '@/types/api'

export class BackendNegotiationClient implements NegotiationClient {
  async createSession(): ReturnType<NegotiationClient['createSession']> {
    throw featureUnavailable('negotiation')
  }

  async getSession(): ReturnType<NegotiationClient['getSession']> {
    throw featureUnavailable('negotiation')
  }

  async sendTextTurn(): ReturnType<NegotiationClient['sendTextTurn']> {
    throw featureUnavailable('negotiation')
  }

  async createAudioTicket(): ReturnType<NegotiationClient['createAudioTicket']> {
    throw featureUnavailable('negotiation')
  }

  async finishSession(): ReturnType<NegotiationClient['finishSession']> {
    throw featureUnavailable('negotiation')
  }

  async getResult(): ReturnType<NegotiationClient['getResult']> {
    throw featureUnavailable('negotiation')
  }

  async listSessions(): ReturnType<NegotiationClient['listSessions']> {
    throw featureUnavailable('negotiation')
  }
}
