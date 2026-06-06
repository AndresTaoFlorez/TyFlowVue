import client from '@/infrastructure/http/client'

export const SpecialistSupportCategoryRepository = {
  async fetchAll(specialistId) {
    const { data } = await client.get(
      `/specialists/${specialistId}/support-categories`
    )
    return Array.isArray(data) ? data : data.items ?? data.data ?? []
  },

  async sync(specialistId, entries) {
    // entries: [{ support_category_id }]
    const { data } = await client.put(
      `/specialists/${specialistId}/support-categories/sync`,
      { entries }
    )
    return Array.isArray(data) ? data : data.items ?? data.data ?? []
  },
}
