import client from '@/infrastructure/http/client'
import { SupportLevel } from '@/domain/entities/SupportLevel'

export const SupportLevelRepository = {
  async fetchAll() {
    const { data } = await client.get('/support-levels')
    return data.map((item) => new SupportLevel(item))
  },

  async fetchById(supportLevelId) {
    const { data } = await client.get(`/support-levels/${supportLevelId}`)
    return new SupportLevel(data)
  },

  async create(supportLevelData) {
    const { data } = await client.post('/support-levels', supportLevelData)
    return new SupportLevel(data)
  },

  async update(supportLevelId, supportLevelData) {
    const { data } = await client.put(`/support-levels/${supportLevelId}`, supportLevelData)
    return new SupportLevel(data)
  },

  async delete(supportLevelId) {
    await client.delete(`/support-levels/${supportLevelId}`)
  },

  // ── Pivot: Support Level ↔ Support Category ──

  async fetchSupportCategories(supportLevelId) {
    const { data } = await client.get(`/support-levels/${supportLevelId}/support-categories`)
    return Array.isArray(data) ? data : data.data ?? []
  },

  async addSupportCategory(supportLevelId, supportCategoryId) {
    const { data } = await client.post(`/support-levels/${supportLevelId}/support-categories`, {
      support_category_id: supportCategoryId,
    })
    return data
  },

  async syncSupportCategories(supportLevelId, supportCategoryIds) {
    const { data } = await client.put(`/support-levels/${supportLevelId}/support-categories/sync`, {
      support_category_ids: supportCategoryIds,
    })
    return Array.isArray(data) ? data : data.data ?? []
  },

  async removeSupportCategoryPivot(recordId) {
    await client.delete(`/support-levels/support-categories/${recordId}`)
  },
}
