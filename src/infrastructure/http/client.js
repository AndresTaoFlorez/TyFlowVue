import axios from 'axios'
import { ApiError } from './ApiError'

const TOKEN_KEY = 'tyflow_token'
const REFRESH_KEY = 'tyflow_refresh_token'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor: attach Bearer token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Error de red (sin respuesta del servidor)
    if (!error.response) {
      return Promise.reject(ApiError.networkError(error))
    }

    const status = error.response.status
    const data = error.response.data

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

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return false

  try {
    const { data } = await axios.post(
      `${import.meta.env.VITE_API_URL}/auth/refresh`,
      { refresh_token: refreshToken }
    )
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(REFRESH_KEY, data.refresh_token)
    return true
  } catch {
    return false
  }
}

export default client
export { TOKEN_KEY, REFRESH_KEY }
