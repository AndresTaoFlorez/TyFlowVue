import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { UserRepository } from '@/infrastructure/repositories/UserRepository'

const STORAGE_KEY = 'tyflow_preferences_v2'
const DEFAULT_MENUS = { home: true, cases: true, settings: true, applications: true }

// Clear stale v1 storage
localStorage.removeItem('tyflow_preferences')

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = loadFromStorage()

  const theme              = ref(saved.theme              ?? 'light')
  const language           = ref(saved.language           ?? 'es')
  const sidebarDense       = ref(saved.sidebarDense       ?? false)
  const notificationsSound = ref(saved.notificationsSound ?? true)
  const notificationsToast = ref(saved.notificationsToast ?? true)
  const calendarStartHour  = ref(saved.calendarStartHour  ?? 7)
  const menus              = ref({ ...DEFAULT_MENUS, ...(saved.menus ?? {}) })

  let _saveTimer = null

  function _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme:              theme.value,
      language:           language.value,
      sidebarDense:       sidebarDense.value,
      notificationsSound: notificationsSound.value,
      notificationsToast: notificationsToast.value,
      calendarStartHour:  calendarStartHour.value,
      menus:              menus.value,
    }))
  }

  function _debouncedPatch(partial) {
    clearTimeout(_saveTimer)
    _saveTimer = setTimeout(async () => {
      try {
        await UserRepository.patchPreferences(partial)
      } catch { /* silent — local state is still applied */ }
    }, 600)
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // Called by useAuthStore after fetching profile (preferences embedded in /users/me)
  function initFromPreferences(apiPrefs) {
    if (!apiPrefs) return
    if (apiPrefs.theme               != null) theme.value              = apiPrefs.theme
    if (apiPrefs.language            != null) language.value           = apiPrefs.language
    if (apiPrefs.sidebar_dense       != null) sidebarDense.value       = apiPrefs.sidebar_dense
    if (apiPrefs.notifications_sound != null) notificationsSound.value = apiPrefs.notifications_sound
    if (apiPrefs.notifications_toast != null) notificationsToast.value = apiPrefs.notifications_toast
    if (apiPrefs.calendar_start_hour != null) calendarStartHour.value  = apiPrefs.calendar_start_hour
    if (apiPrefs.menus               != null) menus.value              = { ...DEFAULT_MENUS, ...apiPrefs.menus }
    _persist()
    applyTheme()
  }

  watch(theme, (v) => { applyTheme(); _persist(); _debouncedPatch({ theme: v }) })
  watch(language, (v) => { _persist(); _debouncedPatch({ language: v }) })
  watch(sidebarDense, (v) => { _persist(); _debouncedPatch({ sidebar_dense: v }) })
  watch(notificationsSound, (v) => { _persist(); _debouncedPatch({ notifications_sound: v }) })
  watch(notificationsToast, (v) => { _persist(); _debouncedPatch({ notifications_toast: v }) })
  watch(calendarStartHour, (v) => { _persist(); _debouncedPatch({ calendar_start_hour: v }) })
  watch(menus, (v) => { _persist(); _debouncedPatch({ menus: { ...v } }) }, { deep: true })

  return {
    theme,
    language,
    sidebarDense,
    notificationsSound,
    notificationsToast,
    calendarStartHour,
    menus,
    toggleTheme,
    applyTheme,
    initFromPreferences,
  }
})
