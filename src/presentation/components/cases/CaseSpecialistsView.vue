<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCasesStore } from '@/presentation/stores/useCasesStore'

const store = useCasesStore()

const sortBy = ref('load')   // 'load' | 'active' | 'name'
const turnoOnly = ref(false)

// Use specialistWorkloads from the store (already loaded by CasesView)
const workloads = computed(() => store.specialistWorkloads)

const MAX_LOAD = 10

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
  if (pct < 60) return 'var(--load-low, #16A34A)'
  if (pct < 85) return 'var(--load-mid, #D97706)'
  return 'var(--load-high, #DC2626)'
}

function loadLabel(pct) {
  if (pct < 60) return 'Baja'
  if (pct < 85) return 'Media'
  return 'Alta'
}

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

const rows = computed(() => {
  let list = [...workloads.value]
  if (turnoOnly.value) list = list.filter(s => s.is_available)

  const by = sortBy.value
  list.sort((a, b) => {
    if (by === 'load') return (b.current_count ?? 0) - (a.current_count ?? 0)
    if (by === 'active') return (b.current_count ?? 0) - (a.current_count ?? 0)
    return (a.full_name || '').localeCompare(b.full_name || '')
  })
  return list
})

// KPIs
const kpis = computed(() => {
  const all = workloads.value
  const conTurno = all.filter(s => s.is_available).length
  const totalActive = all.reduce((n, s) => n + (s.current_count ?? 0), 0)
  const totalCap = all.length * MAX_LOAD
  const saturated = all.filter(s => loadPct(s.current_count) >= 85).length
  const util = totalCap > 0 ? Math.round(totalActive / totalCap * 100) : 0
  return { conTurno, total: all.length, totalActive, totalCap, saturated, util }
})

onMounted(() => {
  // Ensure workload data is loaded
  if (workloads.value.length === 0) {
    store.loadCases({ status: null })
  }
})
</script>

<template>
  <div class="esv">
    <!-- filter row -->
    <div class="esv__toolbar">
      <span class="esv__toolbar-label">Ordenar</span>
      <div class="esv__seg">
        <button :class="['esv__seg-btn', sortBy === 'load' && 'esv__seg-btn--active']" @click="sortBy = 'load'">Carga</button>
        <button :class="['esv__seg-btn', sortBy === 'active' && 'esv__seg-btn--active']" @click="sortBy = 'active'">Casos activos</button>
        <button :class="['esv__seg-btn', sortBy === 'name' && 'esv__seg-btn--active']" @click="sortBy = 'name'">Nombre</button>
      </div>
      <button :class="['esv__chip', turnoOnly && 'esv__chip--active']" @click="turnoOnly = !turnoOnly">
        <i class="bx bx-time-five"></i> Solo con turno
      </button>
    </div>

    <!-- KPI summary -->
    <div class="esv__kpis">
      <div class="esv__kpi">
        <div class="esv__kpi-label"><i class="bx bx-group"></i>Especialistas</div>
        <div class="esv__kpi-val">{{ kpis.conTurno }}<span class="esv__kpi-sub-inline"> / {{ kpis.total }}</span></div>
        <div class="esv__kpi-sub">con turno vigente hoy</div>
      </div>
      <div class="esv__kpi">
        <div class="esv__kpi-label"><i class="bx bx-folder-open"></i>Casos activos</div>
        <div class="esv__kpi-val">{{ kpis.totalActive }}</div>
        <div class="esv__kpi-sub">de {{ kpis.totalCap }} de capacidad</div>
      </div>
      <div class="esv__kpi">
        <div class="esv__kpi-label"><i class="bx bx-tachometer"></i>Utilización</div>
        <div class="esv__kpi-val" :style="{ color: kpis.util >= 80 ? 'var(--load-high, #DC2626)' : kpis.util >= 50 ? 'var(--load-mid, #D97706)' : 'var(--load-low, #16A34A)' }">{{ kpis.util }}%</div>
        <div class="esv__kpi-sub">carga media del equipo</div>
      </div>
      <div class="esv__kpi">
        <div class="esv__kpi-label"><i class="bx bx-error-circle"></i>Saturados</div>
        <div class="esv__kpi-val" :style="{ color: kpis.saturated ? 'var(--load-high, #DC2626)' : 'var(--text-primary)' }">{{ kpis.saturated }}</div>
        <div class="esv__kpi-sub">por encima del umbral</div>
      </div>
    </div>

    <!-- cards grid -->
    <div class="esv__grid">
      <div v-for="s in rows" :key="s.specialist_id" class="ec">
        <div class="ec__head">
          <div class="ec__avatar" :style="{ background: hslColor(s.full_name) }">
            {{ initials(s.full_name) }}
          </div>
          <div class="ec__info">
            <div class="ec__name">{{ s.full_name }}</div>
            <div class="ec__meta">
              <span :class="['ec__turno', s.is_available ? 'ec__turno--on' : 'ec__turno--off']">
                <i :class="['bx', s.is_available ? 'bxs-circle' : 'bx-block']"></i>
                {{ s.is_available ? 'Con turno' : 'Sin turno' }}
              </span>
            </div>
          </div>
          <span class="ec__load-label" :style="{
            background: `color-mix(in srgb, ${loadColor(loadPct(s.current_count))} 16%, transparent)`,
            color: loadColor(loadPct(s.current_count)),
          }">{{ loadLabel(loadPct(s.current_count)) }}</span>
        </div>

        <div>
          <div class="ec__loadrow">
            <div class="ec__loadnum" :style="{ color: loadColor(loadPct(s.current_count)) }">
              {{ s.current_count ?? 0 }}<small> / {{ MAX_LOAD }} casos</small>
            </div>
            <div class="ec__loadpct">{{ loadPct(s.current_count) }}% carga</div>
          </div>
          <div class="ec__loadbar">
            <div class="ec__loadbar-fill" :style="{ width: loadPct(s.current_count) + '%', background: loadColor(loadPct(s.current_count)) }"></div>
          </div>
        </div>

        <!-- Window info -->
        <div v-if="s.window_starts_at">
          <div class="ec__sec-label">Turno actual</div>
          <div class="ec__win">
            <div class="ec__win-bar" :style="{ background: hslColor(s.full_name) }"></div>
            <span class="ec__win-time">
              <i class="bx bx-time-five"></i>
              {{ fmtTime(s.window_starts_at) }} – {{ fmtTime(s.window_ends_at) }}
            </span>
          </div>
        </div>
        <div v-else>
          <div class="ec__sec-label">Turno actual</div>
          <div class="ec__win ec__win--empty">Sin ventanas vigentes hoy</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="rows.length === 0 && !store.loading" class="esv__empty">
      <i class="bx bx-group"></i>
      <div class="esv__empty-title">Sin especialistas</div>
      <div class="esv__empty-sub">No hay especialistas con datos de carga.</div>
    </div>
  </div>
