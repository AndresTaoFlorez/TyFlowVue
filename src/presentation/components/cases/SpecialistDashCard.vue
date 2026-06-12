<script setup>
import { ref, computed } from 'vue'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'

// Card modular del dashboard de Especialistas. Cada card es "un mundo":
// puede alternar entre visualizaciones de la carga del especialista.
//  - resumen:   contador de activos + asignados hoy
//  - actividad: mini gráfica de barras (asignaciones activas por día, 7 días)
//  - turnos:    ventanas vigentes por aplicación
const props = defineProps({
  specialist: { type: Object, required: true },
  // { specialist_id, full_name, is_available, activeCount, todayCount,
  //   windows: [{ appId, appName, startsAt, endsAt }], assignments: [Assignment] }
  preferences: { type: [Object, null], default: null },
})

const emit = defineEmits(['expand', 'open-case'])

const VIEWS = [
  { id: 'resumen',   icon: 'bx-hash',           title: 'Resumen' },
  { id: 'actividad', icon: 'bx-bar-chart-alt-2', title: 'Actividad (7 días)' },
  { id: 'turnos',    icon: 'bx-time-five',       title: 'Turnos vigentes' },
]

const view = ref('resumen')

function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 50%, 42%)`
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// ── Actividad: asignaciones activas por día (últimos 7) ──
const activityBars = computed(() => {
  const days = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('es-CO', { weekday: 'narrow' }),
      count: 0,
    })
  }
  const byKey = new Map(days.map(d => [d.key, d]))
  for (const a of props.specialist.assignments ?? []) {
    if (!a.assignedAt) continue
    const key = new Date(a.assignedAt).toISOString().slice(0, 10)
    const slot = byKey.get(key)
    if (slot) slot.count++
  }
  const max = Math.max(1, ...days.map(d => d.count))
  return days.map(d => ({ ...d, pct: Math.round((d.count / max) * 100) }))
})

const intensity = computed(() => {
  const n = props.specialist.activeCount ?? 0
  if (n === 0) return { label: 'Libre',  color: 'var(--text-secondary)' }
  if (n <= 3)  return { label: 'Fluida', color: 'var(--load-low, #16A34A)' }
  if (n <= 7)  return { label: 'Media',  color: 'var(--load-mid, #D97706)' }
  return { label: 'Alta', color: 'var(--load-high, #DC2626)' }
})
</script>

<template>
  <div class="sdc" :class="{ 'sdc--off': !specialist.is_available }">
    <!-- Head -->
    <div class="sdc__head">
      <UserAvatar
        :preferences="preferences"
        :name="specialist.full_name"
        :bg-color="hslColor(specialist.full_name)"
        size="44px"
        class="sdc__avatar"
      />
      <div class="sdc__info">
        <div class="sdc__name">{{ specialist.full_name }}</div>
        <span :class="['sdc__turno', specialist.is_available ? 'sdc__turno--on' : 'sdc__turno--off']">
          <i :class="['bx', specialist.is_available ? 'bxs-circle' : 'bx-block']"></i>
          {{ specialist.is_available ? 'Con turno' : 'Sin turno' }}
        </span>
      </div>
      <button class="sdc__expand" title="Ver detalle de cargas" @click="emit('expand', specialist.specialist_id)">
        <i class="bx bx-expand-alt"></i>
      </button>
    </div>

    <!-- Body: visualización activa -->
    <div class="sdc__body">
      <!-- Resumen -->
      <div v-if="view === 'resumen'" class="sdc__resumen">
        <div class="sdc__big">
          <span class="sdc__big-num" :style="{ color: intensity.color }">{{ specialist.activeCount ?? 0 }}</span>
          <span class="sdc__big-label">casos activos</span>
        </div>
        <div class="sdc__mini-stats">
          <div class="sdc__mini-stat">
            <span class="sdc__mini-num">{{ specialist.todayCount ?? 0 }}</span>
            <span class="sdc__mini-label">hoy</span>
          </div>
          <div class="sdc__mini-stat">
            <span class="sdc__mini-num" :style="{ color: intensity.color }">{{ intensity.label }}</span>
            <span class="sdc__mini-label">carga</span>
          </div>
          <div class="sdc__mini-stat">
            <span class="sdc__mini-num">{{ specialist.windows.length }}</span>
            <span class="sdc__mini-label">turno{{ specialist.windows.length !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>

      <!-- Actividad -->
      <div v-else-if="view === 'actividad'" class="sdc__chart">
        <div class="sdc__bars">
          <div v-for="d in activityBars" :key="d.key" class="sdc__bar-col" :title="`${d.count} asignaciones`">
            <span v-if="d.count" class="sdc__bar-count">{{ d.count }}</span>
            <div class="sdc__bar-track">
              <div class="sdc__bar-fill" :style="{ height: d.pct + '%', background: hslColor(specialist.full_name) }"></div>
            </div>
            <span class="sdc__bar-label">{{ d.label }}</span>
          </div>
        </div>
        <span class="sdc__chart-note">asignaciones activas · últimos 7 días</span>
      </div>

      <!-- Turnos -->
      <div v-else class="sdc__windows">
        <div v-if="specialist.windows.length === 0" class="sdc__windows-empty">
          Sin ventanas vigentes hoy
        </div>
        <div v-for="(w, i) in specialist.windows.slice(0, 3)" :key="i" class="sdc__win">
          <div class="sdc__win-bar" :style="{ background: hslColor(w.appName) }"></div>
          <div class="sdc__win-info">
            <span class="sdc__win-app">{{ w.appName }}</span>
            <span class="sdc__win-time">
              <i class="bx bx-time-five"></i>
              {{ fmtTime(w.startsAt) }} – {{ fmtTime(w.endsAt) }}
            </span>
          </div>
        </div>
        <span v-if="specialist.windows.length > 3" class="sdc__windows-more">
          +{{ specialist.windows.length - 3 }} ventana{{ specialist.windows.length - 3 !== 1 ? 's' : '' }} más
        </span>
      </div>
    </div>

    <!-- Footer: switcher de visualización -->
    <div class="sdc__footer">
      <div class="sdc__views">
        <button
          v-for="v in VIEWS"
          :key="v.id"
          class="sdc__view-btn"
          :class="{ 'sdc__view-btn--active': view === v.id }"
          :title="v.title"
          @click="view = v.id"
        >
          <i :class="'bx ' + v.icon"></i>
        </button>
      </div>
      <button class="sdc__detail-link" @click="emit('expand', specialist.specialist_id)">
        Detalle de cargas <i class="bx bx-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sdc {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
}
.sdc:hover {
  border-color: color-mix(in srgb, var(--primary-500) 45%, var(--border-light));
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(20, 30, 55, 0.14);
}
.sdc--off { opacity: 0.82; }

/* ── Head ── */
.sdc__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.sdc__avatar {
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.9rem;
  color: #fff;
}

.sdc__info { min-width: 0; flex: 1; }

.sdc__name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sdc__turno {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.66rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  margin-top: 0.25rem;
}
.sdc__turno i { font-size: 0.5rem; }
.sdc__turno--on {
  background: color-mix(in srgb, var(--primary-500) 16%, transparent);
  color: var(--primary-500);
}
.sdc__turno--off {
  background: var(--bg-main);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.sdc__expand {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-main);
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.12s;
  flex-shrink: 0;
}
.sdc__expand:hover { color: var(--primary-500); border-color: var(--primary-500); }

/* ── Body ── */
.sdc__body { min-height: 92px; display: flex; flex-direction: column; justify-content: center; }

.sdc__resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.sdc__big { display: flex; flex-direction: column; }
.sdc__big-num {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.sdc__big-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 0.2rem;
}

.sdc__mini-stats { display: flex; gap: 1rem; }
.sdc__mini-stat { display: flex; flex-direction: column; align-items: center; }
.sdc__mini-num {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.sdc__mini-label { font-size: 0.62rem; color: var(--text-secondary); font-weight: 600; }

/* ── Actividad ── */
.sdc__chart { display: flex; flex-direction: column; gap: 0.3rem; }
.sdc__bars {
  display: flex;
  align-items: flex-end;
  gap: 0.45rem;
  height: 64px;
}
.sdc__bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  height: 100%;
  justify-content: flex-end;
}
.sdc__bar-count {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.sdc__bar-track {
  width: 100%;
  flex: 1;
  max-height: 44px;
  display: flex;
  align-items: flex-end;
  background: var(--bg-main);
  border-radius: 4px;
  overflow: hidden;
}
.sdc__bar-fill {
  width: 100%;
  border-radius: 4px 4px 0 0;
  min-height: 2px;
  transition: height 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.sdc__bar-label {
  font-size: 0.6rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-weight: 700;
}
.sdc__chart-note {
  font-size: 0.62rem;
  color: var(--text-secondary);
  text-align: center;
}

/* ── Turnos ── */
.sdc__windows { display: flex; flex-direction: column; gap: 0.4rem; }
.sdc__win {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.35rem 0.55rem;
  border-radius: 9px;
  background: var(--bg-main);
}
.sdc__win-bar { width: 3px; align-self: stretch; border-radius: 3px; }
.sdc__win-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}
.sdc__win-app {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sdc__win-time {
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}
.sdc__windows-empty {
  font-size: 0.74rem;
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  padding: 0.8rem 0;
}
.sdc__windows-more {
  font-size: 0.64rem;
  color: var(--text-secondary);
  text-align: center;
}

/* ── Footer ── */
.sdc__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-light);
  padding-top: 0.6rem;
}

.sdc__views {
  display: flex;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-main);
}

.sdc__view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.12s;
}
.sdc__view-btn + .sdc__view-btn { border-left: 1px solid var(--border-light); }
.sdc__view-btn:hover { color: var(--text-primary); }
.sdc__view-btn--active {
  color: var(--primary-500);
  background: color-mix(in srgb, var(--primary-500) 12%, transparent);
}

.sdc__detail-link {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.12s;
}
.sdc__detail-link:hover { color: var(--primary-500); }
.sdc__detail-link i { font-size: 0.95rem; }
</style>
