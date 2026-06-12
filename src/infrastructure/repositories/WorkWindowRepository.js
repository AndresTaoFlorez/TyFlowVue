import client from '@/infrastructure/http/client'
import { WorkWindow } from '@/domain/entities/WorkWindow'
import { nextSyncSeq, syncGuardHeaders } from '@/infrastructure/sync/syncSeq'

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

  async fetchById(id) {
    const { data } = await client.get(`/work-windows/${id}`)
    return new WorkWindow(data)
  },

  async create(windowsArray) {
    const list = Array.isArray(windowsArray) ? windowsArray : [windowsArray]
    const { data } = await client.post('/work-windows', {
      windows: list.map(w => ({
        specialist_id: w.specialistId,
        application_id: w.applicationId,
        starts_at: w.startsAt,
        ends_at: w.endsAt,
        inherits_on_reopen: w.inheritsOnReopen ?? false,
        affinity_weight: w.affinityWeight ?? null,
      })),
    })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
  },

  /**
   * Crea una SERIE recurrente para un par especialista+aplicación.
   * El backend (fn_create_recurring_work_windows) ordena las ocurrencias,
   * resuelve la cadena de herencia automáticamente (§11.2 de las reglas) y es
   * atómico: cualquier fallo revierte toda la serie.
   * occurrences: [{ starts_at, ends_at }] (timestamptz ISO, máx 200).
   */
  async createRecurring({ specialistId, applicationId, occurrences, affinityWeight = 1 }) {
    const { data } = await client.post('/work-windows/recurring', {
      specialist_id: specialistId,
      application_id: applicationId,
      occurrences,
      affinity_weight: affinityWeight,
    })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
  },

  _buildPatchItem(id, { startsAt = null, endsAt = null, note = null, inheritsOnReopen = null, affinityWeight = undefined } = {}) {
    // op_seq: supersesión per-item (API_CONTRACT §15) — si el backend ya
    // recibió un op_seq más nuevo para esta window, descarta este item y lo
    // devuelve en `superseded` (sin emitir su evento WebSocket).
    const item = { id, op_seq: nextSyncSeq() }
    if (startsAt != null) item.starts_at = startsAt
    if (endsAt != null) item.ends_at = endsAt
    if (note != null) item.note = note
    if (inheritsOnReopen != null) item.inherits_on_reopen = inheritsOnReopen
    if (affinityWeight !== undefined) item.affinity_weight = affinityWeight
    return item
  },

  async update(id, fields = {}) {
    const item = this._buildPatchItem(id, fields)
    const { data } = await client.patch('/work-windows', { windows: [item] })
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
    const { data } = await client.patch('/work-windows', { windows })
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

  async toggleWindows(ids) {
    const { data } = await client.post('/work-windows/toggle', { ids })
    return data
  },

  async disinherit(ids) {
    const { data } = await client.post('/work-windows/disinherit', { ids })
    return data
  },

  async inherit(ids) {
    const { data } = await client.post('/work-windows/inherit', { ids })
    return data
  },

  async merge(ids) {
    const { data } = await client.post('/work-windows/merge', { ids })
    return {
      mode: data.mode,
      windows: (data.windows ?? []).map(item => new WorkWindow(item)),
      deletedIds: data.deleted_ids ?? [],
    }
  },
}
