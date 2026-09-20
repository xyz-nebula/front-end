import type { ReactNode } from 'react'
import type { TrainingCase } from '@/types/case'

export function CaseIcon({ name }: { name: TrainingCase['icon'] }) {
  const paths: Record<TrainingCase['icon'], ReactNode> = {
    wallet: <><path d="M5 7.5V6a2 2 0 0 1 2-2h9.5A1.5 1.5 0 0 1 18 5.5V8" /><path d="M5 7.5h13.5A1.5 1.5 0 0 1 20 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9A1 1 0 0 1 5 7.5Z" /><path d="M16 12h4v3h-4a1.5 1.5 0 0 1 0-3Z" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    receipt: <><path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Z" /><path d="M10 8h4m-4 4h5m-5 4h3" /></>,
    tag: <><path d="M4 5v6l8.5 8.5 7-7L11 4H5a1 1 0 0 0-1 1Z" /><circle cx="8" cy="8" r="1.5" /></>,
    dialogue: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3v-3.5A2.5 2.5 0 0 1 4 10.5v-5Z" /><path d="M10 17h4l4 3v-3.5a2.5 2.5 0 0 0 2-2.45V9.5A2.5 2.5 0 0 0 18 7" /></>,
  }

  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
