import { DomainError } from './DomainErrors'

export class WorkWindowError extends DomainError {
  constructor(message = 'Error en ventana de trabajo.') {
    super(message)
    this.name = 'WorkWindowError'
    this.userMessage = message
  }

  static fromHttp(err, fallback = 'Error en ventana de trabajo.') {
    const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback
    return new WorkWindowError(msg)
  }
}
