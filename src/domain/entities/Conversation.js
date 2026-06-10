export class Conversation {
  constructor({
    id,
    folder_id,
    subject = '',
    body = '',
    from_address = '',
    to_address = '',
    extracted_at = null,
    external_id = null,
    tags = null,
    received_at = null,
    duplicate_of = null,
    _localUpdatedAt = null,
  }) {
    this.id = id
    this.folderId = folder_id
    this.subject = subject
    this.body = body
    this.fromAddress = from_address
    this.toAddress = to_address
    this.extractedAt = extracted_at
    this.externalId = external_id
    this.tags = tags
    this.receivedAt = received_at
    this.duplicateOf = duplicate_of
    this._localUpdatedAt = _localUpdatedAt
  }

  get isDuplicate() {
    return this.duplicateOf != null
  }

  get shortSubject() {
    if (!this.subject) return '(Sin asunto)'
    return this.subject.length > 80 ? this.subject.slice(0, 80) + '...' : this.subject
  }

  toJSON() { return this._toRaw() }

  _toRaw() {
    return {
      id: this.id,
      folder_id: this.folderId,
      subject: this.subject,
      body: this.body,
      from_address: this.fromAddress,
      to_address: this.toAddress,
      extracted_at: this.extractedAt,
      external_id: this.externalId,
      tags: this.tags,
      received_at: this.receivedAt,
      duplicate_of: this.duplicateOf,
      _localUpdatedAt: this._localUpdatedAt,
    }
  }

  withLocalUpdate() {
    const copy = new Conversation(this._toRaw())
    copy._localUpdatedAt = new Date().toISOString()
    return copy
  }
}
