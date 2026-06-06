import client from '@/infrastructure/http/client'
import { Case } from '@/domain/entities/Case'

export const CaseRepository = {
  async fetchAll({ status, originType, priority, applicationId, specialistId, page, pageSize } = {}) {
    const params = {}
    if (status) params.status = status
    if (originType) params.origin_type = originType
    if (priority) params.priority = priority
    if (applicationId) params.application_id = applicationId
    if (specialistId) params.specialist_id = specialistId
    if (page) params.page = page
    if (pageSize) params.page_size = pageSize

    const { data } = await client.get('/cases', { params })
    const items = Array.isArray(data) ? data : data.items ?? data.data ?? []
    const total = data.total ?? items.length
    return {
      data: items.map(item => new Case(item)),
      total,
      page: data.page ?? page ?? 1,
      pageSize: data.page_size ?? pageSize ?? 100,
    }
  },

  async fetchById(id) {
    const { data } = await client.get(`/cases/${id}`)
    return new Case(data)
  },

  async create(payload) {
    const body = {
      application_id: payload.applicationId,
      origin: payload.origin,
      subject: payload.subject ?? '',
      description: payload.description ?? '',
      priority: payload.priority ?? 'normal',
    }
    if (payload.supportLevelId) body.support_level_id = payload.supportLevelId
    if (payload.supportCategoryId) body.support_category_id = payload.supportCategoryId

    const { data } = await client.post('/cases', body)
    return new Case(data)
  },

  async update(id, fields) {
    const body = {}
    if (fields.subject != null) body.subject = fields.subject
    if (fields.description != null) body.description = fields.description
    if (fields.priority != null) body.priority = fields.priority
    if (fields.supportCategoryId !== undefined) body.support_category_id = fields.supportCategoryId
    if (fields.supportLevelId !== undefined) body.support_level_id = fields.supportLevelId

    const { data } = await client.patch(`/cases/${id}`, body)
    return new Case(data)
  },

  async updateStatus(id, status) {
    const { data } = await client.patch(`/cases/${id}/status`, { status })
    return new Case(data)
  },

  async assignWdd({ caseId, applicationId, supportLevelId, supportCategoryId }) {
    const body = { case_id: caseId }
    if (applicationId)      body.application_id      = applicationId
    if (supportLevelId)     body.support_level_id    = supportLevelId
    if (supportCategoryId)  body.support_category_id = supportCategoryId
    const { data } = await client.post('/cases/assign/wdd', body)
    return data
  },

  async assignManual({ caseId, specialistId, workWindowId, reason }) {
    const body = {
      case_id: caseId,
      specialist_id: specialistId,
    }
    if (workWindowId) body.work_window_id = workWindowId
    if (reason) body.reason = reason

    const { data } = await client.post('/cases/assign/manual', body)
    return data
  },

  async reassign({ caseId, currentSpecialistId, newSpecialistId, reason, workWindowId, newSupportLevelId, note }) {
    const body = {
      case_id: caseId,
      current_specialist_id: currentSpecialistId,
      new_specialist_id: newSpecialistId,
      reason: reason || 'reassignment_same_level',
    }
    if (workWindowId) body.work_window_id = workWindowId
    if (newSupportLevelId) body.new_support_level_id = newSupportLevelId
    if (note) body.note = note

    const { data } = await client.post('/cases/reassign', body)
    return data
  },

  async fetchWorkloads(applicationId, { supportLevelId, supportCategoryId } = {}) {
    const params = { application_id: applicationId }
    if (supportLevelId)    params.support_level_id    = supportLevelId
    if (supportCategoryId) params.support_category_id = supportCategoryId
    const { data } = await client.get('/specialists/workload', { params })
    return Array.isArray(data) ? data : data.items ?? data.data ?? []
  },
}
