export class ApiError extends Error {
  constructor(status, message, detail = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  static fromResponse(status, data) {
    const message = data?.detail || data?.message || 'Error inesperado del servidor.'
    return new ApiError(status, message, data?.detail)
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isNotFound() {
    return this.status === 404
  }

  get isConflict() {
    return this.status === 409
  }
}
