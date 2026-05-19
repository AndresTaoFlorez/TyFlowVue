import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginUseCase } from '@/application/use-cases/auth/LoginUseCase'
import { logoutUseCase } from '@/application/use-cases/auth/LogoutUseCase'
import { fetchMeUseCase } from '@/application/use-cases/users/FetchMeUseCase'
import { TOKEN_KEY } from '@/infrastructure/http/client'
import { UserInactiveError } from '@/domain/errors/DomainErrors'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const profile = ref(null)

  const isAuthenticated = computed(() => !!user.value && !!localStorage.getItem(TOKEN_KEY))
  const isAdmin = computed(() => {
    const roles = profile.value?.roleName || ''
    return roles.split(',').map(r => r.trim().toLowerCase()).includes('admin')
  })

  async function login(email, password) {
    const authUser = await loginUseCase(email, password)
    user.value = authUser

    await fetchProfile()
  }

  async function fetchProfile() {
    const userProfile = await fetchMeUseCase()

    if (!userProfile.isActive) {
      logout()
      throw new UserInactiveError()
    }

    profile.value = userProfile
  }

  function logout() {
    logoutUseCase()
    user.value = null
    profile.value = null
  }

  return {
    user,
    profile,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    fetchProfile,
  }
})
