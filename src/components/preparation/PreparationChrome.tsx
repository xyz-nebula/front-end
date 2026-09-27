import type { RefObject } from 'react'
import { Link } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import type { PreparationSaveState } from '@/features/preparation/usePreparationDraft'
import type { TrainingCase } from '@/types/case'

export function PreparationHeader() {
  return <header className="preparation-header"><div className="preparation-shell preparation-header__inner"><Link className="preparation-header__brand" to="/"><ArenaCubeMark /><span>АРЕНА</span></Link><div className="preparation-header__profile"><span>🔥 <strong>4</strong></span><img src={profileArtwork} alt="" width={400} height={400} decoding="async" /></div></div></header>
}

export function PreparationContext({ caseButtonRef, item, roleIndex, saveState, onCaseOpen }: { caseButtonRef: RefObject<HTMLButtonElement | null>; item: TrainingCase; roleIndex: 0 | 1; saveState: PreparationSaveState; onCaseOpen: () => void }) {
  return <div className="preparation-context"><Link to="/home">← Назад</Link><div><strong>{item.title}</strong><span>Вы: {item.roles[roleIndex]}</span></div><button className="preparation-case-button" ref={caseButtonRef} type="button" onClick={onCaseOpen}>Условие кейса</button><span className={`preparation-save is-${saveState}`} role="status">{saveState === 'saving' ? 'Сохраняем…' : saveState === 'error' ? 'Не сохранено' : 'Сохранено ✓'}</span></div>
}

export function PreparationOverview({ completedCount, isStarting, onStart }: { completedCount: number; isStarting: boolean; onStart: () => void }) {
  const progress = completedCount * 10
  return <section className="preparation-intro"><div><h1>Подготовка к переговорам</h1><p>Сформируйте свою позицию перед поединком. Все поля необязательны — начать можно в любой момент.</p></div><div className="preparation-progress"><span>Заполнено {completedCount} из 10</span><div role="progressbar" aria-label="Прогресс подготовки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /></div></div><button className="preparation-start" type="button" disabled={isStarting} onClick={onStart}>{isStarting ? 'Создаём поединок…' : 'Начать поединок'} <span>→</span></button></section>
}
