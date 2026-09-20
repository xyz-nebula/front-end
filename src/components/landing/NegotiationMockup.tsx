export function NegotiationMockup() {
  return (
    <div className="negotiation-mockup" aria-label="Макет интерфейса тренировки">
      <div className="negotiation-mockup__topbar">
        <div className="window-dots" aria-hidden="true"><span /><span /><span /></div>
        <span className="session-label"><i /> Тренировка идёт</span>
        <span className="session-time">07:42</span>
      </div>
      <div className="negotiation-mockup__body">
        <div className="opponent-card">
          <div className="avatar avatar--large">А</div>
          <div><span>AI-оппонент</span><strong>Анна, руководитель</strong></div>
          <div className="voice-wave" aria-hidden="true">
            {[10, 18, 28, 16, 34, 22, 12, 25, 17].map((height, index) => <i key={index} style={{ height }} />)}
          </div>
        </div>
        <div className="dialogue-preview">
          <div className="message message--opponent"><span>Анна</span>Я ценю твой вклад, но сейчас бюджет уже распределён. Почему мы должны пересмотреть условия?</div>
          <div className="message message--user"><span>Вы</span>За последние полгода я взял на себя два новых направления и сократил сроки запуска...</div>
        </div>
        <div className="mock-controls">
          <button type="button" aria-label="Микрофон" tabIndex={-1}>
            <svg viewBox="0 0 24 24" fill="none"><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Zm-3 6.5V12a6 6 0 0 0 12 0v-.5M12 18v3m-3 0h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
          <div><span>Говорите, когда будете готовы</span><small>AI реагирует на ваши аргументы</small></div>
          <button className="mock-controls__finish" type="button" tabIndex={-1}>Завершить</button>
        </div>
      </div>
      <div className="floating-insight floating-insight--one"><span>Сильный аргумент</span><strong>+ ясность позиции</strong></div>
      <div className="floating-insight floating-insight--two"><span>Цель кейса</span><strong>Договориться о следующем шаге</strong></div>
    </div>
  )
}
