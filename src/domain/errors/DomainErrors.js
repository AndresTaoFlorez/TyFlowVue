export class DomainError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DomainError'
  }
}

export class AuthenticationError extends DomainError {
  constructor(message = 'Error de autenticacion.') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class UserNotFoundError extends DomainError {
  constructor(message = 'Usuario no encontrado.') {
    super(message)
    this.name = 'UserNotFoundError'
  }
}

export class UserInactiveError extends DomainError {
  constructor(message = 'Tu cuenta esta inactiva. Contacta al soporte.') {
    super(message)
    this.name = 'UserInactiveError'
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Error de validacion.') {
    super(message)
    this.name = 'ValidationError'
  }
}
