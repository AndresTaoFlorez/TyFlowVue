import client from '@/infrastructure/http/client'
import { User } from '@/domain/entities/User'

export const ApplicationRepository = {
  async fetchAll() {
    const { data } = await client.get('/applications')
    return data
  },

  async create(name) {
    const { data } = await client.post('/applications', { name })
    return data
  },

  async delete(applicationId) {
    await client.delete(`/applications/${applicationId}`)
  },

  async fetchSpecialists(applicationId) {
    const { data } = await client.get('/users', {
      params: { is_specialist: true, application_ids: applicationId },
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new User(item))
  },
}
