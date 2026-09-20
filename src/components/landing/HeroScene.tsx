import voxelScene from '@/assets/hero/voxel-scene.png'

type SceneIconName = 'briefcase' | 'user' | 'clock' | 'lock' | 'target' | 'brain'

interface SceneIconProps {
  name: SceneIconName
}

function SceneIcon({ name }: SceneIconProps) {
  if (name === 'briefcase') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7V5.8c0-1 .8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8V7m-13 4.5h18M5.5 7h13A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-8A2.5 2.5 0 0 1 5.5 7Zm5 4.5h3V14h-3v-2.5Z" />
      </svg>
    )
  }

  if (name === 'user') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21v-2.4a6.5 6.5 0 0 1 6.5-6.5h2a6.5 6.5 0 0 1 6.5 6.5V21h-15Z" />
      </svg>
    )
  }

  if (name === 'clock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5V12l3.2 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === 'lock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="10" width="14" height="11" rx="2.5" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="15" r="1.5" fill="#fff" />
      </svg>
    )
  }

  if (name === 'target') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="13" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="11" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m13.5 10.5 6-6m-3 0h3v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.2 4.1A3.4 3.4 0 0 0 4.6 7a3.5 3.5 0 0 0 .3 1.4A3.7 3.7 0 0 0 4 15a3.2 3.2 0 0 0 3.2 3.2h.2A3.2 3.2 0 0 0 10.5 21V4.4a2 2 0 0 0-1.3-.3Zm5.6 0A3.4 3.4 0 0 1 19.4 7a3.5 3.5 0 0 1-.3 1.4A3.7 3.7 0 0 1 20 15a3.2 3.2 0 0 1-3.2 3.2h-.2a3.2 3.2 0 0 1-3.1 2.8V4.4a2 2 0 0 1 1.3-.3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.2 9.3h3.3m-2 0v3.2m8.3-3.2h-3.3m2 0v3.2M7.4 16l3.1-2m6.1 2-3.1-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

interface SceneCardProps {
  accent: 'blue' | 'red' | 'amber'
  className: string
  icon: SceneIconName
  label?: string
  value: string
  chevron?: boolean
}

function SceneCard({ accent, className, icon, label, value, chevron = false }: SceneCardProps) {
  return (
    <div className={`arena-scene-card arena-scene-card--${accent} ${className}`}>
      <span className="arena-scene-card__icon"><SceneIcon name={icon} /></span>
      <span className="arena-scene-card__copy">
        {label && <small>{label}</small>}
        <strong>{value}</strong>
      </span>
      {chevron && <span className="arena-scene-card__chevron" aria-hidden="true">›</span>}
    </div>
  )
}

export function HeroScene() {
  return (
    <div className="arena-scene" aria-label="Интерфейс тренировочного поединка">
      <div className="arena-scene__grid" aria-hidden="true" />
      <img className="arena-scene__image" src={voxelScene} alt="Два участника ведут переговоры за столом" />

      <div className="arena-scene__cards" aria-hidden="true">
        <SceneCard accent="blue" className="arena-scene-card--case" icon="briefcase" label="Кейс" value="На следующий день…" chevron />
        <SceneCard accent="red" className="arena-scene-card--role" icon="user" label="Роль" value="Менеджер" chevron />
        <SceneCard accent="blue" className="arena-scene-card--timer" icon="clock" value="05:00" />
        <SceneCard accent="amber" className="arena-scene-card--secret" icon="lock" value="Скрытая позиция оппонента" chevron />
        <SceneCard accent="blue" className="arena-scene-card--goal" icon="target" label="Цель" value="Сохранить договорённость о повышении" chevron />
        <SceneCard accent="blue" className="arena-scene-card--opponent" icon="brain" value="AI-оппонент" chevron />
      </div>
    </div>
  )
}
