<script setup>
const props = defineProps({
  specialist: { type: Object, required: true },
  windows: { type: Array, required: true },
  applications: { type: Array, default: () => [] },
  allWindows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  cutWindowIds: { type: Object, default: () => new Set() },
})

const emit = defineEmits(['show-all', 'select', 'toggle-all', 'delete-all', 'context-menu'])

const findApp = (id) => props.applications.find(a => a.id === id)
const appName = (id) => findApp(id)?.name || id
const appColor = (id) => { const a = findApp(id); return a?.color || a?.theme?.color || '#2AC78F' }

const specName = (w) => {
  const parent = props.allWindows.find(p => p.id === w.inheritedFromWindowId)
  if (!parent) return ''
  const dayNum = parent.scheduledDate ? parseInt(parent.scheduledDate.split('-')[2], 10) : ''
  return `← ${parent.specialistId} · ${dayNum} ${parent.timeRange}`
}

// ---- Computed aggregates ----
const appIds = () => [...new Set(props.windows.map(w => w.applicationId))]
const activeN = () => props.windows.filter(w => w.isActive).length
const opening = () => props.windows.reduce((n, w) => n + (w.openingCount ?? 0), 0)
const current = () => props.windows.reduce((n, w) => n + (w.currentCount ?? 0), 0)

const status = () => {
  const a = activeN()
  if (a === props.windows.length) return 'active'
  if (a === 0) return 'inactive'
  return 'mixed'
}

const statusLabel = () => {
  const s = status()
  const a = activeN()
  if (s === 'active') return `${a} activas`
  if (s === 'inactive') return 'Inactivas'
  return `${a}/${props.windows.length} activas`
}

const hasInheritance = () => props.windows.some(w => w.inheritedFromWindowId || w.inheritsOnReopen)
const accentColor = () => status() === 'inactive' ? 'var(--inactive-bar)' : appColor(appIds()[0])

// ---- Grouped schedules ----
const fmtT = (t) => {
  if (!t) return '?'
  const [h, m] = t.split(':')
  return `${parseInt(h, 10)}:${m}`
}

const schedules = () => {
  const all = props.windows
  const groups = []
  const used = new Set()

  // Pass 1: shared startTime, 2+ windows
  const byStart = new Map()
  for (const w of all) {
    if (!byStart.has(w.startTime)) byStart.set(w.startTime, [])
    byStart.get(w.startTime).push(w)
  }
  for (const [st, ws] of byStart) {
    if (ws.length >= 2) {
      ws.forEach(w => used.add(w.id))
      const ends = [...new Set(ws.map(w => w.endTime))].sort()
      const endLabel = ends.length === 1 ? fmtT(ends[0]) : ends.map(fmtT).join(', ')
      groups.push({
        label: `${fmtT(st)} – ${endLabel}`,
        startHour: ws[0].startHour,
        windows: ws,
      })
    }
  }

  // Pass 2: shared endTime among remaining, 2+ windows
  const rem = all.filter(w => !used.has(w.id))
  const byEnd = new Map()
  for (const w of rem) {
    if (!byEnd.has(w.endTime)) byEnd.set(w.endTime, [])
    byEnd.get(w.endTime).push(w)
  }
  for (const [et, ws] of byEnd) {
    if (ws.length >= 2) {
      ws.forEach(w => used.add(w.id))
      const starts = [...new Set(ws.map(w => w.startTime))].sort()
      groups.push({
        label: `${starts.map(fmtT).join(', ')} – ${fmtT(et)}`,
        startHour: Math.min(...ws.map(w => w.startHour ?? 0)),
        windows: ws,
      })
    }
  }

  // Pass 4: singletons
  for (const w of all) {
    if (!used.has(w.id)) {
      groups.push({ label: w.timeRange, startHour: w.startHour, windows: [w] })
    }
  }

  return groups.sort((a, b) => (a.startHour ?? 0) - (b.startHour ?? 0))
}

// App has at least one active window?
const isAppActive = (appId) => props.windows.some(w => w.applicationId === appId && w.isActive)

// Single window → open modal directly
const onShowAll = () => {
  if (props.windows.length === 1) {
    emit('select', props.windows[0])
  } else {
    emit('show-all')
  }
}
</script>

