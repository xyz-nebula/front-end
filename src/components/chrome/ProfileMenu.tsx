import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import profileArtwork from '@/assets/home/profile.webp'
import { useAuth } from '@/auth/useAuth'
import { ProductTourRestartDialog } from '@/components/product-tour/ProductTourRestartDialog'
import { useProductTour } from '@/features/product-tour/useProductTour'

export type DepartureReason = 'default' | 'tour-start' | 'tour-restart'
export type DepartureRequest = (action: () => void | Promise<void>, reason?: DepartureReason) => void

interface ProfileMenuProps {
  className?: string
  menuClassName?: string
  onDepartureRequest?: DepartureRequest
  toggleClassName?: string
}

export function ProfileMenu({ className = '', menuClassName = '', onDepartureRequest, toggleClassName = '' }: ProfileMenuProps) {
  const { logout } = useAuth()
  const { menuLabel, ownerKey, startTour, state: tourState } = useProductTour()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [restartDialogOpen, setRestartDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) closeMenu()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeMenu, open])

  const handleLogout = async () => {
    if (isLoggingOut) return
    if (onDepartureRequest) {
      closeMenu()
      onDepartureRequest(logout)
      return
    }
    setIsLoggingOut(true)
    await logout().catch(() => setIsLoggingOut(false))
  }

  const openTour = () => {
    closeMenu()
    const restarting = tourState?.status === 'active' || tourState?.status === 'paused'
    if (onDepartureRequest) {
      onDepartureRequest(startTour, restarting ? 'tour-restart' : 'tour-start')
      return
    }
    if (restarting) {
      setRestartDialogOpen(true)
      return
    }
    startTour()
  }

  const confirmRestart = () => {
    setRestartDialogOpen(false)
    startTour()
  }

  const cancelRestart = useCallback(() => setRestartDialogOpen(false), [])

  return (
    <div className={`product-header-profile ${className}`.trim()} ref={containerRef}>
      <button
        className={`product-header-profile__toggle ${toggleClassName}`.trim()}
        ref={triggerRef}
        type="button"
        aria-label="Меню профиля"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <img src={profileArtwork} alt="" width={400} height={400} decoding="async" />
      </button>
      {open && (
        <div className={`product-header-menu ${menuClassName}`.trim()}>
          <span className="product-header-menu__identity">Демо-профиль</span>
          {pathname !== '/home' && <Link to="/home" onClick={() => closeMenu()}>К кейсам</Link>}
          <button type="button" disabled={!ownerKey} onClick={openTour}>{menuLabel}</button>
          <button type="button" disabled={isLoggingOut} onClick={() => void handleLogout()}>{isLoggingOut ? 'Выходим…' : 'Выйти'}</button>
        </div>
      )}
      {restartDialogOpen && <ProductTourRestartDialog
        onCancel={cancelRestart}
        onConfirm={confirmRestart}
        returnFocusRef={triggerRef}
      />}
    </div>
  )
}
