import conflictArtwork from '@/assets/home/case-conflict.webp'
import deadlineArtwork from '@/assets/home/case-deadline.webp'
import employeeArtwork from '@/assets/home/case-employee.webp'
import priceArtwork from '@/assets/home/case-price.webp'
import refundArtwork from '@/assets/home/case-refund.webp'
import salaryArtwork from '@/assets/home/case-salary.webp'
import type { CasePresentation } from '@/types/case'

interface PresentationRegistryEntry extends CasePresentation {
  aliases: string[]
}

const genericPresentation: CasePresentation = {
  roleSummaries: ['Ваша роль в этом переговорном кейсе.', 'Роль AI-оппонента в этом кейсе.'],
  accent: 'violet',
  icon: 'dialogue',
}

const registry: PresentationRegistryEntry[] = [
  { aliases: ['salary-review', 'Повышение зарплаты'], roleSummaries: ['Добивается пересмотра условий и готов подтвердить свой вклад.', 'Отвечает за бюджет команды и принимает решение о повышении.'], accent: 'violet', icon: 'wallet', artwork: salaryArtwork },
  { aliases: ['difficult-employee', 'Сложный сотрудник'], roleSummaries: ['Хочет сохранить доверие и вернуть результативную работу.', 'Объясняет свою позицию и ожидания от руководителя.'], accent: 'lime', icon: 'people', artwork: employeeArtwork },
  { aliases: ['missed-deadline', 'Срыв дедлайна'], roleSummaries: ['Отвечает за общий срок и хочет восстановить контроль над проектом.', 'Объясняет задержку и предлагает план завершения работы.'], accent: 'orange', icon: 'clock', artwork: deadlineArtwork },
  { aliases: ['refund', 'Возврат денег'], roleSummaries: ['Добивается справедливого возврата денег.', 'Проверяет условия возврата и защищает интересы компании.'], accent: 'blue', icon: 'receipt', artwork: refundArtwork },
  { aliases: ['price-talks', 'Переговоры о цене'], roleSummaries: ['Сохраняет ценность предложения и маржу.', 'Ищет лучшие условия для своей компании.'], accent: 'pink', icon: 'tag', artwork: priceArtwork },
  { aliases: ['team-conflict', 'Конфликт в команде'], roleSummaries: ['Помогает команде договориться и продолжить работу.', 'Рассказывает о своих потребностях и причинах конфликта.'], accent: 'mint', icon: 'dialogue', artwork: conflictArtwork },
]

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ru-RU')
}

export function getCasePresentation(identity: { id: string; title: string }): CasePresentation {
  const keys = new Set([normalize(identity.id), normalize(identity.title)])
  const entry = registry.find((candidate) => candidate.aliases.some((alias) => keys.has(normalize(alias))))
  if (!entry) return { ...genericPresentation, roleSummaries: [...genericPresentation.roleSummaries] }
  return {
    roleSummaries: [...entry.roleSummaries],
    accent: entry.accent,
    icon: entry.icon,
    ...(entry.artwork ? { artwork: entry.artwork } : {}),
  }
}
