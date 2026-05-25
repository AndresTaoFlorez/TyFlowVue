import client from '@/infrastructure/http/client'

export const SpecialistRepository = {
  async fetchAll() {
    const { data } = await client.get('/specialists')
    return data
  },

  async syncSupportLevels(specialistId, supportLevelIds) {
    const { data } = await client.put('/specialist-support-levels/sync', {
      specialist_id: specialistId,
      support_level_ids: supportLevelIds,
    })
    return data
  },
}
