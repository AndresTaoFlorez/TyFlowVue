import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginUseCase } from '@/application/use-cases/auth/LoginUseCase'
import { logoutUseCase } from '@/application/use-cases/auth/LogoutUseCase'
import { fetchMeUseCase } from '@/application/use-cases/users/FetchMeUseCase'
import { uploadAvatarUseCase } from '@/application/use-cases/users/UploadAvatarUseCase'
import { TOKEN_KEY } from '@/infrastructure/http/client'
import { UserInactiveError } from '@/domain/errors/DomainErrors'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { wsClient } from '@/infrastructure/realtime/wsClient'

const AVATAR_V_KEY = 'tyflow_avatar_v'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)

  // Cache-buster ESTABLE y persistente de la foto propia: solo cambia cuando el
  // usuario sube una nueva (no en cada carga/navegación), para que el navegador
  // la cachee y se descargue UNA sola vez. Persistido para sobrevivir recargas.
  const avatarVersion = ref(localStorage.getItem(AVATAR_V_KEY) || '')

  // URL pública de la foto propia + cache-buster estable (null si no hay foto).
  // No construimos la URL: la da el backend en preferences.avatar_url.
  const avatarUrl = computed(() => {
    const u = profile.value?.preferences?.avatar_url
    if (!u) return null
    return avatarVersion.value ? `${u}?v=${avatarVersion.value}` : u
  })

  const isAuthenticated = computed(() => !!user.value && !!localStorage.getItem(TOKEN_KEY))
  const isAdmin = computed(() => {
    const roles = profile.value?.roleNames || []
    return roles.map(r => r.toLowerCase()).includes('admin')
  })

  async function login(email, password) {
    const authUser = await loginUseCase(email, password)
    user.value = authUser

    try {
      await fetchProfile()
      wsClient.connect(localStorage.getItem(TOKEN_KEY))
    } catch (e) {
      logout()
      throw e
    }
  }

  async function fetchProfile() {
    const userProfile = await fetchMeUseCase()

    if (!userProfile.isActive) {
      logout()
      throw new UserInactiveError()
    }

    profile.value = userProfile
    usePreferencesStore().initFromPreferences(userProfile.preferences)
  }

  // Sube la foto de perfil y refresca el estado con el perfil que devuelve el
  // backend (incluye preferences.avatar_url). No construimos URLs en el front.
  async function uploadAvatar(file) {
    const updated = await uploadAvatarUseCase(file)
    profile.value = updated
    usePreferencesStore().initFromPreferences(updated.preferences)
    // Cambió la foto → bump del cache-buster (persistido) para forzar UNA
    // re-descarga; luego el navegador la cachea hasta el próximo cambio.
    avatarVersion.value = String(Date.now())
    localStorage.setItem(AVATAR_V_KEY, avatarVersion.value)
    return updated
  }

  function logout() {
    wsClient.disconnect()
    logoutUseCase()
    user.value = null
    profile.value = null
    useUserStore().clearAll()
  }

  return {
    user,
    profile,
    avatarUrl,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    fetchProfile,
    uploadAvatar,
  }
})
