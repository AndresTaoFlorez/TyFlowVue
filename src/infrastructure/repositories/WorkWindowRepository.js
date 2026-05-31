import client from '@/infrastructure/http/client'
import { WorkWindow } from '@/domain/entities/WorkWindow'

export const WorkWindowRepository = {
  async fetchAll(params = {}) {
    const { data } = await client.get('/work-windows', { params })
    const items = Array.isArray(data) ? data : data.data ?? []
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
      })),
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new WorkWindow(item))
  },

  async update(id, { startsAt = null, endsAt = null, note = null, inheritsOnReopen = null } = {}) {
    const payload = {}
    if (startsAt != null) payload.starts_at = startsAt
    if (endsAt != null) payload.ends_at = endsAt
    if (note != null) payload.note = note
    if (inheritsOnReopen != null) payload.inherits_on_reopen = inheritsOnReopen
    const { data } = await client.patch(`/work-windows/${id}`, payload)
    return new WorkWindow(data)
  },

  async deleteWindows(ids) {
    await client.delete('/work-windows', { data: { ids } })
  },

  async toggleWindows(ids) {
    const { data } = await client.post('/work-windows/toggle', { ids })
    return data
  },
}
