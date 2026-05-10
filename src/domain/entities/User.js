export class User {
  constructor({
    id,
    first_name,
    second_name = null,
    first_surname,
    second_surname = null,
    document_number,
    created_at = null,
    is_active = true,
    email = null,
    last_sign_in_at = null,
    role_name = null,
    area_name = null,
  }) {
    this.id = id
    this.firstName = first_name
    this.secondName = second_name
    this.firstSurname = first_surname
    this.secondSurname = second_surname
    this.documentNumber = document_number
    this.createdAt = created_at
    this.isActive = is_active
    this.email = email
    this.lastSignInAt = last_sign_in_at
    this.roleName = role_name
    this.areaName = area_name
  }

  get fullName() {
    return `${this.firstName} ${this.firstSurname}`
  }

  get statusLabel() {
    return this.isActive ? 'ACTIVO' : 'INACTIVO'
  }
}