<template>
  <div
    class="spcard"
    :class="{ 'spcard--mixed': status() === 'mixed', 'spcard--inactive': status() === 'inactive' }"
    :style="{ '--accent': accentColor() }"
  >
    <div class="spcard__main">
      <!-- Row 1: name + counters -->
      <div class="spcard__row1">
        <div class="spcard__id">
          <div class="spcard__name">
            <i v-if="hasInheritance()" class="bx bx-link spcard__inh"></i>
            {{ specialist.fullName }}
          </div>
          <div class="spcard__sub">
            <span><b>{{ windows.length }}</b> {{ windows.length === 1 ? 'ventana' : 'ventanas' }}</span>
            <span class="spcard__dot-sep"></span>
            <span><b>{{ appIds().length }}</b> {{ appIds().length === 1 ? 'aplicativo' : 'aplicativos' }}</span>
            <span class="spcard__dot-sep"></span>
            <span class="spcard__status-pill" :class="'spcard__status-pill--' + status()">
              {{ statusLabel() }}
            </span>
          </div>
        </div>
        <div class="spcard__counters">
          <span class="spcard__ctr spcard__ctr--open" title="Apertura (suma)">
            <i class="bx bx-log-in-circle"></i>{{ opening() }}
          </span>
          <span class="spcard__ctr spcard__ctr--current" title="Actual (suma)">
            <i class="bx bx-radio-circle-marked"></i>{{ current() }}
          </span>
        </div>
      </div>

      <!-- App chips -->
      <div class="spcard__chips">
        <span
          v-for="id in appIds()"
          :key="id"
          class="spcard__chip"
          :class="{ 'spcard__chip--off': !isAppActive(id) }"
          :style="{ '--chip': appColor(id) }"
        >
          <span class="spcard__chip-dot"></span>{{ appName(id) }}
        </span>
      </div>

      <!-- Grouped schedules -->
      <div class="spcard__scheds">
        <div v-for="s in schedules()" :key="s.label" class="spcard__sched">
          <i class="bx bx-time-five spcard__sched-icon"></i>
          <span class="spcard__sched-time">{{ s.label }}</span>
          <span class="spcard__sched-apps">
            <span
              v-for="w in s.windows"
              :key="w.id"
              class="spcard__sched-dot"
              :class="{ 'spcard__sched-dot--off': !w.isActive }"
              :style="{ background: appColor(w.applicationId) }"
              :title="appName(w.applicationId)"
            ></span>
          </span>
          <span v-if="s.windows.length > 1" class="spcard__sched-n">{{ s.windows.length }} ventanas</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="spcard__foot">
      <button v-if="windows.length > 1" class="spcard__show-all" @click="onShowAll">
        Mostrar todas <i class="bx bx-play"></i>
      </button>
      <button v-else class="spcard__show-all" @click="onShowAll">
        Ver detalle <i class="bx bx-expand-alt" style="font-size:0.9rem"></i>
      </button>
      <div class="spcard__foot-spacer"></div>
      <button
        class="spcard__act spcard__act--toggle"
        title="Inhabilitar todas"
        :disabled="loading"
        @click="$emit('toggle-all')"
      >
        <i class="bx bx-block"></i>
      </button>
      <button
        class="spcard__act spcard__act--danger"
        title="Eliminar ventanas"
        :disabled="loading"
        @click="$emit('delete-all')"
      >
        <i class="bx bx-trash"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.spcard {
  position: relative;
  border: 1px solid var(--border-light);
  border-left: 4px solid var(--accent, var(--primary-500));
  border-radius: var(--radius-lg);
  margin-bottom: 0.55rem;
  background: var(--bg-main);
  transition: box-shadow 0.14s, border-color 0.14s;
}
.spcard:hover { box-shadow: 0 4px 16px rgba(20, 30, 55, 0.10); }
.spcard--mixed { border-left-style: dashed; }
.spcard--inactive { opacity: 0.62; }
.spcard--inactive .spcard__name { text-decoration: line-through; color: var(--text-secondary); }

