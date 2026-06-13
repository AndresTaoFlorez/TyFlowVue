import client from '@/infrastructure/http/client'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { nextSyncSeq, syncGuardHeaders } from '@/infrastructure/sync/syncSeq'

// Timezone model (API_CONTRACT §15): the work-windows API speaks one declared
// timezone per request. Payload timestamps must be NAIVE (no offset/`Z`, e.g.
// "2026-06-05T08:00:00") — an offset-aware value is rejected with 422. The
// frontend builds local wall-clock timestamps (Bogota), so we strip the offset
// before sending and declare the timezone explicitly.
const WW_TIMEZONE = 'America/Bogota'

/** Strip a trailing timezone offset (`±HH:MM`) or `Z` → naive local wall-clock. */
function toNaive(ts) {
  return ts ? ts.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '') : ts
}

export const WorkWindowRepository = {
  async fetchAll(params = {}) {
    const { data } = await client.get('/work-windows', { params })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
  },

  /**
   * Paginated variant that preserves the backend envelope (total/page).
   * Used by the specialist detail panel; fetchAll keeps its legacy shape.
   */
  async fetchPage(params = {}) {
    const { data } = await client.get('/work-windows', { params })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return {
      data: items.map((item) => new WorkWindow(item)),
      total: data.total ?? items.length,
      page: data.page ?? params.page ?? 1,
      pageSize: data.page_size ?? params.page_size ?? 100,
    }
  },

  /**
   * Unitary lookup. `GET /work-windows/{id}` was removed (API_CONTRACT §15):
   * use the `work_window_id` query param, which returns the usual paginated
   * shape with 0 or 1 items.
   */
  async fetchById(id) {
    const { data } = await client.get('/work-windows', { params: { work_window_id: id } })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.length ? new WorkWindow(items[0]) : null
  },

  /** Timeline del servidor — el "now" canónico de las reglas de sellado. */
  async fetchTimeline() {
    const { data } = await client.get('/work-windows/timeline')
    return data // { timeline, timeline_bogota, timezone }
  },

  // Work windows are availability only (API_CONTRACT §15): the create payload no
  // longer carries application_id / affinity_weight / inherits_on_reopen — a
  // window is created standalone; chain it afterward via PATCH inherits_on_reopen.
  async create(windowsArray) {
    const list = Array.isArray(windowsArray) ? windowsArray : [windowsArray]
    const { data } = await client.post('/work-windows', {
      windows: list.map(w => ({
        specialist_id: w.specialistId,
        starts_at: toNaive(w.startsAt),
        ends_at: toNaive(w.endsAt),
      })),
      timezone: WW_TIMEZONE,
    })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
  },

  /**
   * Crea una serie de ventanas. `POST /work-windows/recurring` fue eliminado
   * (API_CONTRACT §15): las ocurrencias ya expandidas por el cliente se crean
   * como ventanas estándar en un solo POST batch. (El encadenado automático de
   * herencia del antiguo endpoint ya no aplica — se ajusta luego vía PATCH
   * inherits_on_reopen si hace falta.)
   * occurrences: [{ starts_at, ends_at }] (máx 200).
   */
  async createRecurring({ specialistId, occurrences }) {
    const { data } = await client.post('/work-windows', {
      windows: occurrences.map(o => ({
        specialist_id: specialistId,
        starts_at: toNaive(o.starts_at),
        ends_at: toNaive(o.ends_at),
      })),
      timezone: WW_TIMEZONE,
    })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
  },

  _buildPatchItem(id, { startsAt = null, endsAt = null, note = null, inheritsOnReopen = null, isActive = undefined } = {}) {
    // op_seq: supersesión per-item (API_CONTRACT §15) — si el backend ya
    // recibió un op_seq más nuevo para esta window, descarta este item y lo
    // devuelve en `superseded` (sin emitir su evento WebSocket).
    const item = { id, op_seq: nextSyncSeq() }
    if (startsAt != null) item.starts_at = toNaive(startsAt)
    if (endsAt != null) item.ends_at = toNaive(endsAt)
    if (note != null) item.note = note
    if (inheritsOnReopen != null) item.inherits_on_reopen = inheritsOnReopen
    // is_active replaces the removed POST /toggle (API_CONTRACT §15).
    if (isActive !== undefined) item.is_active = isActive
    return item
  },

  async update(id, fields = {}) {
    const item = this._buildPatchItem(id, fields)
    const { data } = await client.patch('/work-windows', { windows: [item], timezone: WW_TIMEZONE })
    const items = Array.isArray(data) ? data : data.updated ?? data.data ?? data.items ?? []
    // El batch responde 200 con fallos por ítem: NO tragarlos como no-op —
    // propagar la razón para que el caller revierta el optimista y la muestre.
    const failed = (Array.isArray(data) ? [] : data.failed) ?? []
    if (items.length === 0 && failed.length > 0) {
      throw new Error(failed[0]?.reason || 'No se pudo actualizar la ventana.')
    }
    // Superada → null: el caller lo trata como no-op (la ganadora pinta).
    return items.length > 0 ? new WorkWindow(items[0]) : null
  },

  async batchUpdate(items) {
    const windows = items.map(({ id, ...fields }) => this._buildPatchItem(id, fields))
    const { data } = await client.patch('/work-windows', { windows, timezone: WW_TIMEZONE })
    const result = Array.isArray(data) ? data : data.updated ?? data.data ?? data.items ?? []
    return {
      updated: result.map(w => new WorkWindow(w)),
      failed: (Array.isArray(data) ? [] : data.failed) ?? [],
      // Items descartados por LWW ({id, op_seq, superseded_by}) — ignorarlos:
      // ya enviamos un op_seq más nuevo para esas mismas windows.
      superseded: (Array.isArray(data) ? [] : data.superseded) ?? [],
    }
  },

  async deleteWindows(ids) {
    try {
      await client.delete('/work-windows', {
        data: { ids },
        headers: syncGuardHeaders(ids.map(id => `work_window:${id}`)),
      })
    } catch (e) {
      // Superada (409 X-Superseded): una mutación más nueva para estas windows
      // ya llegó — el delete fue descartado. No-op silencioso (§21).
      if (e.isSuperseded) return
      throw e
    }
  },

  // POST /toggle, /inherit and /disinherit were removed (API_CONTRACT §15):
  // activation state and inheritance are now plain fields on PATCH /work-windows.

  /** Set inherits_on_reopen on a batch of windows. Returns the batchUpdate result. */
  async setInheritance(ids, value) {
    return this.batchUpdate(ids.map(id => ({ id, inheritsOnReopen: value })))
  },

  async merge(ids) {
    const { data } = await client.post('/work-windows/merge', { ids, timezone: WW_TIMEZONE })
    return {
      mode: data.mode,
      windows: (data.windows ?? []).map(item => new WorkWindow(item)),
      deletedIds: data.deleted_ids ?? [],
    }
  },
}
