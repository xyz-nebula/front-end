import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile-kirill.webp'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'

export function ResultHeader() {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) setProfileOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  return (
    <header className="result-header">
      <div className="result-shell result-header__inner">
        <Link className="result-header__brand" to="/" aria-label="Арена — на главную">
          <ArenaCubeMark />
          <span>АРЕНА</span>
        </Link>
        <div className="result-header__actions">
          <span className="result-header__streak" aria-label="Демо: серия 4 дня">
            <span aria-hidden="true">🔥</span>
            <span>Серия: <strong>4 дня</strong></span>
          </span>
          <div className="result-header__profile" ref={profileRef}>
            <button type="button" aria-label="Меню профиля" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
              <img src={profileArtwork} alt="" />
            </button>
            {profileOpen && (
              <div className="result-header__profile-menu">
                <span>Кирилл <small>Демо-профиль</small></span>
                <Link to="/home" onClick={() => setProfileOpen(false)}>К кейсам</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
