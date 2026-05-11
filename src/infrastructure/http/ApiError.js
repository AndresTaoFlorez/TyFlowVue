/**
 * Error base para todas las respuestas HTTP fallidas del backend.
 *
 * Responsabilidades:
 * - Mapear status HTTP a códigos de error semánticos
 * - Proveer mensajes en español para el usuario
 * - Preservar el detalle técnico para debugging
 * - Detectar errores de red (sin conexión, timeout)
 */

const STATUS_MESSAGES = {
  400: 'La solicitud contiene datos inválidos.',
  401: 'Tu sesión ha expirado. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no fue encontrado.',
  409: 'Ya existe un registro con esos datos.',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  500: 'Error interno del servidor. Intenta más tarde.',
  502: 'El servidor no está disponible. Intenta más tarde.',
  503: 'Servicio temporalmente no disponible. Intenta más tarde.',
}

export class ApiError extends Error {
  constructor({ status, message, code, detail, fields }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code || null
    this.detail = detail || null
    this.fields = fields || null
  }

  /**
   * Crea un ApiError a partir de la respuesta HTTP del backend.
   * Maneja múltiples formatos de respuesta del servidor.
   */
  static fromResponse(status, data) {
    const detail = data?.detail
    let message
    let code = data?.code || null
    let fields = null

    // El backend puede enviar detail como string o como array de validaciones
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      // Formato de errores de validación (e.g., Pydantic/Litestar)
      fields = detail.reduce((acc, err) => {
        const field = err.loc?.slice(-1)[0] || 'general'
        acc[field] = err.msg || err.message || 'Campo inválido.'
        return acc
      }, {})
      message = 'Los datos enviados contienen errores.'
      code = code || 'VALIDATION_ERROR'
    } else if (typeof detail === 'object' && detail !== null) {
      message = detail.message || detail.error || STATUS_MESSAGES[status]
      code = detail.code || code
    } else {
      message = data?.message || data?.error || STATUS_MESSAGES[status] || 'Error inesperado del servidor.'
    }

    return new ApiError({ status, message, code, detail, fields })
  }

  /**
   * Crea un ApiError para errores de red (sin conexión, timeout, DNS).
   */
  static networkError(originalError) {
    const isTimeout = originalError?.code === 'ECONNABORTED'
    return new ApiError({
      status: 0,
      message: isTimeout
        ? 'La solicitud tardó demasiado. Verifica tu conexión.'
        : 'No se pudo conectar con el servidor. Revisa tu conexión a internet.',
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      detail: originalError?.message || null,
      fields: null,
    })
  }

  // --- Helpers semánticos ---

  get isNetworkError() { return this.status === 0 }
  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
  get isConflict() { return this.status === 409 }
  get isValidation() { return this.status === 422 || this.code === 'VALIDATION_ERROR' }
  get isServerError() { return this.status >= 500 }
  get isRateLimit() { return this.status === 429 }

  /**
   * Retorna true si el error tiene campos específicos con errores
   * (útil para mostrar errores inline en formularios).
   */
  get hasFieldErrors() {
    return this.fields !== null && Object.keys(this.fields).length > 0
  }

  /**
   * Mensaje amigable para mostrar al usuario.
   * Prioriza: message del backend > fallback por status.
   */
  get userMessage() {
    return this.message || STATUS_MESSAGES[this.status] || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  }
}
