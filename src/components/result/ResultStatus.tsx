import { AppButton } from '@/components/ui/AppButton'
import type { NegotiationResultState } from '@/types/negotiation'

interface ResultStatusProps {
  result: NegotiationResultState | null
  error: string | null
  onRetry: () => void
}

export function ResultStatus({ result, error, onRetry }: ResultStatusProps) {
  const failed = result?.status === 'failed'
  const loading = !failed && !error

  return (
    <section className={`result-status ${loading ? 'is-loading' : 'is-error'}`} role="status" data-tour-id="result-status">
      <span className="result-status__mark" aria-hidden="true">
        {loading ? <i /> : '!'}
      </span>
      <p className="result-status__eyebrow">Разбор переговоров</p>
      <h1>{failed ? 'Разбор не готов' : error ? 'Не удалось получить разбор' : 'Анализируем разговор…'}</h1>
      <p>{failed ? result.message : error ?? 'Собираем выводы по вашим репликам. Это займёт несколько секунд.'}</p>
      <div className="result-status__actions">
        {(error || failed) && <AppButton type="button" onClick={onRetry}>Проверить ещё раз</AppButton>}
        <AppButton to="/home" variant="secondary">К кейсам</AppButton>
      </div>
    </section>
  )
}
