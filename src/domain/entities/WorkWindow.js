export class WorkWindow {
  constructor({
    id, specialist_id, application_id, starts_at, ends_at,
    inherits_on_reopen = false,
    is_active = true, created_at = null, deactivated_at = null,
    inherited_from_window_id = null,
    affinity_weight = null, deleted_at = null,
  }) {
    this.id = id
    this.specialistId = specialist_id
    this.applicationId = application_id
    this.startsAt = starts_at
    this.endsAt = ends_at
    this.inheritsOnReopen = inherits_on_reopen
    this.isActive = is_active
    this.createdAt = created_at
    this.deactivatedAt = deactivated_at
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

  // --- Temporal guards (match backend seal rules from API_CONTRACT) ---
  // A window is **sealed** once starts_at <= Timeline (server now).
  // Frontend uses Date.now() as an approximation; the backend enforces the real Timeline.

  /** Future: starts_at > now — fully editable, deletable, mergeable */
  get isFuture() {
    if (!this.startsAt) return false
    return Date.now() < new Date(this.startsAt).getTime()
  }

  /** Sealed: starts_at <= now — all structural mutations rejected by DB */
  get isSealed() {
    if (!this.startsAt) return false
    return Date.now() >= new Date(this.startsAt).getTime()
  }

  /** Window start has already passed (alias for isSealed for readability) */
  get hasStarted() { return this.isSealed }

  /** In-progress: starts_at <= now <= ends_at — only toggle allowed */
  get isInShift() {
    if (!this.startsAt || !this.endsAt) return false
    const now = Date.now()
    return now >= new Date(this.startsAt).getTime() && now <= new Date(this.endsAt).getTime()
  }

  /** Ended: ends_at < now — fully read-only, toggle blocked too */
  get isEnded() {
    if (!this.endsAt) return false
    return Date.now() > new Date(this.endsAt).getTime()
  }

  /** Can this window be structurally edited (starts_at, ends_at, delete, merge)? Only if future. */
  get canEdit() { return this.isFuture }

  /** Can starts_at be changed? Only if not yet started */
  get canEditStart() { return this.isFuture }

  /** Can toggle is_active? Allowed on future and in-progress, NOT on ended */
  get canToggle() { return !this.isEnded }

  get timeRange() {
    const fmt = (t) => {
      if (!t) return '?'
      const [h, m] = t.split(':')
      return `${parseInt(h, 10)}:${m}`
    }
    return `${fmt(this.startTime)} – ${fmt(this.endTime)}`
  }

  toJSON() { return this._toRaw() }

  /**
   * Sella la instancia con la marca CRDT (Last-Write-Wins) de cambio local
   * reciente. El merge con datos del backend preserva las ventanas selladas
   * dentro de la ventana de tiempo reciente, evitando que un fetch en background
   * (aún stale) pise una ventana recién movida/redimensionada → sin "saltos".
   */
  withLocalUpdate() {
    this._localUpdatedAt = new Date().toISOString()
    return this
  }

  _toRaw() {
    return {
      id: this.id,
      specialist_id: this.specialistId,
      application_id: this.applicationId,
      starts_at: this.startsAt,
      ends_at: this.endsAt,
      inherits_on_reopen: this.inheritsOnReopen,
      is_active: this.isActive,
      created_at: this.createdAt,
      deactivated_at: this.deactivatedAt,
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
    // Parse and clamp the time — handle overflow past 24:00 by rolling to next day
    const [rawH, rawM] = time.split(':').map(Number)
    if (isNaN(rawH) || isNaN(rawM)) return null
    const totalMins = rawH * 60 + rawM
    const clampedMins = Math.max(0, Math.min(totalMins, 1440)) // cap at 24:00
    const h = Math.floor(clampedMins / 60)
    const m = clampedMins % 60

    let finalDate = date
    let finalTime
    if (h >= 24) {
      // Roll to midnight of the next day
      const nextDay = new Date(`${date}T00:00:00`)
      nextDay.setDate(nextDay.getDate() + 1)
      finalDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
      finalTime = '00:00:00'
    } else {
      finalTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    }

    const d = new Date(`${finalDate}T${finalTime}`)
    if (isNaN(d.getTime())) return null
    const offset = -d.getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const oh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const om = String(Math.abs(offset) % 60).padStart(2, '0')
    return `${finalDate}T${finalTime}${sign}${oh}:${om}`
  }
}
