<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { useCalendarStore } from '@/presentation/stores/useCalendarStore'
import UserAvatar from '@/presentation/components/shared/UserAvatar.vue'
import MiniCalendar from '@/presentation/components/calendar/MiniCalendar.vue'
import { fmtDateISO } from '@/presentation/helpers/formatDate'

const authStore = useAuthStore()
const userStore = useUserStore()
const calStore = useCalendarStore()

const {
  calView, weekDates, monthDates,
  hiddenSpecs, hiddenApps, showActive, showInactive,
  specialistsConVentana,
} = storeToRefs(calStore)

// ---- Crear dropdown ----
const createMenu = ref(false)
const createWrap = ref(null)

function chooseCreate(mode) {
  createMenu.value = false
  calStore.requestCreate(mode)
}

function onDocClick(e) {
  if (createMenu.value && createWrap.value && !createWrap.value.contains(e.target)) {
    createMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// ---- Mini-calendario ----
const todayIso = fmtDateISO(new Date())

// Fecha ancla del rango visible (para sincronizar el mes del mini-cal):
// day → el día; week → miércoles (representa mejor la semana al cruzar mes);
// month → celda 20 del grid de 42 (siempre cae dentro del mes visible).
const anchorIso = computed(() => {
  if (calView.value === 'month') return monthDates.value[20] || todayIso
  if (calView.value === 'day') return weekDates.value[0] || todayIso
  return weekDates.value[3] || todayIso
})

function _parseYM(iso) {
  const [y, m] = iso.split('-')
  return { y: parseInt(y), m: parseInt(m) - 1 }
}

const miniCursor = ref(_parseYM(anchorIso.value))
watch(anchorIso, (iso) => { miniCursor.value = _parseYM(iso) })

function miniPrev() {
  const { y, m } = miniCursor.value
  miniCursor.value = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }
}

function miniNext() {
  const { y, m } = miniCursor.value
  miniCursor.value = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }
}

// Días marcados como seleccionados: el rango visible (day = 1 día, week = 7).
// En month no se marca rango (weekDates ahí es solo [primero, último]).
const selectedIsos = computed(() => {
  if (calView.value === 'month') return []
  return weekDates.value
})

function pickDay(iso) {
  calStore.goToDate(iso)
}

// ---- Filtro Especialistas ----
const specsOpen = ref(true)
const searchOpen = ref(false)
const query = ref('')
const specSearch = ref(null)

const filteredSpecs = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return specialistsConVentana.value
  return specialistsConVentana.value.filter(s => s.fullName.toLowerCase().includes(q))
})

const enabledSpecCount = computed(() =>
  specialistsConVentana.value.filter(s => !hiddenSpecs.value.has(s.specialistId)).length
)
const allSpecsOn = computed(() => enabledSpecCount.value === specialistsConVentana.value.length)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    specsOpen.value = true
    nextTick(() => specSearch.value?.focus())
  } else {
    query.value = ''
  }
}

function toggleAllSpecs() {
  calStore.setAllSpecs(!allSpecsOn.value, specialistsConVentana.value.map(s => s.specialistId))
}

// ---- Filtro Aplicaciones ----
const appsOpen = ref(true)
const appSearchOpen = ref(false)
const appQuery = ref('')
const appSearch = ref(null)

const filteredApps = computed(() => {
  const q = appQuery.value.trim().toLowerCase()
  if (!q) return userStore.applications
  return userStore.applications.filter(a => a.name.toLowerCase().includes(q))
})

const enabledAppCount = computed(() =>
  userStore.applications.filter(a => !hiddenApps.value.has(a.id)).length
)
const allAppsOn = computed(() => enabledAppCount.value === userStore.applications.length)

function toggleAppSearch() {
  appSearchOpen.value = !appSearchOpen.value
  if (appSearchOpen.value) {
    appsOpen.value = true
    nextTick(() => appSearch.value?.focus())
  } else {
    appQuery.value = ''
  }
}

function toggleAllApps() {
  calStore.setAllApps(!allAppsOn.value, userStore.applications.map(a => a.id))
}
</script>

