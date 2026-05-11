export class Area {
  constructor({ id, name, display_name, description = null, created_at = null }) {
    this.id = id
    this.name = name
    this.displayName = display_name
    this.description = description
    this.createdAt = created_at
  }
}
