import { Link } from 'react-router-dom'

interface LogoProps {
  inverse?: boolean
  compact?: boolean
}

export function Logo({ inverse = false, compact = false }: LogoProps) {
  return (
    <Link className={`brand ${inverse ? 'brand--inverse' : ''}`} to="/" aria-label="Арена переговоров">
      <span className="brand__mark" aria-hidden="true"><span /><span /></span>
      {!compact && <span className="brand__name">Арена <span>переговоров</span></span>}
    </Link>
  )
}
