export class Folder {
  constructor({
    id,
    application_id,
    type,
    name,
    is_active = true,
    created_at = null,
    parent_folder_id = null,
    specialist_id = null,
    support_level_id = null,
    external_id = null,
    parent = null,
    children = null,
  }) {
    this.id = id
    this.applicationId = application_id
    this.type = type
    this.name = name
    this.isActive = is_active
    this.createdAt = created_at
    this.parentFolderId = parent_folder_id
    this.specialistId = specialist_id
    this.supportLevelId = support_level_id
    this.externalId = external_id
    this.parent = parent
    this.children = children
  }

  get typeLabel() {
    const labels = { main_box: 'Bandeja', level: 'Nivel', specialist: 'Especialista' }
    return labels[this.type] || this.type
  }

  get typeIcon() {
    const icons = { main_box: 'bx-inbox', level: 'bx-layer', specialist: 'bx-user' }
    return icons[this.type] || 'bx-folder'
  }
}
