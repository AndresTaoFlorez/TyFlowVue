import client from '@/infrastructure/http/client'
import { WorkWindow } from '@/domain/entities/WorkWindow'

export const WorkWindowRepository = {
  async fetchAll(params = {}) {
    const { data } = await client.get('/work-windows', { params })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new WorkWindow(item))
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

  _buildPatchItem(id, { startsAt = null, endsAt = null, note = null, inheritsOnReopen = null, affinityWeight = undefined } = {}) {
    const item = { id }
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
    return items.length > 0 ? new WorkWindow(items[0]) : null
  },

  async batchUpdate(items) {
    const windows = items.map(({ id, ...fields }) => this._buildPatchItem(id, fields))
    const { data } = await client.patch('/work-windows', { windows })
    const result = Array.isArray(data) ? data : data.updated ?? data.data ?? data.items ?? []
    return { updated: result.map(w => new WorkWindow(w)), failed: [] }
  },

  async deleteWindows(ids) {
    await client.delete('/work-windows', { data: { ids } })
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
