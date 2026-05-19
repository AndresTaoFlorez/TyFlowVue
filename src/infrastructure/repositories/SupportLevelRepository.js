import client from '@/infrastructure/http/client'
import { SupportLevel } from '@/domain/entities/SupportLevel'

export const SupportLevelRepository = {
  async fetchAll() {
    const { data } = await client.get('/support-levels')
    return data.map((item) => new SupportLevel(item))
  },

  async fetchById(supportLevelId) {
    const { data } = await client.get(`/support-levels/${supportLevelId}`)
    return new SupportLevel(data)
  },

  async create(supportLevelData) {
    const { data } = await client.post('/support-levels', supportLevelData)
    return new SupportLevel(data)
  },

  async delete(supportLevelId) {
    await client.delete(`/support-levels/${supportLevelId}`)
  },
}
