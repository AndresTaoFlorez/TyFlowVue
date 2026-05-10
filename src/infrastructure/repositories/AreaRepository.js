import client from '@/infrastructure/http/client'
import { Area } from '@/domain/entities/Area'

export const AreaRepository = {
  async fetchAll() {
    const { data } = await client.get('/areas')
    return data.map((item) => new Area(item))
  },
}
