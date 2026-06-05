export const STATUS_LABELS = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export const STATUS_OPTIONS = ['open', 'assigned', 'in_progress', 'resolved', 'closed']

export const STATUS_TRANSITIONS = {
  open: ['closed'],
  assigned: ['in_progress', 'open', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['open'],
}

export const PRIORITY_LABELS = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const ORIGIN_LABELS = {
  outlook: 'Outlook',
  judit: 'Judit',
  tyflow: 'TyFlow',
}

const ORIGIN_ICONS = {
  outlook: 'bx-envelope',
  judit: 'bx-bot',
  tyflow: 'bx-edit',
}

export class Case {
  constructor(raw) {
    this.id = raw.id
    this.applicationId = raw.application_id
    this.origin = raw.origin ?? { type: null }
    this.originType = this.origin.type ?? null
    this.subject = raw.subject ?? ''
    this.description = raw.description ?? ''
    this.status = raw.status ?? 'open'
    this.priority = raw.priority ?? 'normal'
    this.conversationId = this.origin.conversation_id ?? null
    this.ticketId = this.origin.ticket_id ?? null
    this.externalId = this.origin.external_id ?? null
    this.specialistId = raw.specialist_id ?? null
    this.workWindowId = raw.work_window_id ?? null
    this.supportCategoryId = raw.support_category_id ?? null
    this.supportLevelId = raw.support_level_id ?? null
    this.createdAt = raw.created_at ?? null
    this.updatedAt = raw.updated_at ?? null
    this.assignedAt = raw.assigned_at ?? null
    this.resolvedAt = raw.resolved_at ?? null
    this.closedAt = raw.closed_at ?? null
  }

  get shortId() {
    return this.id ? '#' + this.id.slice(0, 6).toUpperCase() : ''
  }

  // --- Status ---
  get statusLabel() {
    return STATUS_LABELS[this.status] ?? this.status
  }

  get statusColor() {
    return `var(--status-${this.status.replace('_', '-')})`
  }

  get statusBg() {
    return `var(--status-${this.status.replace('_', '-')}-bg)`
  }

  // --- Priority ---
  get priorityLabel() {
    return PRIORITY_LABELS[this.priority] ?? this.priority
  }

  get priorityColor() {
    return `var(--priority-${this.priority})`
  }

  get priorityBg() {
    return `var(--priority-${this.priority}-bg)`
  }

  // --- Origin ---
  get originLabel() { return ORIGIN_LABELS[this.originType] ?? this.originType }
  get originIcon()  { return ORIGIN_ICONS[this.originType] ?? 'bx-help-circle' }
  get originColor() { return `var(--origin-${this.originType})` }
  get originBg()    { return `var(--origin-${this.originType}-bg)` }

  // --- Computed flags ---
  get isAssignable() {
    return this.status === 'open' && !!this.applicationId
  }

  get isReassignable() {
    return this.status === 'assigned' || this.status === 'in_progress'
  }

  _toRaw() {
    return {
      id: this.id,
      application_id: this.applicationId,
      origin: this.origin,
      subject: this.subject,
      description: this.description,
      status: this.status,
      priority: this.priority,
      specialist_id: this.specialistId,
      work_window_id: this.workWindowId,
      support_category_id: this.supportCategoryId,
      support_level_id: this.supportLevelId,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      assigned_at: this.assignedAt,
      resolved_at: this.resolvedAt,
      closed_at: this.closedAt,
    }
  }

  // --- Waiting time ---
  get waitingTime() {
    if (!this.createdAt) return null
    const diff = Date.now() - new Date(this.createdAt).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Ahora'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`
    const d = Math.floor(h / 24)
    return `${d}d ${h % 24}h`
  }
}
