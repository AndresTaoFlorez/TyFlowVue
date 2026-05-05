import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)
app.use(createPinia())
const authStore = useAuthStore() // <-- 2. Creamos la constante

await authStore.initAuth()
app.use(router)
// agregamos esta línea para inicializar la autenticación al cargar la aplicación, para ver si ya hay una sesion activa

app.mount('#app')


