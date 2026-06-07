import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import MainLayout from '@/presentation/layouts/MainLayout.vue'
import DashboardView from '@/presentation/views/DashboardView.vue'
import UsersView from '@/presentation/views/UsersView.vue'
import ProfileView from '@/presentation/views/ProfileView.vue'
import ApplicationsView from '@/presentation/views/ApplicationsView.vue'
import CalendarioView from '@/presentation/views/CalendarioView.vue'
import CasosView from '@/presentation/views/CasosView.vue'
import SettingsView from '@/presentation/views/SettingsView.vue'

const LoginView = () => import('@/presentation/views/LoginView.vue')
const ForgotPasswordView = () => import('@/presentation/views/ForgotPasswordView.vue')
const ResetPasswordView = () => import('@/presentation/views/ResetPasswordView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordView,
    },
    {
      path: '/app',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: 'Dashboard' },
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { requiresAdmin: true, title: 'Registro de Usuarios' },
        },
        {
          path: 'applications',
          name: 'applications',
          component: ApplicationsView,
          meta: { requiresAdmin: true, title: 'Aplicaciones' },
        },
        {
          path: 'calendario',
          name: 'calendario',
          component: CalendarioView,
          meta: { title: 'Calendario' },
        },
        {
          path: 'casos',
          redirect: { name: 'casos-lista', params: { status: 'open' } },
        },
        {
          path: 'casos/lista/:status',
          name: 'casos-lista',
          component: CasosView,
          meta: { title: 'Casos' },
        },
        {
          path: 'casos/lista/:status/:id',
          name: 'casos-lista-detail',
          component: CasosView,
          meta: { title: 'Caso' },
        },
        {
          path: 'casos/cargas',
          name: 'casos-cargas',
          component: CasosView,
          meta: { title: 'Cargas' },
        },
        {
          path: 'casos/cargas/:specialistId',
          name: 'casos-cargas-specialist',
          component: CasosView,
          meta: { title: 'Cargas' },
        },
        {
          path: 'casos/cargas/:specialistId/:caseId',
          name: 'casos-cargas-case',
          component: CasosView,
          meta: { title: 'Cargas' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: { title: 'Configuración' },
        },
        {
          path: 'profile',
          name: 'profile',
          component: ProfileView,
          meta: { title: 'Mi Perfil' },
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth || to.matched.some(r => r.meta.requiresAuth)

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'profile' }
  } else if (!requiresAuth && authStore.isAuthenticated && to.name === 'login') {
    return { name: 'dashboard' }
  }
})

export default router
