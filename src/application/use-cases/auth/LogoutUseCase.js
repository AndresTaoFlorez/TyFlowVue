import { TOKEN_KEY, REFRESH_KEY } from '@/infrastructure/http/client'

export function logoutUseCase() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
