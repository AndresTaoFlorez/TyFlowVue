import client from '@/infrastructure/http/client'
import { TOKEN_KEY, REFRESH_KEY } from '@/infrastructure/http/client'

export async function loginUseCase(email, password) {
  const { data } = await client.post('/auth/login', { email, password })

  localStorage.setItem(TOKEN_KEY, data.access_token)
  localStorage.setItem(REFRESH_KEY, data.refresh_token)

  return data.user
}
