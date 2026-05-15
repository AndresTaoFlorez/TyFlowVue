import 'boxicons/css/boxicons.min.css'
import '@/styles/font-overrides.css'
import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/utilities.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const app = createApp(App)
app.use(createPinia())

const authStore = useAuthStore()

// Decode JWT synchronously to set auth state before routing,
// then fetch profile in background after mount (non-blocking FCP/LCP)
const token = localStorage.getItem('tyflow_token')
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      authStore.user = { id: payload.sub, email: payload.email }
    }
  } catch { /* invalid token, will be handled by initAuth */ }
}

app.use(router)
app.mount('#app')

// Fetch profile after mount so it doesn't block rendering
authStore.initAuth()
