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
}
