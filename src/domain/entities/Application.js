export class Application {
  constructor({ id, name, theme = null, created_at = null }) {
    this.id = id
    this.name = name
    this.theme = theme || { color: null }
    this.createdAt = created_at
  }

  get color() {
    return this.theme?.color || null
  }
}
