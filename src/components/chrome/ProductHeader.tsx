import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { useAuthHomePath } from '@/auth/useAuth'
import { ProfileMenu, type DepartureRequest } from '@/components/chrome/ProfileMenu'
import { ArenaCubeMark } from '@/components/ui/ArenaCubeMark'
import '@/styles/product-header.css'

type ProductHeaderVariant = 'home' | 'preparation' | 'arena' | 'result'

interface VariantClasses {
  root: string
  inner: string
  brand: string
  actions: string
  profile: string
  profileToggle?: string
  profileMenu?: string
}

const variantClasses: Record<ProductHeaderVariant, VariantClasses> = {
  home: {
    root: 'arena-home__header',
    inner: 'arena-home__shell arena-home__header-inner',
    brand: 'arena-home__brand',
    actions: 'arena-home__header-actions',
    profile: 'arena-home__profile',
    profileToggle: 'arena-home__profile-toggle',
    profileMenu: 'arena-home__profile-menu',
  },
  preparation: {
    root: 'preparation-header',
    inner: 'preparation-shell preparation-header__inner',
    brand: 'preparation-header__brand',
    actions: 'preparation-header__profile',
    profile: 'preparation-header__profile-control',
  },
  arena: {
    root: 'duel-header',
    inner: 'duel-shell duel-header__inner',
    brand: 'duel-header__brand',
    actions: 'duel-header__actions',
    profile: 'duel-header__profile',
    profileMenu: 'duel-header__profile-menu',
  },
  result: {
    root: 'result-header',
    inner: 'result-shell result-header__inner',
    brand: 'result-header__brand',
    actions: 'result-header__actions',
    profile: 'result-header__profile',
    profileMenu: 'result-header__profile-menu',
  },
}

export function ProductHeader({ actions, onDepartureRequest, variant }: { actions?: ReactNode; onDepartureRequest?: DepartureRequest; variant: ProductHeaderVariant }) {
  const classes = variantClasses[variant]
  const homePath = useAuthHomePath()
  return (
    <header className={classes.root}>
      <div className={classes.inner}>
        <Link className={classes.brand} to={homePath} aria-label="Арена — на главную">
          <ArenaCubeMark />
          <span>АРЕНА</span>
        </Link>
        <div className={classes.actions}>
          {actions}
          <ProfileMenu
            className={classes.profile}
            menuClassName={classes.profileMenu}
            onDepartureRequest={onDepartureRequest}
            toggleClassName={classes.profileToggle}
          />
        </div>
      </div>
    </header>
  )
}