<template>
  <div class="cside">
    <!-- Crear -->
    <div v-if="authStore.isAdmin" class="cside__create-wrap" ref="createWrap">
      <button class="cside__create" :class="{ 'cside__create--open': createMenu }" @click.stop="createMenu = !createMenu">
        <i class="bx bx-plus"></i><span>Crear</span>
        <i class="bx bx-chevron-down cside__create-caret"></i>
      </button>
      <div v-if="createMenu" class="cside__menu">
        <button class="cside__menu-item" @click="chooseCreate('single')">
          <i class="bx bx-calendar-plus"></i>
          <span class="cside__menu-txt"><b>Ventana individual</b><small>Un especialista</small></span>
        </button>
        <button class="cside__menu-item" @click="chooseCreate('bulk')">
          <i class="bx bx-layer-plus"></i>
          <span class="cside__menu-txt"><b>Asignación masiva</b><small>Varios especialistas a la vez</small></span>
        </button>
      </div>
    </div>

    <!-- Mini-calendario -->
    <MiniCalendar
      :year="miniCursor.y" :month="miniCursor.m"
      :selected-isos="selectedIsos" :today-iso="todayIso"
      @prev="miniPrev" @next="miniNext" @pick="pickDay"
    />

    <!-- Especialistas (admin) -->
    <div v-if="authStore.isAdmin" class="cside__section">
      <div class="cside__title-row">
        <button class="cside__title" @click="specsOpen = !specsOpen">
          <span>Especialistas</span>
          <i class="bx" :class="specsOpen ? 'bx-chevron-up' : 'bx-chevron-down'"></i>
        </button>
        <button class="cside__tool" :class="{ 'cside__tool--on': searchOpen }" @click="toggleSearch" title="Buscar especialista">
          <i class="bx bx-search"></i>
        </button>
      </div>
      <div v-show="specsOpen">
        <div v-show="searchOpen" class="cside__search">
          <i class="bx bx-search"></i>
          <input ref="specSearch" v-model="query" type="text" placeholder="Buscar…" />
          <button v-if="query" class="cside__search-x" @click="query = ''"><i class="bx bx-x"></i></button>
        </div>
        <div class="cside__listhead">
          <span>{{ enabledSpecCount }}/{{ specialistsConVentana.length }} activos</span>
          <button class="cside__alllink" @click="toggleAllSpecs">{{ allSpecsOn ? 'Ninguno' : 'Todos' }}</button>
        </div>
        <div class="cside__list">
          <button v-for="s in filteredSpecs" :key="s.specialistId"
            class="specrow" :class="{ 'specrow--on': !hiddenSpecs.has(s.specialistId) }"
            @click="calStore.toggleSpecFilter(s.specialistId)">
            <UserAvatar :preferences="s.preferences" :name="s.fullName" size="24px" class="specrow__av" />
            <span class="specrow__name">{{ s.fullName }}</span>
            <i class="bx bx-check specrow__check"></i>
          </button>
          <div v-if="!filteredSpecs.length" class="cside__empty">Sin resultados</div>
        </div>
      </div>
    </div>

    <!-- Aplicaciones -->
    <div class="cside__section">
      <div class="cside__title-row">
        <button class="cside__title" @click="appsOpen = !appsOpen">
          <span>Aplicaciones</span>
          <i class="bx" :class="appsOpen ? 'bx-chevron-up' : 'bx-chevron-down'"></i>
        </button>
        <button class="cside__tool" :class="{ 'cside__tool--on': appSearchOpen }" @click="toggleAppSearch" title="Buscar aplicación">
          <i class="bx bx-search"></i>
        </button>
      </div>
      <div v-show="appsOpen">
        <div v-show="appSearchOpen" class="cside__search">
          <i class="bx bx-search"></i>
          <input ref="appSearch" v-model="appQuery" type="text" placeholder="Buscar…" />
          <button v-if="appQuery" class="cside__search-x" @click="appQuery = ''"><i class="bx bx-x"></i></button>
        </div>
        <div class="cside__listhead">
          <span>{{ enabledAppCount }}/{{ userStore.applications.length }} activas</span>
          <button class="cside__alllink" @click="toggleAllApps">{{ allAppsOn ? 'Ninguna' : 'Todas' }}</button>
        </div>
        <div class="cside__list">
          <button v-for="a in filteredApps" :key="a.id"
            class="specrow" :class="{ 'specrow--on': !hiddenApps.has(a.id) }"
            :style="{ '--c': a.color || '#2AC78F' }"
            @click="calStore.toggleAppFilter(a.id)">
            <span class="specrow__swatch"></span>
            <span class="specrow__name">{{ a.name }}</span>
            <i class="bx bx-check specrow__check"></i>
          </button>
          <div v-if="!filteredApps.length" class="cside__empty">Sin resultados</div>
        </div>
      </div>
    </div>

    <!-- Estado -->
    <div class="cside__section">
      <div class="cside__title cside__title--static"><span>Estado</span></div>
      <div class="cside__list">
        <label class="cfilter" style="--c: var(--primary-500)">
          <input type="checkbox" :checked="showActive" @change="calStore.toggleShowActive()" />
          <span class="cfilter__box"><i class="bx bx-check"></i></span>
          <span class="cfilter__name">Activas</span>
        </label>
        <label class="cfilter">
          <input type="checkbox" :checked="showInactive" @change="calStore.toggleShowInactive()" />
          <span class="cfilter__box cfilter__box--neutral"><i class="bx bx-check"></i></span>
          <span class="cfilter__swatch cfilter__swatch--striped"></span>
          <span class="cfilter__name">Inactivas</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Sección de calendario dentro del navrail: colores --nav-* (theme-aware),
   no --text/--surface, para seguir el fondo unificado del rail. */
