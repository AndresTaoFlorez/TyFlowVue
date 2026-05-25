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

  async create({ specialistId, applicationId, startTime, endTime, inheritsOnReopen = false }) {
    const { data } = await client.post('/work-windows', {
      windows: [{
        specialist_id: specialistId,
        application_id: applicationId,
        start_time: startTime,
        end_time: endTime,
        inherits_on_reopen: inheritsOnReopen,
      }],
    })
    return data
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
}
