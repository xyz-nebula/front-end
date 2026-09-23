import type { FormEvent } from 'react'

interface TextComposerProps {
  value: string
  disabled: boolean
  isSending: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function TextComposer({ value, disabled, isSending, onChange, onSubmit }: TextComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="arena-composer" onSubmit={handleSubmit}>
      <label htmlFor="arena-message">Ваша реплика</label>
      <div className="arena-composer__field">
        <textarea
          id="arena-message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Напишите, что хотите сказать…"
          rows={2}
          maxLength={1_500}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (!disabled && value.trim()) onSubmit()
            }
          }}
        />
        <button type="submit" disabled={disabled || !value.trim()} aria-label="Отправить сообщение">
          {isSending ? <span className="arena-composer__spinner" /> : '↑'}
        </button>
      </div>
      <small>Enter — отправить · Shift + Enter — новая строка</small>
    </form>
  )
}