.cside {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  border-top: 1px solid var(--nav-border);
  margin-top: 0.85rem;
  padding: 0.85rem 0.65rem 1.1rem;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--nav-border) transparent;
}

.cside::-webkit-scrollbar { width: 7px; }
.cside::-webkit-scrollbar-thumb { background: var(--nav-border); border-radius: 4px; }

/* ---- Crear ---- */
.cside__create-wrap { position: relative; }

.cside__create {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem 0.85rem;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--primary-500) 26%, transparent);
  background: color-mix(in srgb, var(--primary-500) 13%, transparent);
  color: var(--primary-500);
  font-weight: 700;
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: background .12s, border-color .12s, transform .08s;
}

.cside__create:hover,
.cside__create--open {
  background: color-mix(in srgb, var(--primary-500) 20%, transparent);
  border-color: color-mix(in srgb, var(--primary-500) 40%, transparent);
}

.cside__create:active { transform: scale(0.98); }
.cside__create i { font-size: 1.05rem; }

.cside__create-caret {
  margin-left: auto;
  font-size: 1rem !important;
  transition: transform .15s;
}

.cside__create--open .cside__create-caret { transform: rotate(180deg); }

.cside__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px;
  background: var(--bg-card);
  border: 1px solid var(--nav-border);
  border-radius: 12px;
  box-shadow: var(--shadow-pop);
  animation: cside-pop .14s cubic-bezier(.2, .9, .3, 1.2);
}

@keyframes cside-pop {
  from { opacity: 0; transform: translateY(-4px) scale(0.97); }
  to { opacity: 1; transform: none; }
}

.cside__menu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--nav-text);
  background-color: var(--bg-main)
}

.cside__menu-item:hover { background: var(--nav-hover); }
.cside__menu-item > i { font-size: 1.25rem; color: var(--primary-500); flex-shrink: 0; }

.cside__menu-txt { display: flex; flex-direction: column; min-width: 0; }
.cside__menu-txt b { font-size: 0.82rem; font-weight: 700; color: var(--nav-text-strong); }
.cside__menu-txt small { font-size: 0.68rem; color: var(--nav-text); }

/* ---- Secciones ---- */
.cside__section { display: flex; flex-direction: column; gap: 0.2rem; }

.cside__title-row { display: flex; align-items: center; gap: 0.2rem; }

.cside__title {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
  border: none;
  background: none;
  padding: 0.15rem;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--nav-text);
  opacity: 0.75;
  cursor: pointer;
  text-align: left;
}

.cside__title--static { cursor: default; }
.cside__title i { font-size: 1.05rem; margin-left: auto; }
.cside__title:not(.cside__title--static):hover { opacity: 1; }

