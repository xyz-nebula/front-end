import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'
import type { AuthRegisterRequest } from '@/types/auth'

const initialFields: AuthRegisterRequest = {
  email: '',
  username: '',
  first_name: '',
  last_name: '',
  password: '',
}

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fields, setFields] = useState(initialFields)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (name: keyof AuthRegisterRequest, value: string) => {
    setFields((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setFormError('')
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    const email = fields.email.trim()
    const username = fields.username.trim()
    const firstName = fields.first_name.trim()
    const lastName = fields.last_name.trim()

    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Введите корректный email.'
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) nextErrors.username = 'От 3 до 32 символов: латиница, цифры, ., _ или -.'
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
      username: fields.username.trim(),
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
    <AuthShell eyebrow="Регистрация" title="Создай аккаунт" description="Пять полей — и можно переходить к первой тренировке.">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <div className="auth-form__row">
          <FormField label="Имя" name="first_name" autoComplete="given-name" value={fields.first_name} error={errors.first_name} maxLength={64} onChange={(event) => updateField('first_name', event.target.value)} />
          <FormField label="Фамилия" name="last_name" autoComplete="family-name" value={fields.last_name} error={errors.last_name} maxLength={64} onChange={(event) => updateField('last_name', event.target.value)} />
        </div>
        <FormField label="Имя пользователя" name="username" autoComplete="username" value={fields.username} error={errors.username} minLength={3} maxLength={32} hint="Латиница, цифры, точка, дефис или подчёркивание" onChange={(event) => updateField('username', event.target.value)} />
        <FormField label="Email" name="email" type="email" autoComplete="email" value={fields.email} error={errors.email} maxLength={254} onChange={(event) => updateField('email', event.target.value)} />
        <FormField label="Пароль" name="password" type="password" autoComplete="new-password" value={fields.password} error={errors.password} minLength={8} maxLength={128} hint="Не менее 8 символов" onChange={(event) => updateField('password', event.target.value)} />
        <AppButton type="submit" className="auth-form__submit" icon={<ArrowIcon />} disabled={isSubmitting}>{isSubmitting ? 'Создаём…' : 'Создать аккаунт'}</AppButton>
      </form>
      <p className="auth-switch">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      <Link className="auth-back-link" to="/auth">← Назад к выбору</Link>
    </AuthShell>
  )
}
