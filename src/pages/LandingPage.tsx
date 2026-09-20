import { LandingHeader } from '@/components/landing/LandingHeader'
import { NegotiationMockup } from '@/components/landing/NegotiationMockup'
import { AppButton } from '@/components/ui/AppButton'
import { ArrowIcon } from '@/components/ui/ArrowIcon'
import { Logo } from '@/components/ui/Logo'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'

const steps = [
  { number: '01', title: 'Подготовка', text: 'Выбери ситуацию, роль оппонента и сформулируй свой результат.' },
  { number: '02', title: 'Переговоры', text: 'Веди живой диалог. AI возражает, уточняет и меняет тактику.' },
  { number: '03', title: 'Разбор', text: 'Получи разбор аргументов, вопросов и упущенных возможностей.' },
  { number: '04', title: 'Повтор', text: 'Пройди кейс ещё раз и попробуй новую стратегию на практике.' },
]

const situations = [
  { index: '01', title: 'Работа', text: 'Зарплата, собеседование, новая роль', className: 'situation-card--violet' },
  { index: '02', title: 'Управление', text: 'Обратная связь, мотивация, увольнение', className: 'situation-card--lime' },
  { index: '03', title: 'Конфликты', text: 'Разногласия, претензии, границы', className: 'situation-card--orange' },
  { index: '04', title: 'Продажи', text: 'Цена, возражения, условия сделки', className: 'situation-card--blue' },
  { index: '05', title: 'Каждый день', text: 'Возврат, аренда, сложный разговор', className: 'situation-card--pink' },
]

const benefits = [
  { title: 'У разговора есть цель', text: 'Оппонент знает контекст, интересы и ограничения своей роли — и не соглашается просто ради продолжения беседы.' },
  { title: 'Сценарий реагирует на тебя', text: 'Каждый выбор меняет динамику: можно выстроить доверие, зайти в тупик или найти неожиданную развязку.' },
  { title: 'Фидбэк превращается в действие', text: 'После разговора ты видишь не общие советы, а конкретные моменты, альтернативные формулировки и следующий фокус.' },
]

