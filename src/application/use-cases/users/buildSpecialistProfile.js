/**
 * Build the nested `specialist_profile` payload the /users endpoints expect
 * (API_CONTRACT.md §3 "Write requests").
 *
 * The backend replaces a specialist's whole competency WHITELIST from this single
 * structure: every (application, level) assignment carries its `support_categories`
 * with an `is_assigned` flag (`true` = whitelisted) and an `affinity_weight`
 * (default `1.0`). Categories flagged `is_assigned: false` are simply omitted from
 * the whitelist — there is no separate exclusion/blacklist concept anymore.
 *
 * @param {Array<{application_id?, applicationId?, support_level_id?, supportLevelId?}>} applicationLevels
 * @param {Object<string, Array<{id, is_assigned, affinity_weight?}>>} categoryAssignments — keyed by `${app}_${level}`
 * @returns {{application_assignments: Array}|null} null when there are no assignments (section left untouched)
 */
export function buildSpecialistProfile(applicationLevels, categoryAssignments = {}) {
  if (!Array.isArray(applicationLevels) || applicationLevels.length === 0) return null

  const application_assignments = applicationLevels.map(al => {
    const applicationId = al.application_id ?? al.applicationId
    const supportLevelId = al.support_level_id ?? al.supportLevelId
    const cats = categoryAssignments[`${applicationId}_${supportLevelId}`] ?? []
    return {
      application_id: applicationId,
      support_level: { support_levels_id: supportLevelId },
      support_categories: cats.map(c => ({
        id: c.id,
        is_assigned: c.is_assigned !== false,
        affinity_weight: c.affinity_weight ?? 1.0,
      })),
    }
  })

  return { application_assignments }
}
