export class Application {
  constructor({ id, name, is_active = true, theme = null, created_at = null, createdAt = null, _localUpdatedAt = null }) {
    this.id = id
    this.name = name
    this.isActive = is_active
    this.theme = theme || { color: null }
    this.createdAt = created_at || createdAt
    this._localUpdatedAt = _localUpdatedAt || null
  }

  get color() {
    return this.theme?.color || null
  }

  withLocalUpdate() {
    const copy = new Application(this)
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
