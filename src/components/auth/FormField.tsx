import type { InputHTMLAttributes } from 'react'

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function FormField({ label, error, hint, id, className = '', ...props }: FormFieldProps) {
  const inputId = id ?? props.name
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <label className={`form-field ${error ? 'has-error' : ''} ${className}`.trim()} htmlFor={inputId}>
      <span className="form-field__label">{label}</span>
      <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {error
        ? <span className="form-field__error" id={`${inputId}-error`}>{error}</span>
        : hint && <span className="form-field__hint" id={`${inputId}-hint`}>{hint}</span>}
    </label>
  )
}
