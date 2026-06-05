import { ref } from 'vue'

const TOKEN_KEY = 'tyflow_token'
const BACKOFF_BASE = 2000
const BACKOFF_MAX = 30000

/** @type {import('vue').Ref<'disconnected'|'connecting'|'connected'|'reconnecting'>} */
export const wsStatus = ref('disconnected')

class WsClient {
  constructor() {
    this._ws = null
    this._listeners = new Map()
    this._retries = 0
    this._stopped = false
    this._retryTimer = null
  }

  connect(token) {
    const tok = token ?? localStorage.getItem(TOKEN_KEY)
    if (!tok) return

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8181'
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/events'
    this._stopped = false
    wsStatus.value = this._retries > 0 ? 'reconnecting' : 'connecting'

    try {
      this._ws = new WebSocket(`${wsUrl}?token=${tok}`)
    } catch {
      this._scheduleRetry()
      return
    }

    this._ws.onopen = () => {
      this._retries = 0
      wsStatus.value = 'connected'
    }

    this._ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data)
        const type = msg.type
        const payload = msg.data ?? msg.payload ?? {}
        this._listeners.get(type)?.forEach(fn => fn(payload))
        this._listeners.get('*')?.forEach(fn => fn({ type, payload }))
      } catch { /* ignore malformed */ }
    }

    this._ws.onerror = () => { /* onclose handles retry */ }

    this._ws.onclose = ({ code }) => {
      if (code === 4001 || this._stopped) {
        wsStatus.value = 'disconnected'
        return
      }
      wsStatus.value = 'reconnecting'
      this._scheduleRetry()
    }
  }

  disconnect() {
    this._stopped = true
    if (this._retryTimer) clearTimeout(this._retryTimer)
    if (this._ws) { this._ws.onclose = null; this._ws.close() }
    this._ws = null
    wsStatus.value = 'disconnected'
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set())
    this._listeners.get(type).add(fn)
    return () => this._listeners.get(type)?.delete(fn)
  }

  _scheduleRetry() {
    if (this._retries >= 8) {
      wsStatus.value = 'disconnected'
      return
    }
    const delay = Math.min(BACKOFF_BASE * 2 ** this._retries, BACKOFF_MAX)
    this._retries++
    this._retryTimer = setTimeout(() => this.connect(), delay)
  }
}

export const wsClient = new WsClient()
