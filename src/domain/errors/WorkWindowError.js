import { DomainError } from './DomainErrors'

const ERROR_MAP = [
  // Inheritance — activation
  [/no previous window found.*specialist.*application/i, 'No existe una ventana anterior del mismo especialista y aplicación para heredar.'],
  [/no previous window found/i, 'No se encontró una ventana anterior para heredar.'],
  [/Cannot enable inherits_on_reopen/i, 'No se encontró una ventana anterior para heredar.'],
  [/inherits_on_reopen.*but/i, 'No se encontró una ventana anterior para heredar.'],
  [/Cannot activate inheritance.*already started/i, 'No se puede activar herencia en una ventana que ya inició.'],
  // Inheritance — disinherit
  [/Cannot disinherit.*already started/i, 'No se puede quitar la herencia de una ventana que ya inició.'],
  [/does not inherit.*nothing to disinherit/i, 'Esta ventana no tiene herencia activa.'],
  // Inheritance — movement constraints
  [/Cannot move window before its source/i, 'No se puede mover la ventana antes de la ventana de la que hereda.'],
  [/Cannot extend window past its child/i, 'No se puede extender la ventana más allá de la ventana que hereda de ella.'],
  [/before.*inherit|inherit.*before|precede.*inherit|inherit.*precede/i, 'No se puede mover antes de la ventana de la que hereda.'],
  [/inherited.*future|future.*inherited|after.*parent|parent.*after/i, 'No se puede mover antes de la ventana de la que hereda.'],
  [/cannot.*reschedule.*inherit|inherit.*reschedule/i, 'No se puede mover una ventana que hereda a un horario anterior a su ventana origen.'],
  // Schedule
  [/Cannot change starts_at.*in shift/i, 'No se puede cambiar la hora de inicio durante el turno. Solo la hora de fin puede modificarse.'],
  [/overlap/i, 'El horario se superpone con otra ventana existente del mismo especialista y aplicación.'],
  // Status
  [/already open/i, 'Esta ventana ya tiene una sesión abierta.'],
  [/already closed|already deactivated/i, 'Esta ventana ya está cerrada.'],
  [/already deleted/i, 'Esta ventana ya fue eliminada.'],
  // General
  [/not found/i, 'Ventana de trabajo no encontrada.'],
  [/unauthorized|forbidden|row-level security/i, 'No tienes permisos para esta acción.'],
  [/constraint violation/i, 'Restricción de datos no cumplida.'],
  [/conflict/i, 'Conflicto con una ventana existente.'],
]

export class WorkWindowError extends DomainError {
  constructor(message = 'Error en ventana de trabajo.') {
    super(message)
    this.name = 'WorkWindowError'
    this.userMessage = message
  }

  static fromHttp(err, fallback = 'Error en ventana de trabajo.') {
    const raw = err?.response?.data?.detail || err?.response?.data?.message || err?.message || ''
    const mapped = ERROR_MAP.find(([pattern]) => pattern.test(raw))
    const msg = mapped ? mapped[1] : (raw || fallback)
    return new WorkWindowError(msg)
  }
}
