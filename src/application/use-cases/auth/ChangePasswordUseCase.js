import client from '@/infrastructure/http/client'

export async function changePasswordUseCase(newPassword) {
  const { data } = await client.post('/auth/change-password', {
    new_password: newPassword,
  })
  return data.message
}
