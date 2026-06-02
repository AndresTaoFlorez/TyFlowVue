import { Conversation } from './Conversation'

export class Case extends Conversation {
  constructor(raw) {
    super(raw)
    this.priority = raw.priority ?? this._inferPriority(raw.tags) ?? 'P3'
    this.status = raw.status ?? 'pending'
    this.assignment = raw.assignment ?? null
  }

  _inferPriority(tags) {
    if (!Array.isArray(tags)) return null
    const tag = tags.find(t => /^P[123]$/i.test(t))
    return tag?.toUpperCase() ?? null
  }

  get origin() {
    return this.externalId != null ? 'rpa' : 'tyflow'
  }

  get originLabel() {
    return this.origin === 'rpa' ? 'RPA' : 'TyFlow'
  }

  get originIcon() {
    return this.origin === 'rpa' ? 'bx-bot' : 'bx-wrench'
  }

  get originColor() {
    return this.origin === 'rpa' ? 'var(--origin-rpa)' : 'var(--origin-tyflow)'
  }

  get originBg() {
    return this.origin === 'rpa' ? 'var(--origin-rpa-bg)' : 'var(--origin-tyflow-bg)'
  }

  get priorityColor() {
    const map = { P1: 'var(--priority-p1)', P2: 'var(--priority-p2)', P3: 'var(--priority-p3)' }
    return map[this.priority] ?? map.P3
  }

  get priorityBg() {
    const map = { P1: 'var(--priority-p1-bg)', P2: 'var(--priority-p2-bg)', P3: 'var(--priority-p3-bg)' }
    return map[this.priority] ?? map.P3
  }

  get waitingTime() {
    const ref = this.receivedAt ?? this.extractedAt
    if (!ref) return null
    const diff = Date.now() - new Date(ref).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'Ahora'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`
  }

  get shortId() {
    return this.id ? '#' + this.id.slice(0, 6).toUpperCase() : ''
  }
}
