import { AppButton } from '@/components/ui/AppButton'

interface FinishDialogProps {
  onCancel: () => void
  onConfirm: () => void
  busy?: boolean
  error?: string | null
}

export function FinishDialog({ onCancel, onConfirm, busy = false, error = null }: FinishDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <section className="finish-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-dialog-title">
        <p className="eyebrow">Завершение тренировки</p>
        <h2 id="finish-dialog-title">Закончить переговоры?</h2>
        <p>После завершения новые реплики добавить не получится. Ответы уже сохранены и попадут в разбор.</p>
        {error && <p className="finish-dialog__error" role="alert">{error}</p>}
        <div>
          <AppButton type="button" variant="secondary" onClick={onCancel} disabled={busy}>Продолжить диалог</AppButton>
          <AppButton type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Завершаем…' : 'Завершить'}</AppButton>
        </div>
      </section>
    </div>
  )
}