</template>

<style scoped>
.esv {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border-light) transparent;
}
.esv::-webkit-scrollbar { width: 9px; }
.esv::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 5px; }

/* ── Toolbar ── */
.esv__toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.1rem;
  flex-wrap: wrap;
}

.esv__toolbar-label {
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.esv__seg {
  display: flex;
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-card);
}

.esv__seg-btn {
  padding: 0 0.6rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.74rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.esv__seg-btn + .esv__seg-btn {
  border-left: 1px solid var(--border-light);
}

.esv__seg-btn:hover {
  color: var(--text-primary);
  background: var(--bg-main);
}

.esv__seg-btn--active {
  background: var(--primary-500);
  color: #fff;
}

.esv__seg-btn--active:hover {
  background: var(--primary-600);
}

.esv__chip {
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.14s;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.esv__chip i { font-size: 0.8rem; }
.esv__chip:hover { color: var(--text-primary); border-color: var(--primary-500); }
.esv__chip--active { background: var(--primary-500); border-color: var(--primary-500); color: #fff; }
.esv__chip--active:hover { background: var(--primary-600); color: #fff; }

/* ── KPIs ── */
.esv__kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}

.esv__kpi {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 1rem 1.1rem;
}

.esv__kpi-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.esv__kpi-label i { font-size: 0.95rem; }

.esv__kpi-val {
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: 0.35rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.esv__kpi-sub-inline {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.esv__kpi-sub {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

/* ── Cards grid ── */
.esv__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 1rem;
}

.ec {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 1.1rem 1.2rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
  position: relative;
  overflow: hidden;
}

.ec:hover {
  border-color: color-mix(in srgb, var(--primary-500) 50%, var(--border-light));
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(20, 30, 55, 0.16);
}

/* ── Card head ── */
.ec__head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.ec__avatar {
  width: 46px;
  height: 46px;
  min-width: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.95rem;
  color: #fff;
  letter-spacing: -0.02em;
}

.ec__info {
  min-width: 0;
  flex: 1;
}

.ec__name {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
}

.ec__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.ec__turno {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.ec__turno i { font-size: 0.55rem; }

.ec__turno--on {
  background: color-mix(in srgb, var(--primary-500) 16%, transparent);
  color: var(--primary-500);
}

.ec__turno--off {
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.ec__load-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

/* ── Load bar ── */
.ec__loadrow {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.ec__loadnum {
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ec__loadnum small {
  font-size: 0.9rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.ec__loadpct {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.ec__loadbar {
  height: 8px;
  border-radius: 999px;
  background: var(--bg-main);
  overflow: hidden;
  margin-top: 0.5rem;
}

.ec__loadbar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
}

/* ── Section label ── */
.ec__sec-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.4rem;
}

/* ── Window row ── */
.ec__win {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.6rem;
  border-radius: 9px;
  background: var(--bg-main);
  font-size: 0.76rem;
}

.ec__win-bar {
  width: 3px;
  align-self: stretch;
  border-radius: 3px;
}

.ec__win-time {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.ec__win-time i { font-size: 0.85rem; }

.ec__win--empty {
  color: var(--text-secondary);
  font-style: italic;
  justify-content: center;
}

/* ── Empty state ── */
.esv__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 5rem 1rem;
  color: var(--text-secondary);
}

.esv__empty i { font-size: 2.4rem; opacity: 0.5; }
.esv__empty-title { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); }
.esv__empty-sub { font-size: 0.8rem; }

/* ── Responsive ── */
@media (max-width: 960px) {
  .esv__kpis { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .esv__kpis { grid-template-columns: 1fr; }
  .esv__grid { grid-template-columns: 1fr; }
}
</style>
