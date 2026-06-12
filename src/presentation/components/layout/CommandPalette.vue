<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const prefs = usePreferencesStore()

const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputEl = ref(null)
const listEl = ref(null)

// ── Índice de comandos ──────────────────────────────────────────────────────
// keywords: términos extra de búsqueda (sinónimos, opciones contenidas en la
// pantalla destino). Se filtran por rol y por preferencias de menú.
const commands = computed(() => {
  const isAdmin = authStore.isAdmin
  const items = []

  // Navegación principal
  if (prefs.menus.home) {
    items.push({ id: 'nav-dashboard', category: 'Navegación', icon: 'bx-home-alt', title: 'Inicio', hint: 'Dashboard', keywords: 'dashboard home principal', to: { name: 'dashboard' } })
  }
  items.push({ id: 'nav-calendar', category: 'Navegación', icon: 'bx-calendar', title: 'Calendario', hint: 'Ventanas semanales', keywords: 'semana ventanas windows agenda', to: { name: 'calendar' } })
  if (prefs.menus.cases) {
    items.push(
      { id: 'nav-cases', category: 'Navegación', icon: 'bx-briefcase-alt-2', title: 'Casos', hint: 'Listado de casos', keywords: 'tickets incidencias listado', to: { name: 'cases-list' } },
      { id: 'nav-specialists', category: 'Navegación', icon: 'bx-user-voice', title: 'Especialistas', hint: 'Casos › Especialistas', keywords: 'cargas asignaciones workload', to: { name: 'cases-specialists' } },
    )
  }
  if (isAdmin && prefs.menus.applications) {
    items.push({ id: 'nav-applications', category: 'Navegación', icon: 'bx-grid-alt', title: 'Aplicaciones', hint: 'Catálogo de aplicaciones', keywords: 'apps catalogo sistemas', to: { name: 'applications' } })
  }
  if (isAdmin) {
    items.push({ id: 'nav-users', category: 'Navegación', icon: 'bx-group', title: 'Registro de Usuarios', hint: 'Gestión de usuarios', keywords: 'usuarios users cuentas roles areas', to: { name: 'users' } })
  }
  items.push({ id: 'nav-profile', category: 'Navegación', icon: 'bx-user-circle', title: 'Mi Perfil', hint: 'Datos personales', keywords: 'perfil profile avatar foto contraseña', to: { name: 'profile' } })

  // Configuración: secciones + opciones individuales (apuntan a su sección)
  items.push(
    { id: 'set-root', category: 'Configuración', icon: 'bx-cog', title: 'Configuración', hint: 'Ajustes de la aplicación', keywords: 'settings ajustes preferencias', to: { name: 'settings' } },
    { id: 'set-appearance', category: 'Configuración', icon: 'bx-palette', title: 'Apariencia', hint: 'Configuración › Apariencia', keywords: 'tema visual estilo', to: { name: 'settings', query: { section: 'appearance' } } },
    { id: 'set-theme', category: 'Configuración', icon: 'bx-moon', title: 'Tema claro / oscuro', hint: 'Configuración › Apariencia', keywords: 'theme dark light modo oscuro claro', to: { name: 'settings', query: { section: 'appearance' } } },
    { id: 'set-menus', category: 'Configuración', icon: 'bx-sidebar', title: 'Menú de navegación', hint: 'Configuración › Apariencia', keywords: 'sidebar secciones mostrar ocultar menu lateral', to: { name: 'settings', query: { section: 'appearance' } } },
    { id: 'set-notifications', category: 'Configuración', icon: 'bx-bell', title: 'Notificaciones', hint: 'Configuración › Notificaciones', keywords: 'toast emergentes sonido alertas avisos', to: { name: 'settings', query: { section: 'notifications' } } },
    { id: 'set-calendar', category: 'Configuración', icon: 'bx-time-five', title: 'Hora de inicio del calendario', hint: 'Configuración › Calendario', keywords: 'calendario visualizacion semanal horario', to: { name: 'settings', query: { section: 'calendar' } } },
  )
  if (isAdmin) {
    items.push(
      { id: 'set-roles', category: 'Configuración', icon: 'bx-shield-quarter', title: 'Roles', hint: 'Configuración › Roles', keywords: 'permisos administrador', to: { name: 'settings', query: { section: 'roles' } } },
      { id: 'set-hierarchy', category: 'Configuración', icon: 'bx-sitemap', title: 'Jerarquía de Soporte', hint: 'Configuración › Jerarquía', keywords: 'niveles categorias soporte aplicaciones especialistas', to: { name: 'settings', query: { section: 'hierarchy' } } },
    )
  }

  return items
})

