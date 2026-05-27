import client from '@/infrastructure/http/client'
import { User } from '@/domain/entities/User'

export const UserRepository = {
  async fetchAll() {
    const { data } = await client.get('/users')
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new User(item))
  },

  async fetchMe() {
    const { data } = await client.get('/users/me')
    return new User(data)
  },

  async create(userData) {
    const { data } = await client.post('/users', userData)
    return new User(data)
  },

  async update(userId, userData) {
    const url = userId ? `/users/${userId}` : '/users/me'
    const { data } = await client.patch(url, userData)
    return new User(data)
  },

  async toggleStatus(userId, isActive) {
    const { data } = await client.patch(`/users/${userId}`, { is_active: !isActive })
    return new User(data)
  },

  async delete(userId) {
    const { data } = await client.delete(`/users/${userId}`)
    return data
  },

  async fetchByApplication(applicationId) {
    const { data } = await client.get('/users', {
      params: { is_specialist: true, application_ids: applicationId },
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new User(item))
  },
}