.spcard__main { padding: 0.7rem 0.8rem 0.65rem; }
.spcard__row1 { display: flex; align-items: flex-start; gap: 0.5rem; }
.spcard__id { min-width: 0; flex: 1; }
.spcard__name {
  font-size: 0.9rem; font-weight: 600; color: var(--text-primary);
  display: flex; align-items: center; gap: 0.3rem; line-height: 1.2;
}
.spcard__inh { font-size: 0.85rem; opacity: 0.5; }
.spcard__sub {
  font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
}
.spcard__sub b { font-weight: 700; color: var(--text-primary); }
.spcard__dot-sep {
  width: 3px; height: 3px; border-radius: 50%;
  background: var(--text-secondary); flex-shrink: 0; opacity: 0.5;
}

/* Counters */
.spcard__counters { display: flex; gap: 0.3rem; flex-shrink: 0; }
.spcard__ctr {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.66rem; font-weight: 700; padding: 0.12rem 0.4rem;
  border-radius: 5px; line-height: 1.4; white-space: nowrap;
}
.spcard__ctr i { font-size: 0.82rem; }
.spcard__ctr--open { background: rgba(42, 199, 143, 0.14); color: var(--primary-600); }
.spcard__ctr--current { background: rgba(99, 102, 241, 0.14); color: #6366f1; }

/* Status pill */
.spcard__status-pill {
  font-size: 0.6rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 4px;
}
.spcard__status-pill--active { color: var(--primary-600); background: rgba(42, 199, 143, 0.12); }
.spcard__status-pill--mixed { color: #b45309; background: rgba(245, 158, 11, 0.14); }
.spcard__status-pill--inactive { color: var(--error-500); background: rgba(239, 68, 68, 0.1); }

/* App chips */
.spcard__chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.55rem; }
.spcard__chip {
  display: inline-flex; align-items: center; gap: 0.28rem;
  font-size: 0.68rem; font-weight: 600;
  padding: 0.16rem 0.5rem 0.16rem 0.4rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--chip) 14%, transparent);
  color: color-mix(in srgb, var(--chip) 72%, var(--text-primary));
  border: 1px solid color-mix(in srgb, var(--chip) 28%, transparent);
}
.spcard__chip-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--chip); flex-shrink: 0;
}
.spcard__chip--off { opacity: 0.5; text-decoration: line-through; }

/* Grouped schedules */
.spcard__scheds { margin-top: 0.55rem; display: flex; flex-direction: column; gap: 0.28rem; }
.spcard__sched { display: flex; align-items: center; gap: 0.45rem; font-size: 0.74rem; }
.spcard__sched-icon { font-size: 0.9rem; color: var(--text-secondary); flex-shrink: 0; }
.spcard__sched-time { font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.spcard__sched-apps { display: flex; align-items: center; gap: 0.22rem; }
.spcard__sched-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.spcard__sched-dot--off { opacity: 0.32; }
.spcard__sched-n {
  margin-left: auto; font-size: 0.6rem; font-weight: 700;
  color: var(--text-secondary); background: var(--bg-card);
  border: 1px solid var(--border-light);
  padding: 0.05rem 0.4rem; border-radius: var(--radius-full);
}

/* Footer */
.spcard__foot {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.8rem; border-top: 1px solid var(--border-light);
}
.spcard__show-all {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.76rem; font-weight: 700; color: var(--primary-600);
  background: none; border: none; padding: 0.2rem 0.1rem; cursor: pointer;
}
.spcard__show-all i { font-size: 1rem; transition: transform 0.15s; }
.spcard__show-all:hover i { transform: translateX(2px); }
.spcard__foot-spacer { flex: 1; }
.spcard__act {
  width: 1.9rem; height: 1.9rem;
  border: 1px solid var(--border-light); background: var(--bg-main);
  color: var(--text-secondary); border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.95rem; cursor: pointer; transition: all 0.12s;
}
.spcard__act:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-secondary); }
.spcard__act--danger:hover:not(:disabled) { color: var(--error-500); border-color: var(--error-500); background: rgba(239, 68, 68, 0.06); }
.spcard__act--toggle:hover:not(:disabled) { color: var(--primary-500); border-color: var(--primary-500); }
.spcard__act:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
