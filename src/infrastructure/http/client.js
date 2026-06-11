import axios from 'axios'
import { ApiError } from './ApiError'
import logger from '@/infrastructure/logger'

const TOKEN_KEY = 'tyflow_token'
const REFRESH_KEY = 'tyflow_refresh_token'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach Bearer token + dev logging
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  logger.log(`[HTTP] ${config.method.toUpperCase()} ${config.url}`, config.data ?? '')
  return config
})

// Response interceptor: handle errors
client.interceptors.response.use(
  (response) => {
    logger.log(`[HTTP] ${response.status} ${response.config.url}`, response.data)
    return response
  },
  async (error) => {
    // Error de red (sin respuesta del servidor)
    if (!error.response) {
      return Promise.reject(ApiError.networkError(error))
    }

    const status = error.response.status
    const data = error.response.data

    // Supersesión LWW (API_CONTRACT §21): el backend descartó esta mutación
    // porque ya llegó una más nueva para los mismos recursos (X-Sync-Keys).
    // No es un conflicto de datos: los call sites la tratan como no-op.
    if (status === 409 && String(error.response.headers?.['x-superseded']) === 'true') {
      return Promise.reject(ApiError.superseded(data))
    }

    if (status === 401) {
      const originalRequest = error.config
      const isAuthEndpoint = originalRequest.url?.startsWith('/auth/')

      // En endpoints de auth (login, check-email, etc.) no intentar refresh ni redirigir
      if (isAuthEndpoint) {
        return Promise.reject(ApiError.fromResponse(401, data))
      }

      // Try to refresh token before giving up
      if (!originalRequest._retry) {
        originalRequest._retry = true
        const refreshed = await tryRefreshToken()
        if (refreshed) {
          originalRequest.headers.Authorization = `Bearer ${localStorage.getItem(TOKEN_KEY)}`
          return client(originalRequest)
        }
      }
      // Refresh failed — clear everything and redirect to login
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      window.location.href = '/'
      return Promise.reject(ApiError.fromResponse(401, data))
    }

    return Promise.reject(ApiError.fromResponse(status, data))
  }
)

// Singleton: si ya hay un refresh en vuelo, todos los 401 concurrentes
// esperan el mismo promise en lugar de competir con el refresh token.
let _refreshPromise = null

async function tryRefreshToken() {
  if (_refreshPromise) return _refreshPromise

  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return false

  _refreshPromise = axios
    .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(({ data }) => {
      localStorage.setItem(TOKEN_KEY, data.access_token)
      localStorage.setItem(REFRESH_KEY, data.refresh_token)
      return true
    })
    .catch(() => false)
    .finally(() => { _refreshPromise = null })

  return _refreshPromise
}

export default client
export { TOKEN_KEY, REFRESH_KEY }
