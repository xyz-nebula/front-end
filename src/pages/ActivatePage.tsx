import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import '@/styles/activation.css'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ActivationState =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; canRetry: boolean }

interface ActivationLayoutProps {
  state: ActivationState['kind']
  title: string
  description: string
  children: ReactNode
}

function getRegistrationEmail(state: unknown) {
  if (typeof state !== 'object' || state === null) return ''
  if (!('registrationComplete' in state) || state.registrationComplete !== true) return ''
  if (!('email' in state) || typeof state.email !== 'string') return ''
  return state.email.trim()
}

function getDemoActivationCode(state: unknown) {
  if (typeof state !== 'object' || state === null) return ''
  if (!('demoActivationCode' in state) || typeof state.demoActivationCode !== 'string') return ''
  return uuidPattern.test(state.demoActivationCode) ? state.demoActivationCode : ''
}

function getInitialState(code: string, registrationEmail: string): ActivationState {
  if (code && uuidPattern.test(code)) return { kind: 'checking' }
  if (code) {
    return {
      kind: 'error',
      message: 'Код в ссылке имеет неверный формат. Проверьте, что ссылка из письма скопирована полностью.',
      canRetry: false,
    }
  }
  if (registrationEmail) return { kind: 'waiting' }
  return {
    kind: 'error',
    message: 'В ссылке нет кода активации. Откройте полную ссылку из письма или войдите, если аккаунт уже активирован.',
    canRetry: false,
  }
}

function ActivationMark({ state }: { state: ActivationState['kind'] }) {
  return (
    <div className={`activation-page__mark activation-page__mark--${state}`} aria-hidden="true">
      {state === 'waiting' && (
        <svg viewBox="0 0 48 48">
          <rect x="6" y="11" width="36" height="27" rx="4" />
          <path d="m8 15 16 12 16-12" />
        </svg>
      )}
      {state === 'checking' && <span className="activation-page__spinner" />}
      {state === 'success' && <svg viewBox="0 0 48 48"><path d="m10 24 10 10 19-21" /></svg>}
      {state === 'error' && <svg viewBox="0 0 48 48"><path d="M24 11v17" /><path d="M24 36h.01" /></svg>}
    </div>
  )
}

function ActivationLayout({ state, title, description, children }: ActivationLayoutProps) {
  return (
    <main className={`activation-page activation-page--${state}`}>
      <header className="activation-page__header">
        <Link className="activation-page__brand" to="/" aria-label="Арена переговоров — на главную">
          <ArenaCubeMark className="activation-page__brand-mark" />
          <span>Арена переговоров</span>
        </Link>
      </header>
      <section className="activation-page__card" aria-labelledby="activation-title">
        <ActivationMark state={state} />
        <h1 id="activation-title">{title}</h1>
        <p className="activation-page__description">{description}</p>
        {children}
      </section>
    </main>
  )
}

export function ActivatePage() {
  const { activate } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryCode = searchParams.get('code')?.trim() ?? ''
  const registrationEmail = getRegistrationEmail(location.state)
  const demoActivationCode = getDemoActivationCode(location.state)
  const [activationState, setActivationState] = useState<ActivationState>(() => (
    getInitialState(queryCode, registrationEmail)
  ))
  const [showResendNotice, setShowResendNotice] = useState(false)
  const attemptedQueryCodeRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  const submitActivation = useCallback(async (activationCode: string) => {
    if (!uuidPattern.test(activationCode)) {
      setActivationState({
        kind: 'error',
        message: 'Код в ссылке имеет неверный формат. Проверьте, что ссылка из письма скопирована полностью.',
        canRetry: false,
      })
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setActivationState({ kind: 'checking' })

    try {
      await activate(activationCode)
      if (requestIdRef.current === requestId) setActivationState({ kind: 'success' })
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      const fieldMessage = getFieldErrors(error).code
      setActivationState({
        kind: 'error',
        message: fieldMessage ?? getErrorMessage(error, 'Не удалось активировать аккаунт. Попробуйте ещё раз.'),
        canRetry: true,
      })
    }
  }, [activate])

  useEffect(() => {
    if (!queryCode || attemptedQueryCodeRef.current === queryCode) return
    attemptedQueryCodeRef.current = queryCode
    void submitActivation(queryCode)
  }, [queryCode, submitActivation])

  if (activationState.kind === 'waiting') {
    return (
      <ActivationLayout state="waiting" title="Проверьте почту" description="Мы отправили письмо со ссылкой для активации аккаунта.">
        <div className="activation-page__email">{registrationEmail}</div>
        <div className="activation-page__instructions">
          <p>Перейдите по ссылке в письме, чтобы подтвердить электронную почту.</p>
          <p>После подтверждения можно будет продолжить работу в Арене.</p>
        </div>
        {demoActivationCode && (
          <Link className="activation-page__demo-link" to={`/activate?code=${encodeURIComponent(demoActivationCode)}`}>
            Открыть demo-ссылку активации
          </Link>
        )}
        <div className="activation-page__waiting-actions">
          <p>Не получили письмо? <button type="button" onClick={() => setShowResendNotice(true)}>Отправить повторно</button></p>
          {showResendNotice && (
            <p className="activation-page__notice" role="status">Письмо отправлено при регистрации. Повторная отправка пока недоступна.</p>
          )}
          <p>Уже подтвердили почту? <Link to="/login">Войти</Link></p>
        </div>
        <Link className="activation-page__back" to="/"><span aria-hidden="true">←</span> На главную</Link>
      </ActivationLayout>
    )
  }

  if (activationState.kind === 'checking') {
    return (
      <ActivationLayout state="checking" title="Активируем аккаунт" description="Проверяем код из ссылки. Обычно это занимает несколько секунд.">
        <div className="activation-page__message" role="status" aria-live="polite">
          <strong>Проверяем ссылку…</strong>
          <p>Не закрывайте страницу, пока мы подтверждаем вашу почту.</p>
        </div>
      </ActivationLayout>
    )
  }

  if (activationState.kind === 'success') {
    return (
      <ActivationLayout state="success" title="Аккаунт активирован" description="Электронная почта подтверждена. Теперь можно перейти к тренировкам.">
        <div className="activation-page__message activation-page__message--success" role="status">
          <strong>Добро пожаловать в Арену</strong>
          <p>Ваш аккаунт готов к работе.</p>
        </div>
        <Link className="activation-page__action" to="/home">Перейти в приложение <span aria-hidden="true">→</span></Link>
      </ActivationLayout>
    )
  }

  return (
    <ActivationLayout state="error" title="Ссылка не сработала" description="Не удалось подтвердить почту по этой ссылке.">
      <div className="activation-page__error" role="alert">{activationState.message}</div>
      {activationState.canRetry && (
        <button className="activation-page__action" type="button" onClick={() => void submitActivation(queryCode)}>
          Попробовать снова <span aria-hidden="true">→</span>
        </button>
      )}
      <p className="activation-page__error-login">Аккаунт уже активирован? <Link to="/login">Войти</Link></p>
      <Link className="activation-page__back" to="/"><span aria-hidden="true">←</span> На главную</Link>
    </ActivationLayout>
  )
}
