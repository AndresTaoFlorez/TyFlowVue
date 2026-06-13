import 'boxicons/css/boxicons.min.css'
// Inter self-hosted (woff2, subset latin) — solo los pesos usados
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-800.css'
import '@/presentation/styles/font-overrides.css'
import '@/presentation/styles/tokens.css'
import '@/presentation/styles/reset.css'
import '@/presentation/styles/utilities.css'
import '@/presentation/styles/pending.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { wsClient } from '@/infrastructure/realtime/wsClient'

const app = createApp(App)
app.use(createPinia())

const prefs = usePreferencesStore()
prefs.applyTheme()

const authStore = useAuthStore()

const token = localStorage.getItem('tyflow_token')
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      authStore.user = { id: payload.sub, email: payload.email }
      await authStore.fetchProfile()
      wsClient.connect()
    }
  } catch { /* token invalido, se ignora */ }
}

app.use(router)
app.mount('#app')

if (window.__splashCleanup) window.__splashCleanup()
