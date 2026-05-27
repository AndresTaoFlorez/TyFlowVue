export class Assignment {
  constructor({
    id,
    conversation_id,
    specialist_id,
    ticket_id = null,
    work_window_id = null,
    assignment_reason = null,
    is_active = true,
    created_at = null,
  }) {
    this.id = id
    this.conversationId = conversation_id
    this.specialistId = specialist_id
    this.ticketId = ticket_id
    this.workWindowId = work_window_id
    this.assignmentReason = assignment_reason
    this.isActive = is_active
    this.createdAt = created_at
  }

  get reasonLabel() {
    const labels = {
      wdd_algorithm: 'WDD (auto)',
      new_case: 'Caso nuevo',
      reassignment_same_level: 'Reasignacion',
      escalation: 'Escalacion',
      support_escalation: 'Escalacion de soporte',
    }
    return labels[this.assignmentReason] || this.assignmentReason || 'Desconocido'
  }
}
