import client from '@/infrastructure/http/client'

export async function checkEmailUseCase(email) {
  const { data } = await client.post('/auth/check-email', { email })
  return data.exists === true
}
