const TOKEN_STORAGE_KEY = 'farmershaus-auth'
const STAFF_TOKEN_STORAGE_KEY = 'farmershaus-staff-auth'

export type AuthTokens = {
  access: string
  refresh: string
}

export function getAuthTokens(): AuthTokens | null {
  try {
    const value = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!value) return null
    const tokens = JSON.parse(value) as Partial<AuthTokens>
    return typeof tokens.access === 'string' && typeof tokens.refresh === 'string'
      ? { access: tokens.access, refresh: tokens.refresh }
      : null
  } catch {
    return null
  }
}

export function saveAuthTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event('farmershaus:auth-changed'))
}

export function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event('farmershaus:auth-changed'))
}

export function getStaffAuthTokens(): AuthTokens | null {
  try {
    const value = localStorage.getItem(STAFF_TOKEN_STORAGE_KEY)
    if (!value) return null
    const tokens = JSON.parse(value) as Partial<AuthTokens>
    return typeof tokens.access === 'string' && typeof tokens.refresh === 'string'
      ? { access: tokens.access, refresh: tokens.refresh }
      : null
  } catch {
    return null
  }
}

export function saveStaffAuthTokens(tokens: AuthTokens): void {
  localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event('farmershaus:staff-auth-changed'))
}

export function clearStaffAuthTokens(): void {
  localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event('farmershaus:staff-auth-changed'))
}
