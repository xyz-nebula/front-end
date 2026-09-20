import { AppButton } from '@/components/ui/AppButton'

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <section>
        <p className="eyebrow">Ошибка 404</p>
        <h1>Здесь пока нет<br />тренировки</h1>
        <p>Вернитесь на главную и выберите подходящий переговорный кейс.</p>
        <AppButton to="/">На главную</AppButton>
      </section>
    </main>
  )
}
