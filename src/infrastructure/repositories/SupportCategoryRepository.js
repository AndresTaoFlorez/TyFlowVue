import client from '@/infrastructure/http/client'
import { SupportCategory } from '@/domain/entities/SupportCategory'

export const SupportCategoryRepository = {
  async fetchAll() {
    const { data } = await client.get('/support-categories')
    return data.map((item) => new SupportCategory(item))
  },

  async fetchById(categoryId) {
    const { data } = await client.get(`/support-categories/${categoryId}`)
    return new SupportCategory(data)
  },

  async create(categoryData) {
    const { data } = await client.post('/support-categories', categoryData)
    return new SupportCategory(data)
  },

  async update(categoryId, categoryData) {
    const { data } = await client.put(`/support-categories/${categoryId}`, categoryData)
    return new SupportCategory(data)
  },

  async delete(categoryId) {
    await client.delete(`/support-categories/${categoryId}`)
  },
}
