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
    // New nested structure from API
    specialist_profile = null,
    // Legacy flat fields (for cached data / withLocalUpdate round-trip)
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

    // Prefer specialist_profile (new API), fall back to flat fields (cached data)
    const sp = specialist_profile
    this.specialistId = sp?.specialist_id ?? specialist_id ?? null
    this.specialistIsActive = sp?.specialist_is_active ?? specialist_is_active ?? null

    const rawAssignments = sp?.application_assignments
      ?? (Array.isArray(application_assignments) ? application_assignments : [])

    // Normalize assignments into FLAT (application, support_level) rows so
    // downstream code can read flat fields (support_level_id / support_level_name)
    // and the whitelisted categories travel with the user — no separate fetch.
    //
    // Two input shapes are handled:
    //  - New API (2026-06-12): each application carries `support_levels[]`, and a
    //    specialist may attend MULTIPLE levels per app. Each level lists the
    //    `categories[]` the specialist is whitelisted for, with `affinity_weight`.
    //    A category present in the tree is attended → flagged `is_assigned: true`.
    //    There is no `is_assigned: false` / exclusion entry anymore.
    //  - Legacy / cached shape: flat `support_level` + `support_categories` (kept
    //    so the withLocalUpdate round-trip and old caches still hydrate).
    const flat = []
    for (const a of rawAssignments) {
      if (Array.isArray(a.support_levels)) {
        for (const lvl of a.support_levels) {
          flat.push({
            application_id: a.application_id,
            application_name: a.application_name ?? null,
            application_theme: a.application_theme ?? null,
            support_level_id: lvl.support_level_id ?? null,
            support_level_name: lvl.support_level_name ?? null,
            support_level_description: lvl.support_level_description ?? null,
            support_categories: (Array.isArray(lvl.categories) ? lvl.categories : []).map(c => ({
              ...c,
              id: c.id,
              name: c.name ?? null,
              description: c.description ?? null,
              affinity_weight: c.affinity_weight ?? 1.0,
              is_assigned: true, // whitelist: present === attended
            })),
          })
        }
      } else {
        const lvl = a.support_level || {}
        flat.push({
          ...a,
          application_id: a.application_id,
          application_name: a.application_name ?? null,
          application_theme: a.application_theme ?? null,
          support_level_id: a.support_level_id ?? lvl.support_levels_id ?? null,
          support_level_name: a.support_level_name ?? lvl.support_level_name ?? null,
          support_categories: Array.isArray(a.support_categories) ? a.support_categories : [],
        })
      }
    }
    this.applicationAssignments = flat

    // Derive supportLevelNames from assignments (replaces the old flat array)
    if (sp) {
      const names = [...new Set(
        this.applicationAssignments.map(a => a.support_level_name).filter(Boolean)
      )]
      this.supportLevelNames = names
    } else {
      this.supportLevelNames = Array.isArray(support_level_names) ? support_level_names : []
    }

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

  toJSON() { return this._toRaw() }

  _toRaw() {
    return {
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
      _localUpdatedAt: this._localUpdatedAt,
    }
  }

  withLocalUpdate() {
    const copy = new User(this._toRaw())
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
