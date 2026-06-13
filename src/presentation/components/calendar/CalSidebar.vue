<script setup>
import '@/presentation/styles/calendar/CalSidebar.css'
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
