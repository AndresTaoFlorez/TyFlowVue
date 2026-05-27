export class WorkWindow {
  constructor({
    id, specialist_id, application_id, start_time, end_time,
    scheduled_date = null,
    opening_count = 0, current_count = 0, inherits_on_reopen = false,
    is_active = true, created_at = null, opened_at = null, closed_at = null,
    closing_count = null, inherited_from_window_id = null,
    deleted_at = null,
  }) {
    this.id = id
    this.specialistId = specialist_id
    this.applicationId = application_id
    this.startTime = start_time
    this.endTime = end_time
    this.scheduledDate = scheduled_date
    this.openingCount = opening_count
    this.currentCount = current_count
    this.inheritsOnReopen = inherits_on_reopen
    this.isActive = is_active
    this.createdAt = created_at
    this.openedAt = opened_at
    this.closedAt = closed_at
    this.closingCount = closing_count
    this.inheritedFromWindowId = inherited_from_window_id
    this.deletedAt = deleted_at
  }

  get isSessionOpen() {
    return this.closedAt == null && this.deletedAt == null
  }

  get startHour() {
    const parts = this.startTime?.split(':')
    if (!parts) return 8
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  }

  get endHour() {
    const parts = this.endTime?.split(':')
    if (!parts) return 17
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
  }

  get timeRange() {
    const fmt = (t) => {
      const parts = t?.split(':')
      if (!parts) return '?'
      return `${parseInt(parts[0], 10)}:${parts[1]}`
    }
    return `${fmt(this.startTime)} – ${fmt(this.endTime)}`
  }

  _toRaw() {
    return {
      id: this.id,
      specialist_id: this.specialistId,
      application_id: this.applicationId,
      start_time: this.startTime,
      end_time: this.endTime,
      scheduled_date: this.scheduledDate,
      opening_count: this.openingCount,
      current_count: this.currentCount,
      inherits_on_reopen: this.inheritsOnReopen,
      is_active: this.isActive,
      created_at: this.createdAt,
      opened_at: this.openedAt,
      closed_at: this.closedAt,
      closing_count: this.closingCount,
      inherited_from_window_id: this.inheritedFromWindowId,
      deleted_at: this.deletedAt,
    }
  }

  withOpened() {
    return new WorkWindow({
      ...this._toRaw(),
      is_active: true,
      closed_at: null,
      closing_count: null,
    })
  }

  withClosed() {
    return new WorkWindow({
      ...this._toRaw(),
      is_active: false,
      closed_at: new Date().toISOString(),
      closing_count: this.currentCount,
    })
  }

  static formatTimeTz(time) {
    if (!time || time.includes('-') || time.includes('+')) return time
    return time.length === 5 ? `${time}:00-05` : `${time}-05`
  }
}
