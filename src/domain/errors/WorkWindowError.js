import { DomainError } from './DomainErrors'

const ERROR_MAP = [
  [/no previous window found/i, 'No se encontró una ventana anterior para heredar. Verifique que el especialista y la aplicación tengan una ventana cerrada previamente.'],
  [/inherits_on_reopen.*but/i, 'No se encontró una ventana anterior para heredar. Verifique que el especialista y la aplicación tengan una ventana cerrada previamente.'],
  [/before.*inherit|inherit.*before|precede.*inherit|inherit.*precede/i, 'No se puede mover antes de la ventana de la que hereda.'],
  [/inherited.*future|future.*inherited|after.*parent|parent.*after/i, 'No se puede mover antes de la ventana de la que hereda.'],
  [/cannot.*reschedule.*inherit|inherit.*reschedule/i, 'No se puede mover una ventana que hereda a un horario anterior a su ventana origen.'],
  [/already open/i, 'Esta ventana ya tiene una sesión abierta.'],
  [/already closed/i, 'Esta ventana ya está cerrada.'],
  [/overlap/i, 'El horario se superpone con otra ventana existente.'],
  [/not found/i, 'Ventana de trabajo no encontrada.'],
  [/unauthorized|forbidden/i, 'No tienes permisos para esta acción.'],
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
