import client from '@/infrastructure/http/client'

// Categories scoped to (application, support_level) pairs.
// API_CONTRACT.md §9 — "Application Support Level Categories".
export const AppSupportLevelCategoryRepository = {
  async fetchAll(applicationId, supportLevelId) {
    const { data } = await client.get('/application-support-level-categories', {
      params: { application_id: applicationId, support_level_id: supportLevelId },
    })
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async assign(applicationId, supportLevelId, supportCategoryId) {
    const { data } = await client.post('/application-support-level-categories', {
      application_id: applicationId,
      support_level_id: supportLevelId,
      support_category_id: supportCategoryId,
    })
    return data
  },

  async sync(applicationId, supportLevelId, supportCategoryIds) {
    const { data } = await client.put('/application-support-level-categories/sync', {
      support_category_ids: supportCategoryIds,
    }, {
      params: { application_id: applicationId, support_level_id: supportLevelId },
    })
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async remove(recordId) {
    await client.delete(`/application-support-level-categories/${recordId}`)
  },
}
