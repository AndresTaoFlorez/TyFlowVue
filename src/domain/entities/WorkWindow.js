export class WorkWindow {
  constructor({
    id, specialist_id, application_id, starts_at, ends_at,
    opening_count = 0, current_count = 0, inherits_on_reopen = false,
    is_active = true, created_at = null, deactivated_at = null,
    closing_count = null, inherited_from_window_id = null,
    affinity_weight = null, deleted_at = null,
  }) {
    this.id = id
    this.specialistId = specialist_id
    this.applicationId = application_id
    this.startsAt = starts_at
    this.endsAt = ends_at
    this.openingCount = opening_count
    this.currentCount = current_count
    this.inheritsOnReopen = inherits_on_reopen
    this.isActive = is_active
    this.createdAt = created_at
    this.deactivatedAt = deactivated_at
    this.closingCount = closing_count
    this.inheritedFromWindowId = inherited_from_window_id
    this.affinityWeight = affinity_weight
    this.deletedAt = deleted_at
  }

  get scheduledDate() {
    if (!this.startsAt) return null
    const d = new Date(this.startsAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  get endDate() {
    if (!this.endsAt) return this.scheduledDate
    const d = new Date(this.endsAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  get spansMultipleDays() {
    return this.scheduledDate !== this.endDate
  }

  get startTime() {
    if (!this.startsAt) return null
    const d = new Date(this.startsAt)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  get endTime() {
    if (!this.endsAt) return null
    const d = new Date(this.endsAt)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  get startHour() {
    if (!this.startsAt) return 8
    const d = new Date(this.startsAt)
    return d.getHours() + d.getMinutes() / 60
  }

  get endHour() {
    if (!this.endsAt) return 17
    const d = new Date(this.endsAt)
    return d.getHours() + d.getMinutes() / 60
  }

  // --- Temporal guards (match backend fn_update_work_window rules) ---

  /** Window is currently in shift: now() between starts_at and ends_at AND active */
  get isInShift() {
    if (!this.startsAt || !this.endsAt || !this.isActive) return false
    const now = Date.now()
    return now >= new Date(this.startsAt).getTime() && now <= new Date(this.endsAt).getTime()
  }

  /** Window start has already passed */
  get hasStarted() {
    if (!this.startsAt) return false
    return Date.now() >= new Date(this.startsAt).getTime()
  }

  /** Can starts_at be changed? Blocked only while in-shift */
  get canEditStart() { return !this.isInShift }

  get timeRange() {
    const fmt = (t) => {
      if (!t) return '?'
      const [h, m] = t.split(':')
      return `${parseInt(h, 10)}:${m}`
    }
    return `${fmt(this.startTime)} – ${fmt(this.endTime)}`
  }

  _toRaw() {
    return {
      id: this.id,
      specialist_id: this.specialistId,
      application_id: this.applicationId,
      starts_at: this.startsAt,
      ends_at: this.endsAt,
      opening_count: this.openingCount,
      current_count: this.currentCount,
      inherits_on_reopen: this.inheritsOnReopen,
      is_active: this.isActive,
      created_at: this.createdAt,
      deactivated_at: this.deactivatedAt,
      closing_count: this.closingCount,
      inherited_from_window_id: this.inheritedFromWindowId,
      affinity_weight: this.affinityWeight,
      deleted_at: this.deletedAt,
    }
  }

  withToggled(newIsActive) {
    return new WorkWindow({
      ...this._toRaw(),
      is_active: newIsActive,
    })
  }

  static toTimestampTz(date, time) {
    if (!date || !time) return null
    const t = time.length === 5 ? `${time}:00` : time
    // Use browser's local timezone offset for the given date/time
    const d = new Date(`${date}T${t}`)
    const offset = -d.getTimezoneOffset() // minutes, positive = east of UTC
    const sign = offset >= 0 ? '+' : '-'
    const oh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const om = String(Math.abs(offset) % 60).padStart(2, '0')
    return `${date}T${t}${sign}${oh}:${om}`
  }
}
