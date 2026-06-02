import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'tyflow_preferences'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = loadFromStorage()

  const theme = ref(saved.theme ?? 'light')
  const calendarStartHour = ref(saved.calendarStartHour ?? 6)
  const calendarEndHour = ref(saved.calendarEndHour ?? 22)
  const notifyAssignments = ref(saved.notifyAssignments ?? true)
  const notifyCases = ref(saved.notifyCases ?? true)
  const notifySound = ref(saved.notifySound ?? false)

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: theme.value,
      calendarStartHour: calendarStartHour.value,
      calendarEndHour: calendarEndHour.value,
      notifyAssignments: notifyAssignments.value,
      notifyCases: notifyCases.value,
      notifySound: notifySound.value,
    }))
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // Auto-persist and apply on any change
  watch([theme, calendarStartHour, calendarEndHour, notifyAssignments, notifyCases, notifySound], () => {
    persist()
  })

  watch(theme, () => {
    applyTheme()
  })

  return {
    theme,
    calendarStartHour,
    calendarEndHour,
    notifyAssignments,
    notifyCases,
    notifySound,
    toggleTheme,
    applyTheme,
  }
})
