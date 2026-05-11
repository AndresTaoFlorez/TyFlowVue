export class DomainError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DomainError'
  }
}

export class UserInactiveError extends DomainError {
  constructor(message = 'Tu cuenta esta inactiva. Contacta al soporte.') {
    super(message)
    this.name = 'UserInactiveError'
  }
}
