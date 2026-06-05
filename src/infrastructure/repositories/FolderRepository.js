import client from '@/infrastructure/http/client'
import { Folder } from '@/domain/entities/Folder'

export const FolderRepository = {
  async fetchByApplication(applicationId) {
    const { data } = await client.get('/folders', {
      params: { application_id: applicationId },
    })
    const items = Array.isArray(data) ? data : data.items ?? data.data ?? []
    return items.map((item) => new Folder(item))
  },

  async fetchById(id) {
    const { data } = await client.get(`/folders/${id}`)
    return new Folder(data)
  },

  async create(payload) {
    const { data } = await client.post('/folders', payload)
    return new Folder(data)
  },

  async update(id, payload) {
    const { data } = await client.patch(`/folders/${id}`, payload)
    return new Folder(data)
  },

  async delete(id) {
    await client.delete(`/folders/${id}`)
  },
}
