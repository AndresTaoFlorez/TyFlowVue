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
  [/cannot delete a sealed work window/i, 'No se puede eliminar una ventana sellada.'],
  [/already open/i, 'Esta ventana ya tiene una sesión abierta.'],
  [/already closed|already deactivated/i, 'Esta ventana ya está cerrada.'],
  [/already deleted/i, 'Esta ventana ya fue eliminada.'],
  // Merge
  [/merge requires at least/i, 'Se necesitan al menos 2 ventanas para agrupar.'],
  [/has already ended.*cannot merge/i, 'No se pueden agrupar ventanas que ya finalizaron.'],
  [/has already ended/i, 'Una de las ventanas ya finalizó.'],
  [/not found.*deleted/i, 'Una o más ventanas no fueron encontradas o están eliminadas.'],
  // Seal en dos niveles — inicio congelado al arrancar; todo congelado al terminar
  [/Ended windows cannot be modified|is sealed \(ends_at/i, 'La ventana ya finalizó y no se puede modificar.'],
  [/Only ends_at can be adjusted/i, 'Con el turno iniciado solo se puede ajustar el fin de la ventana.'],
  [/ends_at must be in the future/i, 'El fin de la ventana no puede quedar en el pasado.'],
  [/is sealed/i, 'Esta ventana ya inició y no puede ser modificada.'],
  [/Cannot create a work window starting in the past/i, 'No se puede crear una ventana con inicio en el pasado.'],
  [/Cannot create a work window that has already ended/i, 'No se puede crear una ventana que ya finalizó.'],
  [/Cannot activate a work window that has already ended/i, 'No se puede activar una ventana que ya finalizó.'],
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
