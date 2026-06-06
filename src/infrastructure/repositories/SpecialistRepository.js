import client from '@/infrastructure/http/client'

export const SpecialistRepository = {
  async fetchById(specialistId) {
    const { data } = await client.get(`/specialists/${specialistId}`)
    return data
  },

  // ── Specialist ↔ App-Level (unified) ──

  async fetchAppLevels(specialistId) {
    const { data } = await client.get(`/specialists/${specialistId}/app-levels`)
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async assignAppLevel(specialistId, applicationId, supportLevelId) {
    const { data } = await client.post(`/specialists/${specialistId}/app-levels`, {
      application_id: applicationId,
      support_level_id: supportLevelId,
    })
    return data
  },

  async syncAppLevels(specialistId, entries) {
    const { data } = await client.put(`/specialists/${specialistId}/app-levels/sync`, {
      entries,
    })
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async removeAppLevel(recordId) {
    await client.delete(`/specialists/app-levels/${recordId}`)
  },
}
