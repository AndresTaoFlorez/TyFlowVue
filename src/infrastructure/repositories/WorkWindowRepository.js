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
        start_time: w.startTime,
        end_time: w.endTime,
        scheduled_date: w.scheduledDate,
        inherits_on_reopen: w.inheritsOnReopen ?? false,
      })),
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new WorkWindow(item))
  },

  async openSession(id, { inheritedFromWindowId = null, note = null } = {}) {
    await client.post(`/work-windows/${id}/open`, {
      inherited_from_window_id: inheritedFromWindowId,
      note,
    })
  },

  async closeSession(id) {
    await client.post(`/work-windows/${id}/close`)
  },

  async update(id, { startTime = null, endTime = null, scheduledDate = null, note = null } = {}) {
    const payload = {}
    if (startTime != null) payload.start_time = startTime
    if (endTime != null) payload.end_time = endTime
    if (scheduledDate != null) payload.scheduled_date = scheduledDate
    if (note != null) payload.note = note
    const { data } = await client.patch(`/work-windows/${id}`, payload)
    return new WorkWindow(data)
  },

  async deleteWindows(ids) {
    await client.delete('/work-windows', { data: { ids } })
  },
}
