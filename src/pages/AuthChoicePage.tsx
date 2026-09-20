import { Link } from 'react-router-dom'

import { AuthShell } from '@/components/auth/AuthShell'
import { ArrowIcon } from '@/components/ui/ArrowIcon'

export function AuthChoicePage() {
  return (
    <AuthShell
      eyebrow="Добро пожаловать"
      title="Выйди на Арену"
      description="Создай аккаунт для первой тренировки или продолжи с того места, где остановился."
      wide
    >
      <div className="auth-choice">
        <Link className="auth-choice__item auth-choice__item--primary" to="/register">
          <span>Новый участник</span>
          <strong>Создать аккаунт</strong>
          <p>Зарегистрируйся и начни практиковать сложные разговоры.</p>
          <i><ArrowIcon /></i>
        </Link>
        <Link className="auth-choice__item" to="/login">
          <span>Уже тренировались</span>
          <strong>Войти</strong>
          <p>Вернись к тренировкам, истории и своему прогрессу.</p>
          <i><ArrowIcon /></i>
        </Link>
      </div>
      <Link className="auth-back-link" to="/">← Вернуться на главную</Link>
    </AuthShell>
  )
}
