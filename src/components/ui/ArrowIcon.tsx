interface ArrowIconProps {
  direction?: 'right' | 'down' | 'up-right'
}

export function ArrowIcon({ direction = 'right' }: ArrowIconProps) {
  const transform = direction === 'down' ? 'rotate(90 10 10)' : direction === 'up-right' ? 'rotate(-45 10 10)' : undefined
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" transform={transform} />
    </svg>
  )
}
