export const MAX_STICKY_CODE_LENGTH = 8

export function normalizeStickyCode(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, MAX_STICKY_CODE_LENGTH)
    .toUpperCase()
}

export function isValidStickyCode(value: string): boolean {
  const normalized = normalizeStickyCode(value)
  return /^[A-Z0-9]{8}$/.test(normalized)
}
