import client from '@/infrastructure/http/client'

export const SpecialistRepository = {
  async create(userId) {
    const { data } = await client.post('/specialists', { user_id: userId })
    return data
  },

  async delete(specialistId) {
    await client.delete(`/specialists/${specialistId}`)
  },

  async fetchSupportLevels(specialistId) {
    const { data } = await client.get(`/specialist-support-levels/by-specialist/${specialistId}`)
    return data
  },

  async assignSupportLevel(specialistId, supportLevelId) {
    const { data } = await client.post('/specialist-support-levels', {
      specialist_id: specialistId,
      support_level_id: supportLevelId,
    })
    return data
  },

  async removeSupportLevel(recordId) {
    await client.delete(`/specialist-support-levels/${recordId}`)
  },
}
