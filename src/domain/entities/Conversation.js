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
  }

  get isDuplicate() {
    return this.duplicateOf != null
  }

  get shortSubject() {
    if (!this.subject) return '(Sin asunto)'
    return this.subject.length > 80 ? this.subject.slice(0, 80) + '...' : this.subject
  }
}
