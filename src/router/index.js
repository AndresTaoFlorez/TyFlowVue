import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/presentation/views/LoginView.vue'
import ForgotPasswordView from '@/presentation/views/ForgotPasswordView.vue'
import ResetPasswordView from '@/presentation/views/ResetPasswordView.vue'
import MainLayout from '@/presentation/layouts/MainLayout.vue'
import DashboardView from '@/presentation/views/DashboardView.vue'
import UsersView from '@/presentation/views/UsersView.vue'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

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
        },
      ],
    },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login' })
  } else if (!requiresAuth && authStore.isAuthenticated && to.name === 'login') {
    next({ name: 'dashboard' })
  } else {
    next()
  }
})

export default router
