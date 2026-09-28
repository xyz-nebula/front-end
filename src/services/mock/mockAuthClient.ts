import { AuthClientError, type AuthClient } from '@/services/contracts/authClient'
import { MockStorage, type MockUserRecord } from '@/services/mock/mockStorage'
import type { AuthTokens } from '@/types/auth'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('ru-RU')
}

function issueTokens(user: MockUserRecord): AuthTokens {
  const nonce = crypto.randomUUID()
  const refreshToken = `mock-refresh:${user.id}:${nonce}`
  user.refreshTokens.push(refreshToken)
  return {
    accessToken: `mock-access:${user.id}:${nonce}`,
    refreshToken,
  }
}

function fieldError(field: string, message: string, status = 422): AuthClientError {
  return new AuthClientError(status, message, { [field]: message })
}

export class MockAuthClient implements AuthClient {
  constructor(
    private readonly storage: MockStorage,
    private readonly latencyMs: number,
  ) {}

  private async delay(): Promise<void> {
    await wait(this.latencyMs)
  }

  async register(payload: Parameters<AuthClient['register']>[0]) {
    await this.delay()
    return this.storage.mutate((data) => {
      const email = normalizeEmail(payload.email)
      if (data.users.some((user) => user.email === email)) {
        throw fieldError('email', 'Пользователь с таким email уже существует.', 409)
      }
      const user: MockUserRecord = {
        id: crypto.randomUUID(),
        email,
        firstName: payload.first_name.trim(),
        lastName: payload.last_name.trim(),
        password: payload.password,
        status: 'pending_activation',
        activationCode: crypto.randomUUID(),
        refreshTokens: [],
        totpEnabled: false,
      }
      data.users.push(user)
      return {
        user_id: user.id,
        status: user.status,
        demo_activation_code: user.activationCode,
      }
    })
  }

  async activate(code: string): Promise<AuthTokens> {
    await this.delay()
    return this.storage.mutate((data) => {
      const user = data.users.find((candidate) => candidate.activationCode === code)
      if (!user || user.status !== 'pending_activation') {
        throw fieldError('code', 'Ссылка истекла или уже была использована.')
      }
      user.status = 'active'
      return issueTokens(user)
    })
  }

  async login(payload: Parameters<AuthClient['login']>[0]): Promise<AuthTokens> {
    await this.delay()
    return this.storage.mutate((data) => {
      const user = data.users.find((candidate) => candidate.email === normalizeEmail(payload.email))
      if (!user || user.password !== payload.password) {
        throw new AuthClientError(401, 'Неверный email или пароль.')
      }
      if (user.status !== 'active') {
        throw new AuthClientError(403, 'Сначала активируйте аккаунт по demo-ссылке.')
      }
      if (user.totpEnabled && !/^\d{6}$/.test(payload.totp_token ?? '')) {
        throw fieldError('totp_token', 'Введите шестизначный код 2FA.', 401)
      }
      return issueTokens(user)
    })
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    await this.delay()
    return this.storage.mutate((data) => {
      const user = data.users.find((candidate) => candidate.refreshTokens.includes(refreshToken))
      if (!user || user.status !== 'active') throw new AuthClientError(401, 'Сессия истекла.')
      user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken)
      return issueTokens(user)
    })
  }

  async logout(_accessToken: string, refreshToken: string): Promise<void> {
    await this.delay()
    await this.storage.mutate((data) => {
      const user = data.users.find((candidate) => candidate.refreshTokens.includes(refreshToken))
      if (user) user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken)
    })
  }

  private findByAccessToken(users: MockUserRecord[], accessToken: string): MockUserRecord {
    const user = users.find((candidate) => accessToken.startsWith(`mock-access:${candidate.id}:`))
    if (!user || user.status !== 'active') throw new AuthClientError(401, 'Сессия истекла.')
    return user
  }

  async enrollTotp(accessToken: string) {
    await this.delay()
    return this.storage.mutate((data) => {
      const user = this.findByAccessToken(data.users, accessToken)
      user.totpSecret = 'JBSWY3DPEHPK3PXP'
      return {
        secret: user.totpSecret,
        otpauth_url: `otpauth://totp/Arena:${encodeURIComponent(user.email)}?secret=${user.totpSecret}&issuer=Arena`,
      }
    })
  }

  async confirmTotp(accessToken: string, totpToken: string): Promise<void> {
    await this.delay()
    await this.storage.mutate((data) => {
      const user = this.findByAccessToken(data.users, accessToken)
      if (!user.totpSecret || !/^\d{6}$/.test(totpToken)) {
        throw fieldError('totp_token', 'Введите шестизначный код из приложения.')
      }
      user.totpEnabled = true
    })
  }

  async disableTotp(accessToken: string, password: string): Promise<void> {
    await this.delay()
    await this.storage.mutate((data) => {
      const user = this.findByAccessToken(data.users, accessToken)
      if (user.password !== password) throw fieldError('password', 'Неверный пароль.', 401)
      user.totpEnabled = false
      delete user.totpSecret
    })
  }
}
