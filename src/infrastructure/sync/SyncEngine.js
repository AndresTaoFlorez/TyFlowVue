/**
 * SyncEngine — Motor centralizado de sincronización cache/state/backend.
 *
 * Implementa un patrón cache-first con reconciliación CRDT (Last-Write-Wins)
 * para mantener datos consistentes entre localStorage, Pinia state y el backend.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  FLUJO DE DATOS
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   ┌─────────────┐    rehidrata     ┌─────────────┐   fetch async   ┌─────────────┐
 *   │ localStorage │ ──────────────► │ Pinia State  │ ◄────────────── │   Backend   │
 *   │   (cache)    │ ◄────────────── │  (reactivo)  │ ──────────────► │  (REST API) │
 *   └─────────────┘    persiste      └─────────────┘   mutaciones    └─────────────┘
 *
 *   1. INIT:   Cache → State (instantáneo, UI lista de inmediato)
 *   2. SYNC:   Backend → merge CRDT → State + Cache (en background)
 *   3. UPDATE: State + Cache (optimista) → Backend (confirma)
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  CRDT — LAST-WRITE-WINS (LWW)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   Cada registro local puede tener un campo `_localUpdatedAt` (ISO timestamp)
 *   que marca cuándo fue la última modificación local.
 *
 *   Al hacer merge con datos del backend:
 *   - Si el registro local tiene `_localUpdatedAt` reciente (< RECENT_WINDOW):
 *     → el local GANA (fue modificado hace poco, el backend aún no refleja el cambio)
 *   - Si el registro local no tiene `_localUpdatedAt` o es viejo:
 *     → el backend GANA (es la fuente de verdad)
 *
 *   RECENT_WINDOW por defecto: 30 segundos. Esto cubre el tiempo entre una
 *   mutación optimista y la confirmación del backend.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  USO
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   import { SyncEngine } from '@/infrastructure/sync/SyncEngine'
 *   import { Application } from '@/domain/entities/Application'
 *
 *   const appSync = new SyncEngine({
 *     cacheKey: 'tyflow_applications_v2',
 *     hydrate: (raw) => new Application(raw),
 *     fetchRemote: () => fetchApplicationsUseCase(),
 *     getId: (item) => item.id,
 *   })
 *
 *   // En el store:
 *   const items = ref(appSync.loadFromCache())         // 1. Init desde cache
 *   await appSync.syncInBackground(items)               // 2. Sync con backend
 *   appSync.updateLocal(items, id, updatedItem)          // 3. Mutación local
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const DEFAULT_RECENT_WINDOW_MS = 30_000 // 30 segundos

export class SyncEngine {
  /**
   * @param {Object} config
   * @param {string} config.cacheKey - Clave de localStorage para este dataset
   * @param {Function} config.hydrate - (raw: Object) => Entity — rehidrata plain objects del cache
   * @param {Function} config.fetchRemote - () => Promise<Entity[]> — fetch al backend
   * @param {Function} config.getId - (item: Entity) => string — extrae el ID único
   * @param {number} [config.recentWindowMs=30000] - Ventana en ms donde el local gana sobre el backend
   */
  constructor({ cacheKey, hydrate, fetchRemote, getId, recentWindowMs }) {
    this._cacheKey = cacheKey
    this._hydrate = hydrate
    this._fetchRemote = fetchRemote
    this._getId = getId
    this._recentWindowMs = recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS
  }

  // ──────────────────────────────────────────────
  //  CACHE: lectura / escritura en localStorage
  // ──────────────────────────────────────────────

  /**
   * Lee del cache y rehidrata cada objeto como instancia de la entidad.
   * Si el cache no existe o está corrupto, devuelve [].
   * @returns {Entity[]}
   */
  loadFromCache() {
    try {
      const raw = JSON.parse(localStorage.getItem(this._cacheKey)) || []
      return raw.map(this._hydrate)
    } catch {
      return []
    }
  }

  /**
   * Persiste el array actual al cache de localStorage.
   * @param {Entity[]} items
   */
  writeToCache(items) {
    localStorage.setItem(this._cacheKey, JSON.stringify(items))
  }

  /**
   * Elimina el cache de localStorage.
   */
  clearCache() {
    localStorage.removeItem(this._cacheKey)
  }

  // ──────────────────────────────────────────────
  //  SYNC: reconciliación CRDT con el backend
  // ──────────────────────────────────────────────

  /**
   * Ejecuta la sincronización en background:
   * 1. Pide datos frescos al backend
   * 2. Hace merge CRDT con el state local
   * 3. Actualiza el ref reactivo y el cache
   *
   * No bloquea la UI. Si falla, el cache local se mantiene intacto.
   *
   * @param {import('vue').Ref<Entity[]>} stateRef - Ref reactivo de Pinia
   * @returns {Promise<void>}
   */
  async syncInBackground(stateRef) {
    try {
      const remote = await this._fetchRemote()
      const merged = this.merge(stateRef.value, remote)
      stateRef.value = merged
      this.writeToCache(merged)
    } catch {
      // Silent fail — el cache local se preserva
    }
  }

  /**
   * Merge CRDT Last-Write-Wins entre datos locales y remotos.
   *
   * Reglas:
   * 1. Para cada registro remoto, busca su contraparte local:
   *    - Si local tiene `_localUpdatedAt` reciente → local gana
   *    - Si no → remoto gana (fuente de verdad)
   * 2. Registros que solo existen localmente se descartan
   *    (el backend es la fuente canónica de existencia).
   *
   * @param {Entity[]} local - Datos actuales del state/cache
   * @param {Entity[]} remote - Datos frescos del backend
   * @returns {Entity[]} - Array mergeado
   */
  merge(local, remote) {
    const localMap = new Map(local.map(item => [this._getId(item), item]))
    const now = Date.now()
    const merged = []

    for (const remoteItem of remote) {
      const id = this._getId(remoteItem)
      const localItem = localMap.get(id)

      if (localItem?._localUpdatedAt) {
        const localAge = now - new Date(localItem._localUpdatedAt).getTime()
        if (localAge < this._recentWindowMs) {
          // Cambio local reciente — preservar
          merged.push(localItem)
          continue
        }
      }

      // Sin cambio local o cambio viejo — backend gana
      merged.push(remoteItem)
    }

    return merged
  }

  // ──────────────────────────────────────────────
  //  MUTACIONES LOCALES: optimistas + cache
  // ──────────────────────────────────────────────

  /**
   * Actualiza un registro en el state y el cache.
   * Marca el registro con `_localUpdatedAt` para protegerlo del próximo sync.
   *
   * @param {import('vue').Ref<Entity[]>} stateRef - Ref reactivo de Pinia
   * @param {string} id - ID del registro a actualizar
   * @param {Entity} updated - Instancia actualizada de la entidad
   * @returns {Entity} - La entidad marcada con timestamp local
   */
  updateLocal(stateRef, id, updated) {
    const marked = this._markLocal(updated)
    const idx = stateRef.value.findIndex(item => this._getId(item) === id)
    if (idx !== -1) {
      stateRef.value = [
        ...stateRef.value.slice(0, idx),
        marked,
        ...stateRef.value.slice(idx + 1),
      ]
    } else {
      stateRef.value = [...stateRef.value, marked]
    }
    this.writeToCache(stateRef.value)
    return marked
  }

  /**
   * Reemplaza todo el state con datos frescos (ej. después de un fetch exitoso).
   * Limpia los marcadores locales.
   *
   * @param {import('vue').Ref<Entity[]>} stateRef
   * @param {Entity[]} items
   */
  replaceAll(stateRef, items) {
    stateRef.value = items
    this.writeToCache(items)
  }

  // ──────────────────────────────────────────────
  //  INTERNAL
  // ──────────────────────────────────────────────

  /**
   * Marca una entidad con `_localUpdatedAt` para CRDT.
   * Si la entidad tiene método `withLocalUpdate()`, lo usa.
   * Si no, crea una copia shallow con el campo añadido.
   */
  _markLocal(item) {
    if (typeof item.withLocalUpdate === 'function') {
      return item.withLocalUpdate()
    }
    const copy = Object.assign(Object.create(Object.getPrototypeOf(item)), item)
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
