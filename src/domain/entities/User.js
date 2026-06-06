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
    full_name = null,
    role_names = [],
    specialist_id = null,
    specialist_is_active = null,
    support_level_names = [],
    application_assignments = [],
    preferences = null,
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
    this.roleNames = Array.isArray(role_names) ? role_names : []
    this.specialistId = specialist_id
    this.specialistIsActive = specialist_is_active
    this.supportLevelNames = Array.isArray(support_level_names) ? support_level_names : []
    this.applicationAssignments = Array.isArray(application_assignments) ? application_assignments : []
    this.preferences = preferences
    this._fullName = full_name
    this._localUpdatedAt = null
  }

  get fullName() {
    if (this._fullName) return this._fullName
    const names = [this.firstName, this.secondName, this.firstSurname, this.secondSurname]
    return names.filter(Boolean).join(' ')
  }

  get statusLabel() {
    return this.isActive ? 'ACTIVO' : 'INACTIVO'
  }

  withLocalUpdate() {
    const copy = new User({
      id: this.id,
      first_name: this.firstName,
      second_name: this.secondName,
      first_surname: this.firstSurname,
      second_surname: this.secondSurname,
      id_document: this.documentNumber,
      created_at: this.createdAt,
      is_active: this.isActive,
      email: this.email,
      last_sign_in_at: this.lastSignInAt,
      full_name: this._fullName,
      role_names: this.roleNames,
      specialist_id: this.specialistId,
      specialist_is_active: this.specialistIsActive,
      support_level_names: this.supportLevelNames,
      application_assignments: this.applicationAssignments,
      preferences: this.preferences,
    })
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
