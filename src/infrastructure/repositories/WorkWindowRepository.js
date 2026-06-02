import client from '@/infrastructure/http/client'
import { WorkWindow } from '@/domain/entities/WorkWindow'

export const WorkWindowRepository = {
  async fetchAll(params = {}) {
    const { data } = await client.get('/work-windows', { params })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new WorkWindow(item))
  },

  async fetchById(id) {
    const { data } = await client.get(`/work-windows/${id}`)
    return new WorkWindow(data)
  },

  async create(windowsArray) {
    const list = Array.isArray(windowsArray) ? windowsArray : [windowsArray]
    const { data } = await client.post('/work-windows', {
      windows: list.map(w => ({
        specialist_id: w.specialistId,
        application_id: w.applicationId,
        starts_at: w.startsAt,
        ends_at: w.endsAt,
        inherits_on_reopen: w.inheritsOnReopen ?? false,
        affinity_weight: w.affinityWeight ?? null,
      })),
    })
    const items = Array.isArray(data) ? data : data.data ?? []
    return items.map((item) => new WorkWindow(item))
  },

  _buildPatchBody({ startsAt = null, endsAt = null, note = null, inheritsOnReopen = null, affinityWeight = undefined } = {}) {
    const body = {}
    if (startsAt != null) body.starts_at = startsAt
    if (endsAt != null) body.ends_at = endsAt
    if (note != null) body.note = note
    if (inheritsOnReopen != null) body.inherits_on_reopen = inheritsOnReopen
    if (affinityWeight !== undefined) body.affinity_weight = affinityWeight
    return body
  },

  async update(id, fields = {}) {
    const body = this._buildPatchBody(fields)
    const { data } = await client.patch(`/work-windows/${id}`, body)
    return new WorkWindow(data)
  },

  async batchUpdate(items) {
    const results = await Promise.allSettled(
      items.map(({ id, ...fields }) => {
        const body = this._buildPatchBody(fields)
        return client.patch(`/work-windows/${id}`, body).then(r => r.data)
      })
    )
    const updated = []
    const failed = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        updated.push(new WorkWindow(r.value))
      } else {
        failed.push({ id: items[i].id, reason: r.reason?.response?.data?.detail || r.reason?.message || 'Error' })
      }
    })
    return { updated, failed }
  },

  async deleteWindows(ids) {
    await client.delete('/work-windows', { data: { ids } })
  },

  async toggleWindows(ids) {
    const { data } = await client.post('/work-windows/toggle', { ids })
    return data
  },

  async disinherit(ids) {
    const { data } = await client.post('/work-windows/disinherit', { ids })
    return data
  },

  async inherit(ids) {
    const { data } = await client.post('/work-windows/inherit', { ids })
    return data
  },

  async merge(ids) {
    const { data } = await client.post('/work-windows/merge', { ids })
    return {
      mode: data.mode,
      windows: (data.windows ?? []).map(item => new WorkWindow(item)),
      deletedIds: data.deleted_ids ?? [],
    }
  },
}
