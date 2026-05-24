export class User {
  constructor({
    id,
    first_name,
    second_name = null,
    first_surname,
    second_surname = null,
    id_document,
    created_at = null,
    is_active = true,
    email = null,
    last_sign_in_at = null,
    role_name = null,
    support_level_name = [],
  }) {
    this.id = id
    this.firstName = first_name
    this.secondName = second_name
    this.firstSurname = first_surname
    this.secondSurname = second_surname
    this.documentNumber = id_document
    this.createdAt = created_at
    this.isActive = is_active
    this.email = email
    this.lastSignInAt = last_sign_in_at
    this.roleName = role_name
    this.supportLevelName = support_level_name
  }

  get fullName() {
    const names = [this.firstName, this.secondName, this.firstSurname, this.secondSurname]
    return names.filter(Boolean).join(' ')
  }

  get statusLabel() {
    return this.isActive ? 'ACTIVO' : 'INACTIVO'
  }
}
