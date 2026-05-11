import client from '@/infrastructure/http/client'
import { Area } from '@/domain/entities/Area'

export const AreaRepository = {
  async fetchAll() {
    const { data } = await client.get('/areas')
    return data.map((item) => new Area(item))
  },

  async fetchById(areaId) {
    const { data } = await client.get(`/areas/${areaId}`)
    return new Area(data)
  },

  async create(areaData) {
    const { data } = await client.post('/areas', areaData)
    return new Area(data)
  },

  async delete(areaId) {
    await client.delete(`/areas/${areaId}`)
  },
}
