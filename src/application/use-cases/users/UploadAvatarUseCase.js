import { UserRepository } from '@/infrastructure/repositories/UserRepository'

/**
 * Sube la foto de perfil del usuario actual (multipart → backend) y devuelve el
 * perfil completo actualizado (con preferences.avatar_url).
 */
export async function uploadAvatarUseCase(file) {
  return UserRepository.uploadAvatar(file)
}
