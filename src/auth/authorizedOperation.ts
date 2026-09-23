import { isHttpUnauthorizedError } from '@/services/contracts/authClient'

interface AuthorizedOperationContext {
  accessToken: string
  sessionGeneration: number
  getSessionGeneration: () => number
  getSessionVersion: () => number
  refreshSession: () => Promise<{ accessToken: string }>
  clearSession: () => void
}

export class StaleAuthorizedOperationError extends Error {
  constructor() {
    super('Сессия изменилась во время выполнения операции.')
    this.name = 'StaleAuthorizedOperationError'
  }
}

export async function executeAuthorizedOperation<T>(
  operation: (accessToken: string) => Promise<T>,
  context: AuthorizedOperationContext,
): Promise<T> {
  const assertSessionIsCurrent = () => {
    if (context.getSessionGeneration() !== context.sessionGeneration) {
      throw new StaleAuthorizedOperationError()
    }
  }

  try {
    assertSessionIsCurrent()
    const result = await operation(context.accessToken)
    assertSessionIsCurrent()
    return result
  } catch (error) {
    assertSessionIsCurrent()
    if (!isHttpUnauthorizedError(error)) throw error
  }

  assertSessionIsCurrent()
  const retryTokens = await context.refreshSession()
  assertSessionIsCurrent()

  const retryVersion = context.getSessionVersion()
  try {
    assertSessionIsCurrent()
    const result = await operation(retryTokens.accessToken)
    assertSessionIsCurrent()
    return result
  } catch (error) {
    assertSessionIsCurrent()
    if (
      isHttpUnauthorizedError(error)
      && context.getSessionVersion() === retryVersion
    ) {
      context.clearSession()
    }
    throw error
  }
}
