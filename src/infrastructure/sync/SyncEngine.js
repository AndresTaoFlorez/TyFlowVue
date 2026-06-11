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
 *  QUIÉN LO USA (modos de uso)
 * ═══════════════════════════════════════════════════════════════════════
 *
 *   1) USO COMPLETO (dataset entero, cache-first + sync CRDT):
 *      - useUserStore: roles, support levels, support categories, applications
 *        (`appSync`, etc.) → loadFromCache + syncInBackground + updateLocal.
 *      - Casos (realtime): insertLocal / removeLocal / updateLocal sobre eventos.
 *
 *   2) USO PARCIAL / SOLO-CACHÉ (useCalendarStore, ventanas de trabajo):
 *      Las ventanas se piden por RANGO de fechas (estrategia acumulativa), no
 *      como dataset completo, así que `fetchRemote` va vacío y NO se llama a
 *      `syncInBackground`. El engine se usa solo para `loadFromCache()` al boot.
 *      La reconciliación CRDT (LWW) se REIMPLEMENTA en `_mergeWindows` del store
 *      con la misma semántica (registro local reciente < RECENT_WINDOW gana).
 *      Si en el futuro se quisiera caché persistente de ventanas, el punto único
 *      sería `_invalidateCache()` (hoy no-op) → `writeToCache(windows.value)`.
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
  constructor({ cacheKey, hydrate, fetchRemote, getId, recentWindowMs, syncTtlMs }) {
    this._cacheKey = cacheKey
    this._hydrate = hydrate
    this._fetchRemote = fetchRemote
    this._getId = getId
    this._recentWindowMs = recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS
    this._syncTtlMs    = syncTtlMs ?? 5 * 60_000  // 5 min default — skip sync if fresher
    this._syncPromise  = null  // deduplicates concurrent in-flight syncs
    this._lastSyncAt   = null  // epoch ms of last completed sync
  }

  // ──────────────────────────────────────────────
  //  CACHE: lectura / escritura en localStorage
  // ──────────────────────────────────────────────

  /**
   * Lee del cache y rehidrata cada objeto como instancia de la entidad.
   * Si cacheKey es null (estado sesión-only) o el cache no existe, devuelve [].
   * @returns {Entity[]}
   */
  loadFromCache() {
    if (!this._cacheKey) return []
    try {
      const raw = JSON.parse(localStorage.getItem(this._cacheKey)) || []
      return raw.map(this._hydrate)
    } catch {
      return []
    }
  }

  /**
   * Persiste el array actual al cache de localStorage.
   * Si cacheKey es null, no persiste (estado sesión-only).
   * @param {Entity[]} items
   */
  writeToCache(items) {
    if (!this._cacheKey) return
    localStorage.setItem(this._cacheKey, JSON.stringify(items))
  }

  /**
   * Elimina el cache de localStorage.
   * Si cacheKey es null, no hace nada.
   */
  clearCache() {
    if (!this._cacheKey) return
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
  /**
   * Sincroniza en background respetando TTL y deduplicación.
   *
   * - Si hay un sync en vuelo → todos los callers esperan el mismo promise (no duplica requests).
   * - Si el último sync fue hace menos de `syncTtlMs` → no hace nada (datos frescos).
   * - Si expiró el TTL → fetch, merge CRDT, actualiza state + cache.
   *
   * Llamar desde `loadX()` cada vez que se quiere "mantener fresco" un dataset.
   * El SyncEngine decide por sí mismo si realmente necesita ir al backend.
   *
   * @param {import('vue').Ref<Entity[]>} stateRef
   * @param {{ force?: boolean }} [opts]
   */
  async syncInBackground(stateRef, { force = false } = {}) {
    if (this._syncPromise) return this._syncPromise

    const now = Date.now()
    if (!force && this._lastSyncAt && now - this._lastSyncAt < this._syncTtlMs) return

    this._syncPromise = (async () => {
      try {
        const remote = await this._fetchRemote()
        const merged = this.merge(stateRef.value, remote)
        stateRef.value = merged
        this.writeToCache(merged)
        this._lastSyncAt = Date.now()
      } catch {
        // Silent fail — el cache local se preserva
      } finally {
        this._syncPromise = null
      }
    })()
    return this._syncPromise
  }

  /**
   * Fuerza un sync ignorando el TTL. Usar después de mutaciones que necesitan
   * reflejar el estado real del backend (ej: después de crear/eliminar un registro).
   */
  async forceSync(stateRef) {
    this._lastSyncAt = null
    return this.syncInBackground(stateRef, { force: true })
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

  /**
   * Inserta un item al inicio del state y persiste al cache.
   * Marca el item con _localUpdatedAt para protegerlo del próximo sync CRDT.
   *
   * Uso típico: evento realtime `case.created`.
   *
   * @param {import('vue').Ref<Entity[]>} stateRef
   * @param {Entity} item
   * @returns {Entity} - La entidad marcada con timestamp local
   */
  insertLocal(stateRef, item) {
    const marked = this._markLocal(item)
    stateRef.value = [marked, ...stateRef.value]
    this.writeToCache(stateRef.value)
    return marked
  }

  /**
   * Elimina un item del state por ID y persiste al cache.
   *
   * Uso típico: eventos realtime `case.assigned` (caso sale de "open"),
   * `case.updated` (caso ya no coincide con los filtros activos).
   *
   * @param {import('vue').Ref<Entity[]>} stateRef
   * @param {string} id - ID del registro a eliminar
   * @returns {boolean} - true si encontró y eliminó el item
   */
  removeLocal(stateRef, id) {
    const idx = stateRef.value.findIndex(item => this._getId(item) === id)
    if (idx === -1) return false
    stateRef.value = [
      ...stateRef.value.slice(0, idx),
      ...stateRef.value.slice(idx + 1),
    ]
    this.writeToCache(stateRef.value)
    return true
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
