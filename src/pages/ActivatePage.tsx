import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { AuthShell } from '@/components/auth/AuthShell'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ActivationState =
  | { kind: 'waiting' }
  | { kind: 'checking' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; canRetry: boolean }

function getRegistrationEmail(state: unknown) {
  if (typeof state !== 'object' || state === null) return ''
  if (!('registrationComplete' in state) || state.registrationComplete !== true) return ''
  if (!('email' in state) || typeof state.email !== 'string') return ''
  return state.email.trim()
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
  if (state === 'checking') {
    return <div className="activation-mark activation-mark--checking" aria-hidden="true"><span /></div>
  }

  return (
    <div className={`activation-mark activation-mark--${state}`} aria-hidden="true">
      {state === 'waiting' && (
        <svg viewBox="0 0 32 32">
          <rect x="4.5" y="7.5" width="23" height="17" rx="3" />
          <path d="m6 10 10 7.5L26 10" />
        </svg>
      )}
      {state === 'success' && <svg viewBox="0 0 32 32"><path d="m8 16.5 5.2 5.2L24.5 10" /></svg>}
      {state === 'error' && (
        <svg viewBox="0 0 32 32">
          <path d="M16 8v10" />
          <path d="M16 23.5h.01" />
        </svg>
      )}
    </div>
  )
}

export function ActivatePage() {
  const { activate } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryCode = searchParams.get('code')?.trim() ?? ''
  const registrationEmail = getRegistrationEmail(location.state)
  const [activationState, setActivationState] = useState<ActivationState>(() => (
    getInitialState(queryCode, registrationEmail)
  ))
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
        message: fieldMessage ?? getErrorMessage(
          error,
          'Не удалось активировать аккаунт. Попробуйте ещё раз или запросите новую ссылку.',
        ),
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
      <AuthShell
        eyebrow="Активация"
        title="Проверьте почту"
        description="Мы отправили письмо со ссылкой для активации аккаунта."
      >
        <div className="activation-state activation-state--waiting">
          <ActivationMark state="waiting" />
          <div className="activation-email">{registrationEmail}</div>
          <p>Перейдите по ссылке в письме — код подставится и проверится автоматически.</p>
        </div>
        <p className="auth-switch">Уже активировали аккаунт? <Link to="/login">Войти</Link></p>
        <Link className="auth-back-link" to="/">← На главную</Link>
      </AuthShell>
    )
  }

  if (activationState.kind === 'checking') {
    return (
      <AuthShell
        eyebrow="Активация"
        title="Активируем аккаунт"
        description="Проверяем код из ссылки. Обычно это занимает несколько секунд."
      >
        <div className="activation-state" role="status" aria-live="polite">
          <ActivationMark state="checking" />
          <strong>Проверяем ссылку…</strong>
          <p>Не закрывайте страницу, пока мы подтверждаем ваш email.</p>
        </div>
      </AuthShell>
    )
  }

  if (activationState.kind === 'success') {
    return (
      <AuthShell
        eyebrow="Готово"
        title="Аккаунт активирован"
        description="Email подтверждён, а сессия уже сохранена. Можно переходить к тренировкам."
      >
        <div className="activation-state activation-state--success" role="status">
          <ActivationMark state="success" />
          <strong>Добро пожаловать на Арену</strong>
          <p>Вы успешно активировали аккаунт.</p>
        </div>
        <AppButton to="/home" className="activation-action" icon={<ArrowIcon />}>
          Перейти в приложение
        </AppButton>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Ошибка активации"
      title="Ссылка не сработала"
      description="Не удалось подтвердить email по этой ссылке."
    >
      <div className="activation-state activation-state--error">
        <ActivationMark state="error" />
        <div className="form-alert" role="alert">{activationState.message}</div>
      </div>
      {activationState.canRetry && (
        <AppButton
          type="button"
          className="activation-action"
          icon={<ArrowIcon />}
          onClick={() => void submitActivation(queryCode)}
        >
          Попробовать снова
        </AppButton>
      )}
      <p className="auth-switch">Аккаунт уже активирован? <Link to="/login">Войти</Link></p>
      <Link className="auth-back-link" to="/">← На главную</Link>
    </AuthShell>
  )
}
