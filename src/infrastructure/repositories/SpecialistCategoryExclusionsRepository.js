import client from '@/infrastructure/http/client'

export const SpecialistCategoryExclusionsRepository = {
  /**
   * List active exclusions for a specialist.
   * @param {string} specialistId
   * @param {string|null} applicationId — optional filter
   */
  async fetchAll(specialistId, applicationId = null) {
    const params = applicationId ? { application_id: applicationId } : {}
    const { data } = await client.get(
      `/specialists/${specialistId}/category-exclusions`,
      { params }
    )
    return Array.isArray(data) ? data : data.data ?? data.items ?? []
  },

  /**
   * Add an exclusion (disable a category for this specialist).
   * @returns {Object} exclusion record { id, specialist_id, application_id, support_category_id }
   */
  async add(specialistId, applicationId, supportCategoryId) {
    const { data } = await client.post(
      `/specialists/${specialistId}/category-exclusions`,
      { application_id: applicationId, support_category_id: supportCategoryId }
    )
    return data
  },

  /**
   * Remove an exclusion (re-enable a category for this specialist).
   * @param {string} exclusionId — the exclusion record id
   */
  async remove(exclusionId) {
    await client.delete(`/specialists/category-exclusions/${exclusionId}`)
  },
}
