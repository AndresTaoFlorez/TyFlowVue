import client from '@/infrastructure/http/client'
import { Application } from '@/domain/entities/Application'

export const ApplicationRepository = {
  async fetchAll() {
    const { data } = await client.get('/applications')
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new Application(item))
  },

  async create(name) {
    const { data } = await client.post('/applications', { name })
    return new Application(data)
  },

  async update(applicationId, payload) {
    const { data } = await client.patch(`/applications/${applicationId}`, payload)
    return new Application(data)
  },

  async delete(applicationId) {
    await client.delete(`/applications/${applicationId}`)
  },

  // ── Pivot: Application ↔ Support Level ──

  async fetchSupportLevels(applicationId) {
    const { data } = await client.get(`/applications/${applicationId}/support-levels`)
    return Array.isArray(data) ? data : data.data ?? []
  },

  async addSupportLevel(applicationId, supportLevelId) {
    const { data } = await client.post(`/applications/${applicationId}/support-levels`, {
      support_level_id: supportLevelId,
    })
    return data
  },

  async syncSupportLevels(applicationId, supportLevelIds) {
    const { data } = await client.put(`/applications/${applicationId}/support-levels/sync`, {
      support_level_ids: supportLevelIds,
    })
    return Array.isArray(data) ? data : data.data ?? []
  },

  async removeSupportLevelPivot(recordId) {
    await client.delete(`/applications/support-levels/${recordId}`)
  },
}
