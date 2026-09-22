import { AppButton } from '@/components/ui/AppButton'

interface FinishDialogProps {
  onCancel: () => void
  onConfirm: () => void
}

export function FinishDialog({ onCancel, onConfirm }: FinishDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="finish-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-dialog-title">
        <p className="eyebrow">Завершение тренировки</p>
        <h2 id="finish-dialog-title">Закончить переговоры?</h2>
        <p>После завершения новые реплики добавить не получится. Ответы уже сохранены и попадут в разбор.</p>
        <div>
          <AppButton type="button" variant="secondary" onClick={onCancel}>Продолжить диалог</AppButton>
          <AppButton type="button" onClick={onConfirm}>Завершить</AppButton>
        </div>
      </section>
    </div>
  )
}
