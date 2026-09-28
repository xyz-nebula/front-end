import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/auth/useAuth'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import '@/styles/not-found.css'

export function NotFoundPage() {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const homePath = status === 'authenticated' ? '/home' : '/'

  const goBack = () => {
    if (location.key !== 'default' && window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(homePath, { replace: true })
  }

  return (
    <main className="not-found-page">
      <header className="not-found-page__header">
        <Link className="not-found-page__brand" to={homePath} aria-label="Арена переговоров — на главную">
          <ArenaCubeMark />
          <span>Арена переговоров</span>
        </Link>
      </header>
      <section className="not-found-page__content" aria-labelledby="not-found-title">
        <strong className="not-found-page__code" aria-hidden="true">404</strong>
        <h1 id="not-found-title">Такой страницы нет</h1>
        <p>Возможно, ссылка устарела, страница была перемещена<br className="not-found-page__desktop-break" /> или адрес указан неверно.</p>
        <div className="not-found-page__actions">
          <Link className="not-found-page__home" to={homePath}>На главную</Link>
          <button className="not-found-page__back" type="button" onClick={goBack}><span aria-hidden="true">←</span> Вернуться назад</button>
        </div>
      </section>
    </main>
  )
}
