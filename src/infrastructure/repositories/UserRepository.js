import client from '@/infrastructure/http/client'
import { User } from '@/domain/entities/User'

export const UserRepository = {
  async fetchAll() {
    const { data } = await client.get('/users')
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
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
    // Collection-based contract: updating another user is PATCH /users with the
    // target id in the body; updating yourself is PATCH /users/me (id ignored).
    const { data } = userId
      ? await client.patch('/users', { ...userData, id: userId })
      : await client.patch('/users/me', userData)
    return new User(data)
  },

  async toggleStatus(userId, isActive) {
    const { data } = await client.patch('/users', { id: userId, is_active: !isActive })
    return new User(data)
  },

  async delete(userId) {
    const { data } = await client.delete('/users', { params: { id: userId } })
    return data
  },

  async patchPreferences(partial) {
    // Preferences are merged through PATCH /users/me — there is no dedicated
    // preferences endpoint.
    const { data } = await client.patch('/users/me', { preferences: partial })
    return data
  },

  async uploadAvatar(file) {
    // Subida directa multipart al backend (campo del archivo: `data`). El backend
    // guarda el binario y devuelve el perfil completo (igual que GET /users/me),
    // con preferences.avatar_url ya resuelto. El Bearer lo pone el interceptor.
    const fd = new FormData()
    fd.append('data', file)
    const { data } = await client.post('/users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }, // axios añade el boundary
    })
    return new User(data)
  },

  async fetchByApplication(applicationId) {
    const { data } = await client.get('/users', {
      params: { is_specialist: true, application_ids: applicationId },
    })
    const items = Array.isArray(data) ? data : data.data ?? data.items ?? []
    return items.map((item) => new User(item))
  },
}