// ── Búsqueda (insensible a acentos) ─────────────────────────────────────────
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const results = computed(() => {
  const q = query.value.trim()
  if (!q) return commands.value

  const terms = normalize(q).split(/\s+/).filter(Boolean)
  const scored = []
  for (const cmd of commands.value) {
    const title = normalize(cmd.title)
    const haystack = `${title} ${normalize(cmd.keywords)} ${normalize(cmd.category)} ${normalize(cmd.hint)}`
    if (!terms.every(t => haystack.includes(t))) continue
    let score = 0
    for (const t of terms) {
      if (title.startsWith(t)) score += 100
      else if (title.includes(t)) score += 60
      else score += 20
    }
    scored.push({ cmd, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.cmd)
})

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Resalta los términos en el título ignorando acentos: regex sobre el texto
// normalizado, pero los <mark> se aplican sobre los índices del texto original
// (normalize NFD no cambia la longitud visible tras quitar diacríticos solo si
// mapeamos índices; con caracteres españoles 1:1 basta comparar char a char).
function highlight(text) {
  const q = query.value.trim()
  if (!q) return escapeHtml(text)
  const terms = normalize(q).split(/\s+/).filter(Boolean)
  const norm = Array.from(text).map(c => normalize(c) || c)
  const marked = new Array(text.length).fill(false)
  const normStr = norm.join('')
  for (const t of terms) {
    let from = 0
    let idx
    while ((idx = normStr.indexOf(t, from)) !== -1) {
      for (let i = idx; i < idx + t.length; i++) marked[i] = true
      from = idx + t.length
    }
  }
  let out = ''
  let inMark = false
  for (let i = 0; i < text.length; i++) {
    if (marked[i] && !inMark) { out += '<mark>'; inMark = true }
    if (!marked[i] && inMark) { out += '</mark>'; inMark = false }
    out += escapeHtml(text[i])
  }
  if (inMark) out += '</mark>'
  return out
}

// Categoría visible solo en la primera fila de cada grupo
function showCategory(index) {
  if (index === 0) return true
  return results.value[index].category !== results.value[index - 1].category
}

// ── Abrir / cerrar ──────────────────────────────────────────────────────────
function openPalette() {
  open.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => inputEl.value?.focus())
}

function closePalette() {
  open.value = false
}

watch(results, () => { selectedIndex.value = 0 })

watch(open, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

// ── Teclado ─────────────────────────────────────────────────────────────────
function onGlobalKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    open.value ? closePalette() : openPalette()
  }
}

function onInputKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1) }
  else if (e.key === 'Enter') { e.preventDefault(); execute(results.value[selectedIndex.value]) }
  else if (e.key === 'Escape') { closePalette() }
}

function moveSelection(delta) {
  const len = results.value.length
  if (!len) return
  selectedIndex.value = Math.max(0, Math.min(selectedIndex.value + delta, len - 1))
  nextTick(() => {
    listEl.value?.querySelector('.cp__item--selected')?.scrollIntoView({ block: 'nearest' })
  })
}

