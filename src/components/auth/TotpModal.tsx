import { useEffect, useState, type FormEvent } from 'react'

import { getErrorMessage, getFieldErrors } from '@/auth/errors'
import { useAuth } from '@/auth/useAuth'
import { FormField } from '@/components/auth/FormField'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'
import type { TotpEnrollResponse } from '@/types/auth'

type TotpView = 'overview' | 'enroll' | 'disable' | 'enabled' | 'disabled'

interface TotpModalProps {
  onClose: () => void
}

export function TotpModal({ onClose }: TotpModalProps) {
  const { enrollTotp, confirmTotp, disableTotp } = useAuth()
  const [view, setView] = useState<TotpView>('overview')
  const [enrollData, setEnrollData] = useState<TotpEnrollResponse | null>(null)
  const [totpToken, setTotpToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmedDisable, setConfirmedDisable] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const resetMessages = () => {
    setFieldError('')
    setFormError('')
  }

  const startEnrollment = async () => {
    setIsLoading(true)
    resetMessages()
    try {
      setEnrollData(await enrollTotp())
      setView('enroll')
    } catch (error) {
      setFormError(getErrorMessage(error, 'Не удалось начать подключение 2FA.'))
    } finally {
      setIsLoading(false)
    }
  }

  const copySecret = async () => {
    if (!enrollData) return
    try {
      await navigator.clipboard.writeText(enrollData.secret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setFormError('Не удалось скопировать ключ автоматически. Выделите и скопируйте его вручную.')
    }
  }

  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(totpToken)) {
      setFieldError('Введите шестизначный код.')
      return
    }

    setIsLoading(true)
    resetMessages()
    try {
      await confirmTotp(totpToken)
      setTotpToken('')
      setView('enabled')
    } catch (error) {
      const fields = getFieldErrors(error)
      setFieldError(fields.totp_token ?? '')
      setFormError(getErrorMessage(error, 'Не удалось подтвердить код.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 8 || password.length > 128) {
      setFieldError('Введите текущий пароль от 8 до 128 символов.')
      return
    }
    if (!confirmedDisable) {
      setFormError('Подтвердите, что хотите отключить двухфакторную защиту.')
      return
    }

    setIsLoading(true)
    resetMessages()
    try {
      await disableTotp(password)
      setPassword('')
      setView('disabled')
    } catch (error) {
      const fields = getFieldErrors(error)
      setFieldError(fields.password ?? '')
      setFormError(getErrorMessage(error, 'Не удалось отключить 2FA.'))
    } finally {
      setIsLoading(false)
    }
  }

  const goToOverview = () => {
    setView('overview')
    setEnrollData(null)
    setTotpToken('')
    setPassword('')
    setConfirmedDisable(false)
    resetMessages()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="security-modal" role="dialog" aria-modal="true" aria-labelledby="security-modal-title">
        <button className="training-modal__close" type="button" onClick={onClose} aria-label="Закрыть">×</button>

        {view === 'overview' && (
          <>
            <p className="eyebrow">Безопасность</p>
            <h2 id="security-modal-title">Двухфакторная защита</h2>
            <p className="security-modal__intro">Управляй входом по одноразовому коду. Текущий статус аккаунта backend пока не сообщает.</p>
            {formError && <div className="form-alert" role="alert">{formError}</div>}
            <div className="security-actions">
              <button type="button" onClick={() => void startEnrollment()} disabled={isLoading}>
                <span className="security-actions__icon">＋</span>
                <span><strong>{isLoading ? 'Подключаем…' : 'Подключить 2FA'}</strong><small>Настроить приложение-аутентификатор</small></span>
                <ArrowIcon />
              </button>
              <button type="button" onClick={() => { setView('disable'); resetMessages() }} disabled={isLoading}>
                <span className="security-actions__icon security-actions__icon--danger">−</span>
                <span><strong>Отключить 2FA</strong><small>Потребуется текущий пароль</small></span>
                <ArrowIcon />
              </button>
            </div>
          </>
        )}

        {view === 'enroll' && enrollData && (
          <>
            <button className="security-modal__back" type="button" onClick={goToOverview}>← Назад</button>
            <p className="eyebrow">Подключение 2FA</p>
            <h2 id="security-modal-title">Добавь ключ</h2>
            <p className="security-modal__intro">Открой ссылку в приложении-аутентификаторе или добавь секретный ключ вручную.</p>
            {formError && <div className="form-alert" role="alert">{formError}</div>}
            <div className="totp-secret">
              <span>Секретный ключ</span>
              <code>{enrollData.secret}</code>
              <button type="button" onClick={() => void copySecret()}>{copied ? 'Скопировано' : 'Копировать'}</button>
            </div>
            <a className="totp-open-link" href={enrollData.otpauth_url}>Открыть в приложении-аутентификаторе <ArrowIcon direction="up-right" /></a>
            <form className="auth-form security-modal__form" onSubmit={handleConfirm} noValidate>
              <FormField label="Код из приложения" name="totp_token" inputMode="numeric" autoComplete="one-time-code" value={totpToken} error={fieldError} maxLength={6} placeholder="000000" onChange={(event) => { setTotpToken(event.target.value.replace(/\D/g, '').slice(0, 6)); resetMessages() }} />
              <AppButton type="submit" className="auth-form__submit" disabled={isLoading}>{isLoading ? 'Проверяем…' : 'Подтвердить и включить'}</AppButton>
            </form>
          </>
        )}

        {view === 'disable' && (
          <>
            <button className="security-modal__back" type="button" onClick={goToOverview}>← Назад</button>
            <p className="eyebrow">Отключение 2FA</p>
            <h2 id="security-modal-title">Подтверди действие</h2>
            <p className="security-modal__intro">После отключения для входа снова будет достаточно только email и пароля.</p>
            {formError && <div className="form-alert" role="alert">{formError}</div>}
            <form className="auth-form security-modal__form" onSubmit={handleDisable} noValidate>
              <FormField label="Текущий пароль" name="password" type="password" autoComplete="current-password" value={password} error={fieldError} minLength={8} maxLength={128} onChange={(event) => { setPassword(event.target.value); resetMessages() }} />
              <label className="confirm-check">
                <input type="checkbox" checked={confirmedDisable} onChange={(event) => { setConfirmedDisable(event.target.checked); setFormError('') }} />
                <span>Я понимаю, что вход станет менее защищённым</span>
              </label>
              <AppButton type="submit" variant="secondary" className="auth-form__submit security-modal__danger" disabled={isLoading}>{isLoading ? 'Отключаем…' : 'Отключить 2FA'}</AppButton>
            </form>
          </>
        )}

        {(view === 'enabled' || view === 'disabled') && (
          <div className="security-success">
            <span aria-hidden="true">✓</span>
            <p className="eyebrow">Готово</p>
            <h2 id="security-modal-title">{view === 'enabled' ? '2FA подключена' : '2FA отключена'}</h2>
            <p>{view === 'enabled' ? 'При следующем входе используй код из приложения-аутентификатора.' : 'Теперь для входа достаточно email и пароля.'}</p>
            <AppButton type="button" onClick={onClose}>Закрыть</AppButton>
          </div>
        )}
      </section>
    </div>
  )
}
