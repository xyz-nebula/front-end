import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import '@/styles/login.css'

interface LoginFields {
  email: string
  password: string
  totp_token: string
}

function getReturnPath(state: unknown) {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/home'
  const from = (state as { from?: unknown }).from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/home'
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [fields, setFields] = useState<LoginFields>({ email: '', password: '', totp_token: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isTotpVisible, setIsTotpVisible] = useState(false)

  const updateField = (name: keyof LoginFields, value: string) => {
    const nextValue = name === 'totp_token' ? value.replace(/\D/g, '').slice(0, 6) : value
    setFields((current) => ({ ...current, [name]: nextValue }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  const toggleTotp = () => {
    if (isTotpVisible) updateField('totp_token', '')
    setIsTotpVisible((current) => !current)
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!fields.email.trim()) nextErrors.email = 'Введите email.'
    else if (fields.email.length > 254 || !/^\S+@\S+\.\S+$/.test(fields.email)) nextErrors.email = 'Введите корректный email.'
    if (fields.password.length < 8) nextErrors.password = 'Пароль должен содержать не менее 8 символов.'
    else if (fields.password.length > 128) nextErrors.password = 'Пароль не должен быть длиннее 128 символов.'
    if (isTotpVisible && fields.totp_token && !/^\d{6}$/.test(fields.totp_token)) nextErrors.totp_token = 'Введите шестизначный код.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setFormError('')
    try {
      await login({
        email: fields.email.trim(),
        password: fields.password,
        ...(isTotpVisible && fields.totp_token ? { totp_token: fields.totp_token } : {}),
      })
      navigate(getReturnPath(location.state), { replace: true })
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      if (fieldErrors.totp_token) setIsTotpVisible(true)
      setErrors(fieldErrors)
      setFormError(getErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <header className="login-page__header">
        <Link className="login-page__brand" to="/" aria-label="Арена переговоров — на главную">
          <ArenaCubeMark className="login-page__brand-mark" />
          <span>Арена переговоров</span>
        </Link>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card__heading">
          <h1 id="login-title">С возвращением</h1>
          <p>Продолжите тренировки там, где остановились</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {formError && <div className="login-form__alert" role="alert">{formError}</div>}

          <div className="login-field">
            <label htmlFor="login-email">Электронная почта</label>
            <input id="login-email" name="email" type="email" aria-label="Email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined} autoComplete="email" placeholder="name@example.com" value={fields.email} maxLength={254} onChange={(event) => updateField('email', event.target.value)} />
            {errors.email && <span className="login-field__error" id="login-email-error">{errors.email}</span>}
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Пароль</label>
            <div className="login-field__input-wrap">
              <input id="login-password" name="password" type={isPasswordVisible ? 'text' : 'password'} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined} autoComplete="current-password" placeholder="Введите пароль" value={fields.password} minLength={8} maxLength={128} onChange={(event) => updateField('password', event.target.value)} />
              <button className="login-field__visibility" type="button" aria-label={isPasswordVisible ? 'Скрыть символы' : 'Показать символы'} aria-pressed={isPasswordVisible} onClick={() => setIsPasswordVisible((current) => !current)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{isPasswordVisible && <path d="M3 3 21 21" />}</svg>
              </button>
            </div>
            {errors.password && <span className="login-field__error" id="login-password-error">{errors.password}</span>}
          </div>

          <div className="login-form__totp">
            <button className="login-form__totp-toggle" type="button" aria-expanded={isTotpVisible} aria-controls="login-totp" onClick={toggleTotp}>{isTotpVisible ? 'Скрыть код 2FA' : 'У меня подключён 2FA'}</button>
            {isTotpVisible && <div className="login-field" id="login-totp">
              <label htmlFor="login-totp-token">Код 2FA — если подключён</label>
              <input id="login-totp-token" name="totp_token" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={fields.totp_token} aria-invalid={Boolean(errors.totp_token)} aria-describedby={errors.totp_token ? 'login-totp-error' : 'login-totp-hint'} maxLength={6} onChange={(event) => updateField('totp_token', event.target.value)} />
              {errors.totp_token ? <span className="login-field__error" id="login-totp-error">{errors.totp_token}</span> : <span className="login-field__hint" id="login-totp-hint">Шесть цифр из приложения-аутентификатора</span>}
            </div>}
          </div>

          <button className="login-form__submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Входим…' : 'Войти'}</button>
        </form>

        <p className="login-card__register">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </section>
    </main>
  )
}
