import type { NegotiationMode } from '@/types/negotiation'

export interface PendingSessionCreate {
  sourceContext: string
  caseId: string
  mode: NegotiationMode
  clientCommandId: string
}

type SessionCreateContext = Omit<PendingSessionCreate, 'clientCommandId'>

function matchesContext(
  command: PendingSessionCreate,
  context: SessionCreateContext,
): boolean {
  return command.sourceContext === context.sourceContext
    && command.caseId === context.caseId
    && command.mode === context.mode
}

function parseStoredCommand(
  value: string | null,
  context: SessionCreateContext,
): PendingSessionCreate | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'sourceContext' in parsed
      && 'caseId' in parsed
      && 'mode' in parsed
      && 'clientCommandId' in parsed
    ) {
      const command = parsed as Record<string, unknown>
      if (
        typeof command.sourceContext === 'string'
        && typeof command.caseId === 'string'
        && (command.mode === 'text' || command.mode === 'voice')
        && typeof command.clientCommandId === 'string'
      ) {
        const candidate: PendingSessionCreate = {
          sourceContext: command.sourceContext,
          caseId: command.caseId,
          mode: command.mode,
          clientCommandId: command.clientCommandId,
        }
        return matchesContext(candidate, context) ? candidate : null
      }
    }
  } catch {
    // Older TrainingModal versions stored the command ID as a plain string.
    return { ...context, clientCommandId: value }
  }
  return null
}

export function getOrCreatePendingSessionCreate(
  storageKey: string,
  context: SessionCreateContext,
  memoryCommand: PendingSessionCreate | null,
): PendingSessionCreate {
  if (memoryCommand && matchesContext(memoryCommand, context)) return memoryCommand

  let command: PendingSessionCreate | null = null
  try {
    command = parseStoredCommand(window.sessionStorage.getItem(storageKey), context)
  } catch {
    // The returned command remains available to the component through its ref.
  }
  command ??= { ...context, clientCommandId: crypto.randomUUID() }
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(command))
  } catch {
    // In-memory recovery still protects retries while this component is mounted.
  }
  return command
}

export function clearPendingSessionCreate(storageKey: string): void {
  try {
    window.sessionStorage.removeItem(storageKey)
  } catch {
    // The server has confirmed creation; storage cleanup is best-effort.
  }
}
