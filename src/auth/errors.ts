import { isAuthClientError } from '@/services/contracts/authClient'

export function getErrorMessage(error: unknown, fallback: string) {
  return isAuthClientError(error) ? error.message : fallback
}

export function getFieldErrors(error: unknown) {
  return isAuthClientError(error) ? error.fieldErrors : {}
}
