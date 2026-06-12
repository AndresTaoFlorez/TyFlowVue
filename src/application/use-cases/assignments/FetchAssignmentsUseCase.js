import { AssignmentRepository } from '@/infrastructure/repositories/AssignmentRepository'

/**
 * Paginated assignment list. Filters: specialistId, caseId, activeOnly.
 * Returns { data, total, page, pageSize }.
 */
export async function fetchAssignmentsUseCase(filters = {}) {
  return AssignmentRepository.fetchAll(filters)
}
