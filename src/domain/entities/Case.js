const STATUS_LABELS = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En progreso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

const PRIORITY_LABELS = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const SOURCE_LABELS = {
  outlook: 'Outlook',
  judit: 'Judit',
  manual: 'Manual',
}

const SOURCE_ICONS = {
  outlook: 'bx-envelope',
  judit: 'bx-bot',
  manual: 'bx-edit',
}

export class Case {
  constructor(raw) {
    this.id = raw.id
    this.applicationId = raw.application_id
    this.source = raw.source
    this.subject = raw.subject ?? ''
    this.description = raw.description ?? ''
    this.status = raw.status ?? 'open'
    this.priority = raw.priority ?? 'normal'
    this.conversationId = raw.conversation_id ?? null
    this.ticketId = raw.ticket_id ?? null
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

  // --- Source ---
  get sourceLabel() {
    return SOURCE_LABELS[this.source] ?? this.source
  }

  get sourceIcon() {
    return SOURCE_ICONS[this.source] ?? 'bx-help-circle'
  }

  get sourceColor() {
    return `var(--source-${this.source})`
  }

  get sourceBg() {
    return `var(--source-${this.source}-bg)`
  }

  // --- Computed flags ---
  get isAssignable() {
    return this.status === 'open'
  }

  get isReassignable() {
    return this.status === 'assigned' || this.status === 'in_progress'
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
