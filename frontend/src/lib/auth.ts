const TOKEN_STORAGE_KEY = 'farmershaus-auth'

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
