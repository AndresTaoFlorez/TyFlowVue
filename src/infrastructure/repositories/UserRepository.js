import client from '@/infrastructure/http/client'
import { User } from '@/domain/entities/User'

export const UserRepository = {
  async fetchAll() {
    const { data } = await client.get('/users')
    return data.map((item) => new User(item))
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
    const { data } = await client.patch(`/users/${userId}`, userData)
    return new User(data)
  },

  async updateMe(userData) {
    const { data } = await client.patch('/users/me', userData)
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
}
