import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const LoginView = () => import('@/presentation/views/LoginView.vue')
const ForgotPasswordView = () => import('@/presentation/views/ForgotPasswordView.vue')
const ResetPasswordView = () => import('@/presentation/views/ResetPasswordView.vue')
const MainLayout = () => import('@/presentation/layouts/MainLayout.vue')
const DashboardView = () => import('@/presentation/views/DashboardView.vue')
const UsersView = () => import('@/presentation/views/UsersView.vue')
const ProfileView = () => import('@/presentation/views/ProfileView.vue')

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
        },
        {
          path: 'users',
          name: 'users',
          component: UsersView,
          meta: { requiresAdmin: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: ProfileView,
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
  } else if (to.name === 'profile' && authStore.isAdmin) {
    return { name: 'users' }
  } else if (!requiresAuth && authStore.isAuthenticated && to.name === 'login') {
    return { name: 'dashboard' }
  }
})

export default router