function execute(cmd) {
  if (!cmd) return
  closePalette()
  // Mismo destino con misma query → push es no-op; forzamos replace para que
  // SettingsView reciba el cambio aunque ya estemos en /app/settings.
  if (cmd.to.name === route.name && cmd.to.query) {
    router.replace(cmd.to)
  } else {
    router.push(cmd.to)
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cp" role="dialog" aria-modal="true" aria-label="Buscador de navegación">
      <div class="cp__backdrop" @click="closePalette"></div>
      <div class="cp__panel">

        <div class="cp__input-wrap">
          <i class="bx bx-search cp__search-icon"></i>
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            class="cp__input"
            placeholder="Ir a... (menús y configuración)"
            autocomplete="off"
            spellcheck="false"
            @keydown="onInputKeydown"
          />
          <kbd class="cp__esc" @click="closePalette">ESC</kbd>
          <button class="cp__close" type="button" aria-label="Cerrar buscador" @click="closePalette">✕</button>
        </div>

        <div v-if="results.length" ref="listEl" class="cp__results">
          <template v-for="(cmd, i) in results" :key="cmd.id">
            <div v-if="showCategory(i)" class="cp__group">{{ cmd.category }}</div>
            <button
              class="cp__item"
              :class="{ 'cp__item--selected': i === selectedIndex }"
              type="button"
              @mouseenter="selectedIndex = i"
              @click="execute(cmd)"
            >
              <i :class="'bx ' + cmd.icon"></i>
              <span class="cp__item-title" v-html="highlight(cmd.title)"></span>
              <span class="cp__item-hint">{{ cmd.hint }}</span>
            </button>
          </template>
        </div>

        <div v-else class="cp__empty">
          Sin resultados para "<strong>{{ query }}</strong>"
        </div>

        <div class="cp__footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>↵</kbd> ir</span>
          <span><kbd>ESC</kbd> cerrar</span>
          <span class="cp__footer-sep"><kbd>Ctrl</kbd><kbd>K</kbd> abrir</span>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cp {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.cp__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
}

.cp__panel {
  position: relative;
  z-index: 1;
  width: min(600px, calc(100vw - 32px));
  margin: 90px auto 0;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: min(520px, calc(100vh - 140px));
}

/* ── Input ── */
.cp__input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.cp__search-icon {
  font-size: 1.15rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.cp__input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  font-size: 0.95rem;
  font-family: inherit;
  color: var(--text-primary);
  caret-color: var(--primary-500);
}

.cp__input::placeholder { color: var(--text-secondary); opacity: 0.65; }

.cp__esc {
  font-size: 11px;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 2px 7px;
  color: var(--text-secondary);
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
}

/* ✕ solo en táctiles */
.cp__close {
  display: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--text-primary) 5%, transparent);
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

@media (hover: none), (pointer: coarse) {
  .cp__esc { display: none; }
  .cp__close { display: flex; }
}

/* ── Resultados ── */
.cp__results {
  overflow-y: auto;
  flex: 1;
  padding: 6px;
}

.cp__group {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  opacity: 0.8;
  padding: 10px 12px 4px;
}

.cp__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: none;
  font-family: inherit;
  font-size: 0.87rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.cp__item i {
  font-size: 1.1rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.cp__item--selected {
  background: color-mix(in srgb, var(--primary-500) 12%, transparent);
}

.cp__item--selected i { color: var(--primary-500); }

.cp__item-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp__item-title :deep(mark) {
  background: color-mix(in srgb, var(--primary-500) 25%, transparent);
  color: var(--primary-500);
  border-radius: 2px;
  padding: 0 1px;
}

.cp__item-hint {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 45%;
  flex-shrink: 0;
}

.cp__empty {
  padding: 26px 18px;
  font-size: 0.88rem;
  color: var(--text-secondary);
  text-align: center;
}

.cp__empty strong { color: var(--text-primary); }

/* ── Footer ── */
.cp__footer {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 16px;
  border-top: 1px solid var(--border-light);
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.cp__footer kbd {
  display: inline-block;
  background: color-mix(in srgb, var(--text-primary) 6%, transparent);
  border: 1px solid var(--border-light);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: inherit;
  font-size: 10px;
  margin: 0 1px;
}

.cp__footer-sep { margin-left: auto; }

@media (max-width: 480px) {
  .cp__panel {
    margin: 16px auto 0;
    max-height: calc(100dvh - 32px);
  }
  .cp__item-hint { display: none; }
  .cp__footer-sep { display: none; }
}
</style>
