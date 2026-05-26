export class WorkWindow {
  constructor({
    id, specialist_id, application_id, start_time, end_time,
    scheduled_date = null,
    opening_count = 0, current_count = 0, inherits_on_reopen = false,
    is_active = true, created_at = null, closed_at = null,
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
    this.closedAt = closed_at
    this.closingCount = closing_count
    this.inheritedFromWindowId = inherited_from_window_id
    this.deletedAt = deleted_at
  }

  /** Sesion abierta = closed_at es null (las ventanas se crean abiertas) */
  get isSessionOpen() {
    return this.closedAt == null && this.deletedAt == null
  }

  /** Hora de inicio como numero (ej: "08:00:00-05" → 8) */
  get startHour() {
    return parseInt(this.startTime?.split(':')[0], 10) || 8
  }

  /** Hora de fin como numero (ej: "17:00:00-05" → 17) */
  get endHour() {
    return parseInt(this.endTime?.split(':')[0], 10) || 17
  }

  /** Rango horario legible (ej: "8:00 – 17:00") */
  get timeRange() {
    return `${this.startHour}:00 – ${this.endHour}:00`
  }
}
