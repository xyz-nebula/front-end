import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'

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

  const updateField = (name: keyof LoginFields, value: string) => {
    const nextValue = name === 'totp_token' ? value.replace(/\D/g, '').slice(0, 6) : value
    setFields((current) => ({ ...current, [name]: nextValue }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!fields.email.trim()) nextErrors.email = 'Введите email.'
    else if (fields.email.length > 254 || !/^\S+@\S+\.\S+$/.test(fields.email)) nextErrors.email = 'Введите корректный email.'
    if (fields.password.length < 8) nextErrors.password = 'Пароль должен содержать не менее 8 символов.'
    else if (fields.password.length > 128) nextErrors.password = 'Пароль не должен быть длиннее 128 символов.'
    if (fields.totp_token && !/^\d{6}$/.test(fields.totp_token)) nextErrors.totp_token = 'Введите шестизначный код.'
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
        ...(fields.totp_token ? { totp_token: fields.totp_token } : {}),
      })
      navigate(getReturnPath(location.state), { replace: true })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setFormError(getErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell eyebrow="Вход" title="С возвращением" description="Войди, чтобы продолжить тренировки и увидеть свой прогресс.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <FormField label="Email" name="email" type="email" autoComplete="email" value={fields.email} error={errors.email} maxLength={254} onChange={(event) => updateField('email', event.target.value)} />
        <FormField label="Пароль" name="password" type="password" autoComplete="current-password" value={fields.password} error={errors.password} minLength={8} maxLength={128} onChange={(event) => updateField('password', event.target.value)} />
        <FormField label="Код 2FA — если подключён" name="totp_token" type="text" inputMode="numeric" autoComplete="one-time-code" value={fields.totp_token} error={errors.totp_token} maxLength={6} hint="Шесть цифр из приложения-аутентификатора" onChange={(event) => updateField('totp_token', event.target.value)} />
        <AppButton type="submit" className="auth-form__submit" icon={<ArrowIcon />} disabled={isSubmitting}>{isSubmitting ? 'Входим…' : 'Войти'}</AppButton>
      </form>
      <p className="auth-switch">Нет аккаунта? <Link to="/register">Создать</Link></p>
      <Link className="auth-back-link" to="/auth">← Другой способ входа</Link>
    </AuthShell>
  )
}
