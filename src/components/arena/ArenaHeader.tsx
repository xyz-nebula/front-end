import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/Logo'
import type { TrainingCase } from '@/types/case'

function formatElapsed(startedAt: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

interface ArenaHeaderProps {
  trainingCase: TrainingCase
  startedAt: string
  finishDisabled: boolean
  onFinish: () => void
}

export function ArenaHeader({ trainingCase, startedAt, finishDisabled, onFinish }: ArenaHeaderProps) {
  const [now, setNow] = useState(() => Date.parse(startedAt))

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <header className="arena-session-header">
      <div className="arena-session-header__brand"><Logo /><Link to="/home">← К кейсам</Link></div>
      <div className="arena-session-header__case">
        <span>{trainingCase.category} · текстовый режим</span>
        <strong>{trainingCase.title}</strong>
      </div>
      <div className="arena-session-header__actions">
        <time aria-label="Время тренировки">{formatElapsed(startedAt, now)}</time>
        <button type="button" onClick={onFinish} disabled={finishDisabled}>Завершить</button>
      </div>
    </header>
  )
}
