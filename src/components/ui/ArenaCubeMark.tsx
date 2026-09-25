interface ArenaCubeMarkProps {
  className?: string
}

export function ArenaCubeMark({ className }: ArenaCubeMarkProps) {
  return (
    <svg className={className} viewBox="0 0 44 48" aria-hidden="true">
      <path d="M22 2 42 13.5 22 25 2 13.5 22 2Z" fill="#2582ff" />
      <path d="M2 13.5 22 25v21L2 34.5v-21Z" fill="#075dcc" />
      <path d="M22 25 42 13.5v21L22 46V25Z" fill="#f01925" />
      <path d="m22 2 20 11.5-8.3 4.8-20-11.5L22 2Z" fill="#50a1ff" />
      <path d="m22 25 11.7-6.7v21L22 46V25Z" fill="#d80d1b" />
    </svg>
  )
}
