import client from '@/infrastructure/http/client'

export const AppLevelCategoryRepository = {
  async fetchAll(applicationId, supportLevelId) {
    const { data } = await client.get('/application-level-categories', {
      params: { application_id: applicationId, support_level_id: supportLevelId },
    })
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async assign(applicationId, supportLevelId, supportCategoryId) {
    const { data } = await client.post('/application-level-categories', {
      application_id: applicationId,
      support_level_id: supportLevelId,
      support_category_id: supportCategoryId,
    })
    return data
  },

  async sync(applicationId, supportLevelId, supportCategoryIds) {
    const { data } = await client.put('/application-level-categories/sync', {
      support_category_ids: supportCategoryIds,
    }, {
      params: { application_id: applicationId, support_level_id: supportLevelId },
    })
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  async remove(recordId) {
    await client.delete(`/application-level-categories/${recordId}`)
  },
}
