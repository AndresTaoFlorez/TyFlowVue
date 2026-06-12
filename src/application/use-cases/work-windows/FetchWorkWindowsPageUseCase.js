import { WorkWindowRepository } from '@/infrastructure/repositories/WorkWindowRepository'

/**
 * Paginated work-window list preserving the backend envelope.
 * params: { specialist_id, application_id, period, date_from, date_to, page, page_size }
 * Returns { data, total, page, pageSize }.
 */
export async function fetchWorkWindowsPageUseCase(params = {}) {
  return WorkWindowRepository.fetchPage(params)
}