export function LandingPage() {
  return (
    <div className="landing-page">
      <LandingHeader />
      <main>
        <section className="hero page-shell">
          <div className="hero__copy">
            <p className="hero__kicker"><span>Практика сложных разговоров</span><i /></p>
            <h1>Тренируй переговоры с <em>AI-оппонентом.</em></h1>
            <p className="hero__statement">Ошибайся здесь, <span>а не в жизни.</span></p>
            <p className="hero__description">Безопасное пространство, где можно пробовать, ошибаться и становиться увереннее перед важным разговором.</p>
            <div className="hero__actions">
              <AppButton to="/home" icon={<ArrowIcon />}>Начать тренировку</AppButton>
              <a className="text-link" href="#how-it-works">Как это работает <ArrowIcon direction="down" /></a>
            </div>
          </div>
          <div className="hero__visual"><div className="hero-orbit hero-orbit--one" /><div className="hero-orbit hero-orbit--two" /><NegotiationMockup /></div>
          <div className="hero__footnote"><span>01</span> Тренажёр переговоров для реальных ситуаций</div>
        </section>

        <section className="problem-section">
          <div className="page-shell problem-grid">
            <Reveal><p className="eyebrow eyebrow--light">Почему это важно</p></Reveal>
            <Reveal delay={80}><p className="problem-quote">Можно прочитать десятки книг о переговорах. Но в нужный момент всё равно <span>растеряться.</span></p></Reveal>
            <Reveal className="problem-aside" delay={140}><span className="problem-aside__line" /><p>Знание становится навыком только в практике — когда собеседник возражает, давит и не следует сценарию.</p></Reveal>
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="page-shell">
            <Reveal><SectionHeading eyebrow="Простой цикл" title="Как работает Арена" description="От выбора ситуации до новой, более сильной попытки — за одну короткую сессию." /></Reveal>
            <div className="steps-grid">
              {steps.map((step, index) => <Reveal key={step.number} delay={index * 80}><article className="step-card"><div className="step-card__top"><span>{step.number}</span>{index < steps.length - 1 && <ArrowIcon />}</div><h3>{step.title}</h3><p>{step.text}</p></article></Reveal>)}
            </div>
            <Reveal delay={120}>
              <div className="feedback-preview">
                <div className="feedback-preview__score"><span>Результат тренировки</span><strong>78<small>/100</small></strong><i>+6 к прошлой попытке</i></div>
                <div className="feedback-preview__content">
                  <div><span className="feedback-dot feedback-dot--good" /><p><strong>Сработало</strong>Ты опирался на конкретные результаты и не ушёл в оправдания.</p></div>
                  <div><span className="feedback-dot feedback-dot--focus" /><p><strong>Попробуй иначе</strong>Сначала выясни ограничения собеседника, затем предлагай варианты.</p></div>
                </div>
                <div className="feedback-preview__skills"><span>Аргументация <i style={{ width: '82%' }} /></span><span>Вопросы <i style={{ width: '61%' }} /></span><span>Гибкость <i style={{ width: '74%' }} /></span></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="situations-section" id="possibilities">
          <div className="page-shell">
            <Reveal><SectionHeading eyebrow="Библиотека кейсов" title="Разговоры, которые хочется отложить. Теперь их можно отрепетировать." /></Reveal>
            <div className="situations-grid">
              {situations.map((item, index) => <Reveal key={item.title} delay={index * 60}><article className={`situation-card ${item.className}`}><span>{item.index}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowIcon direction="up-right" /></article></Reveal>)}
            </div>
          </div>
        </section>

        <section className="methods-section">
          <div className="page-shell methods-grid">
            <Reveal><SectionHeading eyebrow="Не импровизация ради импровизации" title="Практика опирается на проверенные подходы" description="Методология остаётся внутри сценария и разбора — тебе не нужно вспоминать учебник посреди разговора." /></Reveal>
            <Reveal delay={100}><div className="method-list">{['Управленческие поединки', 'Гарвардский метод', 'BATNA', 'SPIN'].map((method, index) => <div key={method}><span>0{index + 1}</span><strong>{method}</strong><i /></div>)}</div></Reveal>
          </div>
        </section>

        <section className="benefits-section" id="about">
          <div className="page-shell">
            <Reveal><SectionHeading eyebrow="Больше, чем чат" title="AI, который не поддакивает" description="Арена создаёт тренировочную среду: с ролями, сопротивлением, целью и разбором после диалога." /></Reveal>
            <div className="benefits-grid">
              {benefits.map((benefit, index) => <Reveal key={benefit.title} delay={index * 80}><article className="benefit-card"><span className="benefit-card__number">0{index + 1}</span><div className="benefit-card__symbol" aria-hidden="true">{index === 0 ? '◎' : index === 1 ? '↝' : '↗'}</div><h3>{benefit.title}</h3><p>{benefit.text}</p></article></Reveal>)}
            </div>
          </div>
        </section>

        <section className="final-cta-section">
          <Reveal className="page-shell final-cta">
            <p className="eyebrow eyebrow--light">Следующий разговор может пройти иначе</p>
            <h2>Сначала — <span>на Арене.</span><br />Потом — уверенно в жизни.</h2>
            <AppButton to="/home" variant="light" icon={<ArrowIcon />}>Выбрать тренировку</AppButton>
            <div className="final-cta__rings" aria-hidden="true"><span /><span /><span /></div>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="page-shell landing-footer__main"><Logo inverse /><p>AI-тренажёр для переговоров,<br />которые имеют значение.</p><nav aria-label="Навигация в подвале"><a href="#how-it-works">Как это работает</a><a href="#possibilities">Возможности</a><a href="#about">О проекте</a></nav></div>
        <div className="page-shell landing-footer__bottom"><span>Хакатон-прототип · 2026</span><span>Сделано для практики, а не для теории</span></div>
      </footer>
    </div>
  )
}
