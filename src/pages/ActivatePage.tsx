import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { AuthShell } from '@/components/auth/AuthShell'
import { FormField } from '@/components/auth/FormField'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getRegistrationEmail(state: unknown) {
  if (typeof state !== 'object' || state === null || !('email' in state)) return ''
  return typeof (state as { email?: unknown }).email === 'string' ? (state as { email: string }).email : ''
}

export function ActivatePage() {
  const { activate } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryCode = searchParams.get('code')?.trim() ?? ''
  const [code, setCode] = useState(queryCode)
  const [fieldError, setFieldError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const attemptedQueryCodeRef = useRef(false)
  const registrationEmail = getRegistrationEmail(location.state)

  const submitActivation = useCallback(async (activationCode: string) => {
    if (!uuidPattern.test(activationCode)) {
      setFieldError('Введите код в формате UUID из письма.')
      return
    }

    setIsSubmitting(true)
    setFieldError('')
    setFormError('')
    try {
      await activate(activationCode)
      navigate('/home', { replace: true })
    } catch (error) {
      const apiFields = getFieldErrors(error)
      setFieldError(apiFields.code ?? '')
      setFormError(getErrorMessage(error, 'Не удалось активировать аккаунт. Проверьте код.'))
    } finally {
      setIsSubmitting(false)
    }
  }, [activate, navigate])

  useEffect(() => {
    if (!queryCode || attemptedQueryCodeRef.current) return
    attemptedQueryCodeRef.current = true
    void submitActivation(queryCode)
  }, [queryCode, submitActivation])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitActivation(code.trim())
  }

  const description = registrationEmail
    ? `Мы отправили ссылку на ${registrationEmail}. Открой её или вставь UUID-код вручную.`
    : 'Открой ссылку из письма или вставь UUID-код активации вручную.'

  return (
    <AuthShell eyebrow="Активация" title="Подтверди email" description={description}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {queryCode && isSubmitting && <div className="form-notice" role="status"><span />Проверяем код из ссылки…</div>}
        {formError && <div className="form-alert" role="alert">{formError}</div>}
        <FormField label="Код активации" name="code" value={code} error={fieldError} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" onChange={(event) => { setCode(event.target.value); setFieldError(''); setFormError('') }} />
        <AppButton type="submit" className="auth-form__submit" icon={<ArrowIcon />} disabled={isSubmitting}>{isSubmitting ? 'Проверяем…' : 'Активировать аккаунт'}</AppButton>
      </form>
      <p className="auth-switch">Уже активировали аккаунт? <Link to="/login">Войти</Link></p>
      <Link className="auth-back-link" to="/">← На главную</Link>
    </AuthShell>
  )
}
