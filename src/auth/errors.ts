import { isApiError } from '@/api/auth'

export function getErrorMessage(error: unknown, fallback: string) {
  return isApiError(error) ? error.message : fallback
}

export function getFieldErrors(error: unknown) {
  return isApiError(error) ? error.fieldErrors : {}
}
