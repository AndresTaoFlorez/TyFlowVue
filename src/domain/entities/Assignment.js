export class Assignment {
  constructor({
    id,
    assignment_id,
    case_id,
    specialist_id,
    work_window_id = null,
    assignment_reason = null,
    assigned_at = null,
    unassigned_at = null,
    assigned_by = null,
    case_subject = null,
    specialist_name = null,
  }) {
    this.id = id ?? assignment_id
    this.caseId = case_id
    this.specialistId = specialist_id
    this.workWindowId = work_window_id
    this.assignmentReason = assignment_reason
    this.assignedAt = assigned_at
    this.unassignedAt = unassigned_at
    this.assignedBy = assigned_by
    this.caseSubject = case_subject
    this.specialistName = specialist_name
  }

  get isActive() {
    return this.unassignedAt == null
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
