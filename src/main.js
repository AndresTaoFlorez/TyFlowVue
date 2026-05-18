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

const token = localStorage.getItem('tyflow_token')
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      authStore.user = { id: payload.sub, email: payload.email }
      await authStore.fetchProfile()
    }
  } catch { /* token invalido, se ignora */ }
}

app.use(router)
app.mount('#app')
