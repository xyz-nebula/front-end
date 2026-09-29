import { useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth, useAuthHomePath } from '@/auth/useAuth'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import type { AuthRegisterRequest } from '@/types/auth'
import '@/styles/login.css'
import '@/styles/register.css'

const initialFields: AuthRegisterRequest = {
  email: '',
  first_name: '',
  last_name: '',
  password: '',
}

interface RegisterFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

function RegisterField({ label, error, hint, id, ...props }: RegisterFieldProps) {
  const inputId = id ?? props.name
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="login-field">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error
        ? <span className="login-field__error" id={`${inputId}-error`}>{error}</span>
        : hint && <span className="login-field__hint" id={`${inputId}-hint`}>{hint}</span>}
    </div>
  )
}

export function RegisterPage() {
  const { register } = useAuth()
  const homePath = useAuthHomePath()
  const navigate = useNavigate()
  const [fields, setFields] = useState(initialFields)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const updateField = (name: keyof AuthRegisterRequest, value: string) => {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    const email = fields.email.trim()
    const firstName = fields.first_name.trim()
    const lastName = fields.last_name.trim()

    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Введите корректный email.'
    if (!firstName) nextErrors.first_name = 'Введите имя.'
    else if (firstName.length > 64) nextErrors.first_name = 'Не более 64 символов.'
    if (!lastName) nextErrors.last_name = 'Введите фамилию.'
    else if (lastName.length > 64) nextErrors.last_name = 'Не более 64 символов.'
    if (fields.password.length < 8) nextErrors.password = 'Минимум 8 символов.'
    else if (fields.password.length > 128) nextErrors.password = 'Не более 128 символов.'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setFormError('')
    const payload: AuthRegisterRequest = {
      email: fields.email.trim(),
      first_name: fields.first_name.trim(),
      last_name: fields.last_name.trim(),
      password: fields.password,
    }

    try {
      const response = await register(payload)
      navigate('/activate', {
        replace: true,
        state: {
          registrationComplete: true,
          email: payload.email,
          demoActivationCode: response.demo_activation_code,
        },
      })
    } catch (error) {
      setErrors(getFieldErrors(error))
      setFormError(getErrorMessage(error, 'Не удалось создать аккаунт. Попробуйте ещё раз.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page register-page">
      <header className="login-page__header">
        <Link className="login-page__brand" to={homePath} aria-label="Арена переговоров — на главную">
          <ArenaCubeMark className="login-page__brand-mark" />
          <span>Арена переговоров</span>
        </Link>
      </header>

      <section className="login-card register-card" aria-labelledby="register-title">
        <div className="login-card__heading register-card__heading">
          <h1 id="register-title">Создание аккаунта</h1>
          <p>Заполните данные, чтобы начать тренировки</p>
        </div>

        <form className="login-form register-form" onSubmit={handleSubmit} noValidate>
          {formError && <div className="login-form__alert" role="alert">{formError}</div>}
          <div className="register-form__row">
            <RegisterField label="Имя" name="first_name" autoComplete="given-name" value={fields.first_name} error={errors.first_name} maxLength={64} onChange={(event) => updateField('first_name', event.target.value)} />
            <RegisterField label="Фамилия" name="last_name" autoComplete="family-name" value={fields.last_name} error={errors.last_name} maxLength={64} onChange={(event) => updateField('last_name', event.target.value)} />
          </div>
          <RegisterField label="Электронная почта" aria-label="Email" name="email" type="email" autoComplete="email" placeholder="name@example.com" value={fields.email} error={errors.email} maxLength={254} onChange={(event) => updateField('email', event.target.value)} />
          <div className="login-field">
            <label htmlFor="register-password">Пароль</label>
            <div className="login-field__input-wrap">
              <input id="register-password" name="password" type={isPasswordVisible ? 'text' : 'password'} autoComplete="new-password" placeholder="Не менее 8 символов" value={fields.password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'register-password-error' : 'register-password-hint'} minLength={8} maxLength={128} onChange={(event) => updateField('password', event.target.value)} />
              <button className="login-field__visibility" type="button" aria-label={isPasswordVisible ? 'Скрыть символы' : 'Показать символы'} aria-pressed={isPasswordVisible} onClick={() => setIsPasswordVisible((current) => !current)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{isPasswordVisible && <path d="M3 3 21 21" />}</svg>
              </button>
            </div>
            {errors.password ? <span className="login-field__error" id="register-password-error">{errors.password}</span> : <span className="login-field__hint" id="register-password-hint">Используйте от 8 до 128 символов</span>}
          </div>
          <button className="login-form__submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : 'Создать аккаунт'}</button>
        </form>
        <p className="login-card__register">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </section>
    </main>
  )
}
