const settings = [
  { label: 'Сфера', value: 'Работа и карьера', icon: 'M9 7V5h6v2M4 8h16v12H4ZM4 12l8 3 8-3M12 13v4' },
  { label: 'Сложность', value: 'Средняя', icon: 'M5 20v-5h2v5ZM11 20V9h2v11ZM17 20V4h2v16Z' },
  { label: 'Роль AI', value: 'Руководитель', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2Z' },
  { label: 'Тон', value: 'Требовательный', icon: 'M4 4h16v13H9l-5 4ZM8 8h8M8 12h6' },
]

export function CaseSettingsPreview() {
  return (
    <div className="arena-case-preview" aria-hidden="true">
      <p className="arena-case-preview__title">Настройка кейса</p>
      <div className="arena-case-preview__rows">
        {settings.map(({ label, value, icon }) => (
          <div className="arena-case-preview__row" key={label}>
            <span className="arena-case-preview__label">{label}</span>
            <div className="arena-case-preview__field">
              <span className="arena-case-preview__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
              </span>
              <span className="arena-case-preview__value">{value}</span>
              <svg className="arena-case-preview__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 4.5 3 3 3-3" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
