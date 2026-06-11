<script setup>
import { computed } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'

const store = useCasesStore()
const userStore = useUserStore()
const MAX_LOAD = 10

const workloads = computed(() => store.specialistWorkloads)
const recent = computed(() => store.recentAssignments)

function preferencesFor(specialistId) {
  return userStore.users.find(u => u.specialistId === specialistId)?.preferences || null
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function hslColor(name) {
  let h = 0
  for (const ch of (name || '')) h = ch.charCodeAt(0) + ((h << 5) - h)
  return `hsl(${Math.abs(h) % 360}, 50%, 42%)`
}

function loadPct(count) {
  return Math.min(100, Math.round(((count ?? 0) / MAX_LOAD) * 100))
}

function loadColor(pct) {
  if (pct < 60) return 'var(--load-low)'
  if (pct < 85) return 'var(--load-mid)'
  return 'var(--load-high)'
}

// SVG donut
const R = 18
const C = 2 * Math.PI * R

function dash(pct) {
  const fill = (pct / 100) * C
  return `${fill} ${C - fill}`
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="ss">
    <!-- Specialists -->
    <div class="ss__section">
      <h4 class="ss__title">Especialistas</h4>

      <div v-if="workloads.length === 0" class="ss__empty">Sin datos de carga</div>

      <div v-for="s in workloads" :key="s.specialist_id" class="sc">
        <div class="sc__left">
          <UserAvatar
            :preferences="preferencesFor(s.specialist_id)"
            :name="s.full_name"
            :bg-color="hslColor(s.full_name)"
            size="32px"
            class="sc__avatar"
          />
          <div class="sc__info">
            <span class="sc__name">{{ s.full_name }}</span>
            <span class="sc__status" :class="s.is_available ? 'sc__status--on' : 'sc__status--off'">
              <i :class="s.is_available ? 'bx bxs-circle' : 'bx bxs-circle'"></i>
              {{ s.is_available ? 'Disponible' : 'Sin ventana' }}
            </span>
            <span class="sc__window" v-if="s.window_starts_at">
              {{ fmtTime(s.window_starts_at) }} – {{ fmtTime(s.window_ends_at) }}
            </span>
          </div>
        </div>
        <div class="sc__donut">
          <svg viewBox="0 0 44 44" width="42" height="42">
            <circle cx="22" cy="22" :r="R" fill="none" stroke="var(--border-light)" stroke-width="3.5" />
            <circle cx="22" cy="22" :r="R" fill="none"
              :stroke="loadColor(loadPct(s.current_count))"
              stroke-width="3.5" stroke-linecap="round"
              :stroke-dasharray="dash(loadPct(s.current_count))"
              :stroke-dashoffset="C * 0.25"
              style="transition: stroke-dasharray 0.4s"
            />
            <text x="22" y="22" text-anchor="middle" dominant-baseline="central"
              font-size="9" font-weight="700" :fill="loadColor(loadPct(s.current_count))">
              {{ s.current_count ?? 0 }}
            </text>
          </svg>
        </div>
      </div>
    </div>

    <!-- Recent assignments -->
    <div class="ss__section">
      <h4 class="ss__title">Asignaciones Recientes</h4>

      <div v-if="recent.length === 0" class="ss__empty">Sin asignaciones</div>

      <div v-for="(a, i) in recent" :key="i" class="ra">
        <div class="ra__left">
          <span class="ra__subject">{{ a.case_subject || a.case_id?.slice(0, 6) }}</span>
          <span class="ra__specialist">→ {{ a.specialist_name || a.specialist_id?.slice(0, 6) }}</span>
        </div>
        <span class="ra__time">{{ fmtTime(a.assigned_at) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ss {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  padding: 0.85rem;
  overflow-y: auto;
  border-left: 1px solid var(--border-light);
}

.ss__title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  margin-bottom: 0.6rem;
}

.ss__empty {
  font-size: 0.78rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.75rem 0;
}

/* Specialist card */
.sc {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--border-light);
}
.sc:last-child { border-bottom: none; }

.sc__left { display: flex; align-items: center; gap: 0.55rem; min-width: 0; }

.sc__avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 0.65rem; font-weight: 700;
  flex-shrink: 0;
}

.sc__info { display: flex; flex-direction: column; min-width: 0; }
.sc__name { font-size: 0.78rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc__status { font-size: 0.65rem; display: flex; align-items: center; gap: 0.2rem; }
.sc__status i { font-size: 0.5rem; }
.sc__status--on { color: var(--load-low); }
.sc__status--off { color: var(--load-high); }
.sc__window { font-size: 0.62rem; color: var(--text-secondary); }

.sc__donut { flex-shrink: 0; }

/* Recent assignment */
.ra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--border-light);
  font-size: 0.72rem;
}
.ra:last-child { border-bottom: none; }

.ra__left { display: flex; flex-direction: column; gap: 0.05rem; min-width: 0; }
.ra__subject { font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ra__specialist { color: var(--text-secondary); }
.ra__time { color: var(--text-secondary); flex-shrink: 0; font-size: 0.65rem; }
</style>
