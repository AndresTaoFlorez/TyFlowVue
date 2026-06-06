import client from '@/infrastructure/http/client'

export const CaseAssignContextRepository = {
  /**
   * Fetch assign context for a case.
   * Phase 1 (no supportLevelId): returns levels + all specialists, categories=[].
   * Phase 2 (with supportLevelId): returns categories + filtered specialists.
   *
   * @param {string} caseId
   * @param {string|null} supportLevelId
   */
  async fetchContext(caseId, supportLevelId = null) {
    const params = {}
    if (supportLevelId) params.support_level_id = supportLevelId
    const { data } = await client.get(`/cases/${caseId}/assign-context`, { params })
    return {
      supportLevels:     data.support_levels     ?? [],
      supportCategories: data.support_categories ?? [],
      specialists:       data.specialists        ?? [],
    }
  },
}
