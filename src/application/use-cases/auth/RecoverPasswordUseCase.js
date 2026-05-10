import client from '@/infrastructure/http/client'

export async function recoverPasswordUseCase(email) {
  const { data } = await client.post('/auth/recover', { email })
  return data.message
}
