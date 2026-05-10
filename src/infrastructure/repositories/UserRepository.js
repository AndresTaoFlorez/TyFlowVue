import client from '@/infrastructure/http/client'
import { User } from '@/domain/entities/User'

export const UserRepository = {
  async fetchAll() {
    const { data } = await client.get('/users')
    return data.map((item) => new User(item))
  },

  async fetchById(userId) {
    const { data } = await client.get(`/users/${userId}`)
    return new User(data)
  },

  async create(userData) {
    const { data } = await client.post('/users', userData)
    return new User(data)
  },

  async update(userId, userData) {
    const { data } = await client.put(`/users/${userId}`, userData)
    return new User(data)
  },

  async toggleStatus(userId) {
    const { data } = await client.patch(`/users/${userId}/status`)
    return new User(data)
  },
}