.cside__tool {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: 7px;
  font-size: 0.95rem;
  color: var(--nav-text);
  opacity: 0.7;
  cursor: pointer;
  transition: background .12s, color .12s, opacity .12s;
}

.cside__tool:hover { background: var(--nav-hover); opacity: 1; }

.cside__tool--on {
  background: color-mix(in srgb, var(--primary-500) 16%, transparent);
  color: var(--primary-500);
  opacity: 1;
}

.cside__search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  height: 30px;
  padding: 0 0.5rem;
  margin: 0.2rem 0;
  background: var(--nav-hover);
  border: 1px solid var(--nav-border);
  border-radius: 8px;
}

.cside__search > i { font-size: 0.95rem; color: var(--nav-text); flex-shrink: 0; }

.cside__search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-size: 0.8rem;
  font-family: inherit;
  color: var(--nav-text-strong);
}

.cside__search input::placeholder { color: var(--nav-text); opacity: 0.7; }

.cside__search-x {
  border: none;
  background: none;
  color: var(--nav-text);
  cursor: pointer;
  display: flex;
  font-size: 1rem;
  padding: 0;
}

.cside__search-x:hover { color: var(--nav-text-strong); }

.cside__listhead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.1rem 0.15rem;
  font-size: 0.66rem;
  color: var(--nav-text);
  opacity: 0.85;
}

.cside__alllink {
  border: none;
  background: none;
  color: var(--primary-500);
  font-size: 0.66rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
}

.cside__alllink:hover { text-decoration: underline; }

.cside__empty {
  padding: 0.6rem 0.3rem;
  font-size: 0.74rem;
  color: var(--nav-text);
  opacity: 0.7;
  text-align: center;
}

.cside__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 0.1rem;
  max-height: 232px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nav-border) transparent;
}

.cside__list::-webkit-scrollbar { width: 6px; }
.cside__list::-webkit-scrollbar-thumb { background: var(--nav-border); border-radius: 4px; }

/* ---- Filas especialista / app (avatar/swatch = toggle) ---- */
.specrow {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-width: 0;
  padding: 0.32rem 0.4rem;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background .12s;
}

.specrow:hover { background: var(--nav-hover); }

.specrow__av { transition: filter .12s, opacity .12s; }

.specrow__swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: var(--c, var(--primary-500));
  flex-shrink: 0;
  transition: opacity .12s;
}

.specrow__name {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--nav-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.specrow__check {
  font-size: 1rem;
  color: var(--c, var(--primary-500));
  opacity: 0;
  flex-shrink: 0;
  transition: opacity .12s;
}

.specrow:not(.specrow--on) .specrow__av { filter: grayscale(1); opacity: 0.4; }
.specrow:not(.specrow--on) .specrow__swatch { opacity: 0.3; }
.specrow--on .specrow__name { color: var(--nav-text-strong); font-weight: 600; }
.specrow--on .specrow__check { opacity: 1; }

/* ---- Estado (checkboxes) ---- */
.cfilter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.32rem 0.3rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background .12s;
}

.cfilter:hover { background: var(--nav-hover); }

.cfilter input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.cfilter__box {
  width: 17px;
  height: 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c, var(--primary-500));
  border-radius: 5px;
  flex-shrink: 0;
  transition: background .1s, border-color .1s;
}

.cfilter__box i { font-size: 0.85rem; color: #fff; opacity: 0; transition: opacity .1s; }
.cfilter__box--neutral { border-color: var(--nav-text); }

.cfilter input:checked + .cfilter__box {
  background: var(--c, var(--primary-500));
  border-color: var(--c, var(--primary-500));
}

.cfilter input:checked + .cfilter__box--neutral {
  background: var(--nav-text);
  border-color: var(--nav-text);
}

.cfilter input:checked + .cfilter__box i { opacity: 1; }

.cfilter__swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  background: var(--c, var(--primary-500));
  flex-shrink: 0;
}

.cfilter__swatch--striped {
  background-image: repeating-linear-gradient(-45deg, var(--inactive-stripe) 0 1px, transparent 1px 5px);
  background-color: var(--inactive-fill);
  border: 1px solid var(--inactive-bar);
}

.cfilter__name {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--nav-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
