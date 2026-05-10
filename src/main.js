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
await authStore.initAuth()

app.use(router)
app.mount('#app')
