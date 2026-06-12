import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import MainLayout from '@/presentation/layouts/MainLayout.vue'
import DashboardView from '@/presentation/views/DashboardView.vue'
import UsersView from '@/presentation/views/UsersView.vue'
import ProfileView from '@/presentation/views/ProfileView.vue'
import ApplicationsView from '@/presentation/views/ApplicationsView.vue'
import CalendarioView from '@/presentation/views/CalendarioView.vue'
import CasesView from '@/presentation/views/CasesView.vue'
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
          meta: { requiresAdmin: true, title: 'Aplicaciones', mainMode: 'flush', dense: true },
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: CalendarioView,
          // mainMode 'bare': el calendario gestiona su lienzo a sangre completa
          // y publica su toolbar/filtros en los boards del shell.
          meta: { title: 'Calendario', mainMode: 'bare', dense: true },
        },
        {
          path: 'cases',
          name: 'cases-list',
          component: CasesView,
          meta: { title: 'Casos', mainMode: 'flush', dense: true },
        },
        // El estado dejó de vivir en la URL: ahora es un filtro de columna.
        // Redirects de compatibilidad para deep-links viejos.
        {
          path: 'cases/list/:status',
          redirect: { name: 'cases-list' },
        },
        {
          path: 'cases/list/:status/:id',
          redirect: (to) => ({ name: 'cases-list-detail', params: { id: to.params.id } }),
        },
        {
          path: 'cases/specialists',
          name: 'cases-specialists',
          component: CasesView,
          meta: { title: 'Especialistas', mainMode: 'flush', dense: true },
        },
        {
          path: 'cases/specialists/:specialistId',
          name: 'cases-specialist-detail',
          component: CasesView,
          meta: { title: 'Especialistas', mainMode: 'flush', dense: true },
        },
        // Cargas se fusionó con Especialistas (modo columnas)
        {
          path: 'cases/loads',
          name: 'cases-loads',
          component: CasesView,
          meta: { title: 'Especialistas', mainMode: 'flush', dense: true },
        },
        {
          path: 'cases/loads/:specialistId',
          name: 'cases-loads-specialist',
          component: CasesView,
          meta: { title: 'Especialistas', mainMode: 'flush', dense: true },
        },
        {
          path: 'cases/loads/:specialistId/:caseId',
          name: 'cases-loads-case',
          component: CasesView,
          meta: { title: 'Especialistas', mainMode: 'flush', dense: true },
        },
        {
          path: 'cases/:id',
          name: 'cases-list-detail',
          component: CasesView,
          meta: { title: 'Caso', mainMode: 'flush', dense: true },
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
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: (to) => {
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) return { name: 'login' }
        return _getDefaultRoute()
      },
    },
  ],
})

// Maps route names to their menu preference key (routes not listed are always available)
const MENU_ROUTE_MAP = {
  'dashboard':            'home',
  'cases-list':           'cases',
  'cases-list-detail':    'cases',
  'cases-specialists':    'cases',
  'cases-specialist-detail': 'cases',
  'cases-loads':          'cases',
  'cases-loads-specialist':'cases',
  'cases-loads-case':     'cases',
  'applications':         'applications',
}

function _getDefaultRoute() {
  const prefs = usePreferencesStore()
  if (prefs.menus.home) return { name: 'dashboard' }
  return { name: 'calendar' }
}

function _isRouteDisabledByMenu(routeName) {
  const menuKey = MENU_ROUTE_MAP[routeName]
  if (!menuKey) return false
  const prefs = usePreferencesStore()
  return !prefs.menus[menuKey]
}

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const requiresAuth = to.meta.requiresAuth || to.matched.some(r => r.meta.requiresAuth)

  if (requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'profile' }
  } else if (!requiresAuth && authStore.isAuthenticated && to.name === 'login') {
    return _getDefaultRoute()
  }

  // Redirect away from routes whose menu is disabled
  if (requiresAuth && _isRouteDisabledByMenu(to.name)) {
    return _getDefaultRoute()
  }
})

export { MENU_ROUTE_MAP }

export default router
