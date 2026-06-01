<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useConversationStore } from '@/presentation/stores/useConversationStore'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const props = defineProps({
  selectedFolder: { type: Object, default: null },
  splitView: { type: Boolean, default: false },
})

const store = useConversationStore()
const authStore = useAuthStore()

const filterSearch = ref('')
const view = ref('list') // 'list' | 'reading' — only used in narrow/mobile mode

// ---- Load conversations when folder changes ----
watch(
  () => props.selectedFolder?.id,
  async (folderId) => {
    filterSearch.value = ''
    view.value = 'list'
    store.selectConversation(null)
    if (folderId) {
      await store.loadConversations({ newFilters: { folderId } })
    } else {
      store.clearAll()
    }
  },
  { immediate: true }
)

// ---- Client-side search ----
const filteredConversations = computed(() => {
  const term = filterSearch.value.toLowerCase().trim()
  if (!term) return store.conversations
  return store.conversations.filter(c =>
    c.subject.toLowerCase().includes(term) ||
    c.fromAddress.toLowerCase().includes(term) ||
    (c.id || '').toLowerCase().includes(term)
  )
})

// ---- Infinite scroll (IntersectionObserver) ----
const sentinelRef = ref(null)
let _observer = null

function _setupObserver() {
  _teardownObserver()
  nextTick(() => {
    if (!sentinelRef.value) return
    _observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && store.hasMore && !store.loadingMore) {
          store.loadMore()
        }
      },
      { rootMargin: '200px' }
    )
    _observer.observe(sentinelRef.value)
  })
}

function _teardownObserver() {
  if (_observer) {
    _observer.disconnect()
    _observer = null
  }
}

// Re-setup observer when list changes
watch(() => store.conversations.length, () => nextTick(_setupObserver))
watch(() => props.splitView, () => nextTick(_setupObserver))
onMounted(_setupObserver)
onUnmounted(_teardownObserver)

// ---- Detail / reading pane ----
async function openReading(conv) {
  if (!props.splitView) view.value = 'reading'
  await store.selectConversation(conv.id)
}

function backToList() {
  view.value = 'list'
  store.selectConversation(null)
}

// ---- Resizable split panel ----
const LIST_MIN = 240
const LIST_MAX = 480
const LIST_DEFAULT = 320
const listWidth = ref(parseInt(localStorage.getItem('tyflow_conv_list_width')) || LIST_DEFAULT)
let _resizing = false

function onResizeStart(e) {
  e.preventDefault()
  _resizing = true
  const startX = e.clientX
  const startW = listWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const onMove = (ev) => {
    const w = startW + (ev.clientX - startX)
    listWidth.value = Math.max(LIST_MIN, Math.min(LIST_MAX, w))
  }

  const onUp = () => {
    _resizing = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    localStorage.setItem('tyflow_conv_list_width', String(listWidth.value))
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onResizeDblClick() {
  listWidth.value = LIST_DEFAULT
  localStorage.setItem('tyflow_conv_list_width', String(LIST_DEFAULT))
}

// ---- Reading pane: expand to full width ----
const readingExpanded = ref(false)

function toggleReadingExpand() {
  readingExpanded.value = !readingExpanded.value
}

// ---- Reading pane: prev/next navigation ----
const currentIndex = computed(() => {
  if (!store.selectedConversation) return -1
  return filteredConversations.value.findIndex(c => c.id === store.selectedConversation.id)
})

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < filteredConversations.value.length - 1)

async function goToPrev() {
  if (!hasPrev.value) return
  const prev = filteredConversations.value[currentIndex.value - 1]
  await store.selectConversation(prev.id)
}

async function goToNext() {
  if (!hasNext.value) return
  const next = filteredConversations.value[currentIndex.value + 1]
  await store.selectConversation(next.id)
  // If near the end, trigger load more
  if (currentIndex.value + 1 >= filteredConversations.value.length - 3 && store.hasMore) {
    store.loadMore()
  }
}

// ---- Ingest ----
const showIngest = ref(false)
const ingestForm = ref({ subject: '', body: '', fromAddress: '', toAddress: '', externalId: '', tags: '', receivedAt: '' })
const ingestTriggerWdd = ref(false)
const ingestLoading = ref(false)
const ingestError = ref('')
const ingestSuccess = ref('')

function openIngest() {
  ingestForm.value = { subject: '', body: '', fromAddress: '', toAddress: '', externalId: '', tags: '', receivedAt: '' }
  ingestTriggerWdd.value = false
  ingestError.value = ''
  ingestSuccess.value = ''
  showIngest.value = true
}

async function submitIngest() {
  ingestLoading.value = true
  ingestError.value = ''
  ingestSuccess.value = ''
  try {
    const conv = {
      folder_id: props.selectedFolder.id,
      subject: ingestForm.value.subject || undefined,
      body: ingestForm.value.body || undefined,
      from_address: ingestForm.value.fromAddress || undefined,
      to_address: ingestForm.value.toAddress || undefined,
      external_id: ingestForm.value.externalId || undefined,
      tags: ingestForm.value.tags ? ingestForm.value.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      received_at: ingestForm.value.receivedAt || undefined,
    }
    const result = await store.ingest({ conversations: [conv], triggerWdd: ingestTriggerWdd.value })
    const r = result.results[0]
    if (r?.wddError) {
      ingestSuccess.value = `Creada. WDD: ${r.wddError}`
    } else if (r?.assignmentId) {
      ingestSuccess.value = `Creada y asignada (${r.assignmentId}).`
    } else {
      ingestSuccess.value = 'Conversacion creada.'
    }
    showIngest.value = false
  } catch (e) {
    ingestError.value = e.userMessage || e.message
  } finally {
    ingestLoading.value = false
  }
}

// ---- Helpers ----
function bodyPreview(body) {
  if (!body) return ''
  const clean = body.replace(/\s+/g, ' ').trim()
  return clean.length > 100 ? clean.slice(0, 100) + '...' : clean
}

function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function senderName(addr) {
  if (!addr) return 'Desconocido'
  const at = addr.indexOf('@')
  if (at === -1) return addr
  return addr.slice(0, at)
}
</script>

<template>
  <!-- No folder selected -->
  <div v-if="!selectedFolder" class="placeholder">
    <i class='bx bx-envelope-open placeholder__icon'></i>
    <p class="placeholder__title">Selecciona una carpeta</p>
    <p class="placeholder__subtitle">para ver sus conversaciones</p>
  </div>

  <!-- Folder selected -->
  <div v-else class="conv-panel" :class="{ 'conv-panel--wide': splitView }">

    <!-- ============================================================
         WIDE MODE: list + reading side by side (Outlook style)
         ============================================================ -->
    <template v-if="splitView">
      <!-- Left: mail list -->
      <div v-show="!readingExpanded" class="conv-list-col" :style="{ width: listWidth + 'px' }">
        <!-- Toolbar -->
        <div class="toolbar">
          <div class="toolbar__left">
            <h2 class="toolbar__title">{{ selectedFolder.name }}</h2>
            <span class="toolbar__count" v-if="store.total > 0">{{ store.total }}</span>
          </div>
          <div class="toolbar__right">
            <button v-if="authStore.isAdmin" @click="openIngest" class="toolbar__btn" title="Ingestar">
              <i class='bx bx-plus'></i>
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="search-bar">
          <i class='bx bx-search'></i>
          <input v-model="filterSearch" type="text" placeholder="Buscar..." class="search-bar__input">
        </div>

        <!-- Loading (initial) -->
        <div v-if="store.loading && store.conversations.length === 0" class="state">
          <i class='bx bx-loader-alt bx-spin'></i> Cargando...
        </div>

        <!-- Error -->
        <div v-else-if="store.error && store.conversations.length === 0" class="state state--error">
          <i class='bx bx-error-circle'></i> {{ store.error }}
        </div>

        <!-- Empty -->
        <div v-else-if="filteredConversations.length === 0 && !store.loading" class="state">
          <i class='bx bx-envelope'></i>
          {{ filterSearch.trim() ? 'Sin resultados.' : 'Carpeta vacía' }}
        </div>

        <!-- Mail list with infinite scroll -->
        <div v-else class="mail-list">
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="mail-item"
            :class="{
              'mail-item--dup': conv.isDuplicate,
              'mail-item--selected': store.selectedConversation?.id === conv.id,
            }"
            @click="openReading(conv)"
          >
            <div class="mail-item__accent"></div>
            <div class="mail-item__body">
              <div class="mail-item__top">
                <span class="mail-item__sender">{{ senderName(conv.fromAddress) }}</span>
                <span class="mail-item__date">{{ formatDateShort(conv.receivedAt) }}</span>
              </div>
              <div class="mail-item__subject">
                <span v-if="conv.isDuplicate" class="dup-badge">DUP</span>
                {{ conv.subject || '(Sin asunto)' }}
              </div>
              <div class="mail-item__preview">{{ bodyPreview(conv.body) }}</div>
            </div>
          </div>

          <!-- Sentinel for infinite scroll -->
          <div ref="sentinelRef" class="scroll-sentinel">
            <template v-if="store.loadingMore">
              <i class='bx bx-loader-alt bx-spin'></i> Cargando más...
            </template>
          </div>
        </div>

        <!-- Loaded count -->
        <div v-if="store.total > 0 && !store.loading" class="loaded-bar">
          <span class="loaded-bar__info">{{ store.conversations.length }} de {{ store.total }}</span>
        </div>

        <!-- Ingest success -->
        <div v-if="ingestSuccess" class="toast-banner" @click="ingestSuccess = ''">
          <i class='bx bx-check-circle'></i> {{ ingestSuccess }}
        </div>
      </div>

      <!-- Resize handle -->
      <div
        v-show="!readingExpanded"
        class="conv-resize-handle"
        @mousedown="onResizeStart"
        @dblclick="onResizeDblClick"
      ></div>

      <!-- Right: reading pane -->
      <div class="conv-reading-col">
        <!-- Reading toolbar with nav arrows + expand -->
        <div v-if="store.selectedConversation" class="reading-nav">
          <div class="reading-nav__left">
            <button class="reading-nav__btn" :disabled="!hasPrev" @click="goToPrev" title="Anterior">
              <i class='bx bx-chevron-up'></i>
            </button>
            <button class="reading-nav__btn" :disabled="!hasNext" @click="goToNext" title="Siguiente">
              <i class='bx bx-chevron-down'></i>
            </button>
            <span class="reading-nav__pos">{{ currentIndex + 1 }} / {{ filteredConversations.length }}</span>
          </div>
          <button class="reading-nav__btn" @click="toggleReadingExpand" :title="readingExpanded ? 'Mostrar lista' : 'Expandir lectura'">
            <i class='bx' :class="readingExpanded ? 'bx-collapse' : 'bx-expand'"></i>
          </button>
        </div>

        <div v-if="store.loadingDetail" class="state">
          <i class='bx bx-loader-alt bx-spin'></i> Cargando...
        </div>
        <template v-else-if="store.selectedConversation">
          <div class="reading">
            <div class="reading__header">
              <div class="reading__avatar"><i class='bx bx-user'></i></div>
              <div class="reading__header-info">
                <div class="reading__from">{{ store.selectedConversation.fromAddress || 'Desconocido' }}</div>
                <div class="reading__to">Para: {{ store.selectedConversation.toAddress || '—' }}</div>
                <div class="reading__date">{{ formatDateTime(store.selectedConversation.receivedAt) }}</div>
              </div>
              <code class="reading__id">{{ store.selectedConversation.id }}</code>
            </div>
            <h2 class="reading__subject">{{ store.selectedConversation.subject || '(Sin asunto)' }}</h2>
            <div v-if="store.selectedConversation.tags && store.selectedConversation.tags.length" class="reading__tags">
              <span v-for="tag in store.selectedConversation.tags" :key="tag" class="tag-chip tag-chip--lg">{{ tag }}</span>
            </div>
            <div v-if="store.selectedConversation.isDuplicate" class="reading__dup-warn">
              <i class='bx bx-copy'></i> Duplicada de <code>{{ store.selectedConversation.duplicateOf }}</code>
            </div>
            <div class="reading__body">{{ store.selectedConversation.body || '(Sin contenido)' }}</div>
            <div class="reading__meta">
              <div class="reading__meta-row">
                <span class="reading__meta-label">Folder</span>
                <code>{{ store.selectedConversation.folderId }}</code>
              </div>
              <div class="reading__meta-row">
                <span class="reading__meta-label">Extraido</span>
                <span>{{ formatDateTime(store.selectedConversation.extractedAt) }}</span>
              </div>
              <div v-if="store.selectedConversation.externalId" class="reading__meta-row">
                <span class="reading__meta-label">External ID</span>
                <span class="reading__meta-mono">{{ store.selectedConversation.externalId }}</span>
              </div>
            </div>
            <div class="reading__section">
              <h3 class="reading__section-title">
                <i class='bx bx-transfer-alt'></i> Asignaciones
                <i v-if="store.loadingAssignments" class='bx bx-loader-alt bx-spin'></i>
              </h3>
              <div v-if="store.selectedAssignments.length === 0 && !store.loadingAssignments" class="reading__empty">
                Sin asignaciones.
              </div>
              <div v-for="a in store.selectedAssignments" :key="a.id" class="assign-card">
                <div class="assign-card__top">
                  <code class="assign-card__id">{{ a.id }}</code>
                  <span class="assign-card__reason">{{ a.reasonLabel }}</span>
                  <span :class="a.isActive ? 'st--active' : 'st--inactive'">{{ a.isActive ? 'Activa' : 'Cerrada' }}</span>
                </div>
                <div class="assign-card__bottom">
                  <span>Especialista: <code>{{ a.specialistId }}</code></span>
                  <span v-if="a.createdAt"> &middot; {{ formatDateTime(a.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="reading-placeholder">
          <i class='bx bx-mail-send reading-placeholder__icon'></i>
          <p class="reading-placeholder__text">Selecciona un correo para leerlo</p>
        </div>
      </div>
    </template>

    <!-- ============================================================
         NARROW MODE: toggle between list and reading (current behavior)
         ============================================================ -->
    <template v-else>
      <!-- LIST VIEW -->
      <template v-if="view === 'list'">
        <div class="toolbar">
          <div class="toolbar__left">
            <h2 class="toolbar__title">{{ selectedFolder.name }}</h2>
            <span class="toolbar__count" v-if="store.total > 0">{{ store.total }}</span>
          </div>
          <div class="toolbar__right">
            <button v-if="authStore.isAdmin" @click="openIngest" class="toolbar__btn" title="Ingestar">
              <i class='bx bx-plus'></i>
            </button>
          </div>
        </div>

        <div class="search-bar">
          <i class='bx bx-search'></i>
          <input v-model="filterSearch" type="text" placeholder="Buscar conversaciones..." class="search-bar__input">
        </div>

        <div v-if="store.loading && store.conversations.length === 0" class="state">
          <i class='bx bx-loader-alt bx-spin'></i> Cargando...
        </div>
        <div v-else-if="store.error && store.conversations.length === 0" class="state state--error">
          <i class='bx bx-error-circle'></i> {{ store.error }}
        </div>
        <div v-else-if="filteredConversations.length === 0 && !store.loading" class="state">
          <i class='bx bx-envelope'></i>
          {{ filterSearch.trim() ? 'Sin resultados.' : 'Carpeta vacía' }}
        </div>

        <div v-else class="mail-list">
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="mail-item"
            :class="{ 'mail-item--dup': conv.isDuplicate }"
            @click="openReading(conv)"
          >
            <div class="mail-item__accent"></div>
            <div class="mail-item__body">
              <div class="mail-item__top">
                <span class="mail-item__sender">{{ senderName(conv.fromAddress) }}</span>
                <span class="mail-item__date">{{ formatDateShort(conv.receivedAt) }}</span>
              </div>
              <div class="mail-item__subject">
                <span v-if="conv.isDuplicate" class="dup-badge">DUP</span>
                {{ conv.subject || '(Sin asunto)' }}
              </div>
              <div class="mail-item__preview">{{ bodyPreview(conv.body) }}</div>
              <div v-if="conv.tags && conv.tags.length" class="mail-item__tags">
                <span v-for="tag in conv.tags.slice(0, 3)" :key="tag" class="tag-chip">{{ tag }}</span>
              </div>
            </div>
          </div>

          <!-- Sentinel for infinite scroll -->
          <div ref="sentinelRef" class="scroll-sentinel">
            <template v-if="store.loadingMore">
              <i class='bx bx-loader-alt bx-spin'></i> Cargando más...
            </template>
          </div>
        </div>

        <div v-if="store.total > 0 && !store.loading" class="loaded-bar">
          <span class="loaded-bar__info">{{ store.conversations.length }} de {{ store.total }}</span>
        </div>

        <div v-if="ingestSuccess" class="toast-banner" @click="ingestSuccess = ''">
          <i class='bx bx-check-circle'></i> {{ ingestSuccess }}
        </div>
      </template>

      <!-- READING VIEW (narrow) -->
      <template v-if="view === 'reading'">
        <div class="toolbar">
          <button @click="backToList" class="toolbar__back" title="Volver a la lista">
            <i class='bx bx-arrow-back'></i>
          </button>
          <span class="toolbar__breadcrumb">{{ selectedFolder.name }}</span>
        </div>

        <div v-if="store.loadingDetail" class="state">
          <i class='bx bx-loader-alt bx-spin'></i> Cargando...
        </div>

        <template v-else-if="store.selectedConversation">
          <div class="reading">
            <div class="reading__header">
              <div class="reading__avatar"><i class='bx bx-user'></i></div>
              <div class="reading__header-info">
                <div class="reading__from">{{ store.selectedConversation.fromAddress || 'Desconocido' }}</div>
                <div class="reading__to">Para: {{ store.selectedConversation.toAddress || '—' }}</div>
                <div class="reading__date">{{ formatDateTime(store.selectedConversation.receivedAt) }}</div>
              </div>
              <code class="reading__id">{{ store.selectedConversation.id }}</code>
            </div>
            <h2 class="reading__subject">{{ store.selectedConversation.subject || '(Sin asunto)' }}</h2>
            <div v-if="store.selectedConversation.tags && store.selectedConversation.tags.length" class="reading__tags">
              <span v-for="tag in store.selectedConversation.tags" :key="tag" class="tag-chip tag-chip--lg">{{ tag }}</span>
            </div>
            <div v-if="store.selectedConversation.isDuplicate" class="reading__dup-warn">
              <i class='bx bx-copy'></i> Duplicada de <code>{{ store.selectedConversation.duplicateOf }}</code>
            </div>
            <div class="reading__body">{{ store.selectedConversation.body || '(Sin contenido)' }}</div>
            <div class="reading__meta">
              <div class="reading__meta-row">
                <span class="reading__meta-label">Folder</span>
                <code>{{ store.selectedConversation.folderId }}</code>
              </div>
              <div class="reading__meta-row">
                <span class="reading__meta-label">Extraido</span>
                <span>{{ formatDateTime(store.selectedConversation.extractedAt) }}</span>
              </div>
              <div v-if="store.selectedConversation.externalId" class="reading__meta-row">
                <span class="reading__meta-label">External ID</span>
                <span class="reading__meta-mono">{{ store.selectedConversation.externalId }}</span>
              </div>
            </div>
            <div class="reading__section">
              <h3 class="reading__section-title">
                <i class='bx bx-transfer-alt'></i> Asignaciones
                <i v-if="store.loadingAssignments" class='bx bx-loader-alt bx-spin'></i>
              </h3>
              <div v-if="store.selectedAssignments.length === 0 && !store.loadingAssignments" class="reading__empty">
                Sin asignaciones.
              </div>
              <div v-for="a in store.selectedAssignments" :key="a.id" class="assign-card">
                <div class="assign-card__top">
                  <code class="assign-card__id">{{ a.id }}</code>
                  <span class="assign-card__reason">{{ a.reasonLabel }}</span>
                  <span :class="a.isActive ? 'st--active' : 'st--inactive'">{{ a.isActive ? 'Activa' : 'Cerrada' }}</span>
                </div>
                <div class="assign-card__bottom">
                  <span>Especialista: <code>{{ a.specialistId }}</code></span>
                  <span v-if="a.createdAt"> &middot; {{ formatDateTime(a.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>

    <!-- Ingest modal -->
    <Teleport to="body">
      <div v-if="showIngest" class="modal-overlay" @click.self="showIngest = false">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Ingestar en "{{ selectedFolder.name }}"</h2>
            <button @click="showIngest = false" class="btn-close"><i class='bx bx-x'></i></button>
          </div>
          <form @submit.prevent="submitIngest" class="modal-form" autocomplete="off">
            <div class="form-grid">
              <div class="form-group form-group--full">
                <label>Asunto</label>
                <input v-model="ingestForm.subject" type="text" class="form-input" :disabled="ingestLoading">
              </div>
              <div class="form-group form-group--full">
                <label>Cuerpo</label>
                <textarea v-model="ingestForm.body" class="form-input form-input--textarea" rows="4" :disabled="ingestLoading"></textarea>
              </div>
              <div class="form-group">
                <label>Remitente</label>
                <input v-model="ingestForm.fromAddress" type="email" class="form-input" placeholder="user@empresa.com" :disabled="ingestLoading">
              </div>
              <div class="form-group">
                <label>Destinatario</label>
                <input v-model="ingestForm.toAddress" type="email" class="form-input" placeholder="soporte@empresa.com" :disabled="ingestLoading">
              </div>
              <div class="form-group">
                <label>External ID</label>
                <input v-model="ingestForm.externalId" type="text" class="form-input" :disabled="ingestLoading">
              </div>
              <div class="form-group">
                <label>Etiquetas (coma)</label>
                <input v-model="ingestForm.tags" type="text" class="form-input" placeholder="urgente, login" :disabled="ingestLoading">
              </div>
              <div class="form-group">
                <label>Fecha recepcion</label>
                <input v-model="ingestForm.receivedAt" type="datetime-local" class="form-input" :disabled="ingestLoading">
              </div>
              <div class="form-group">
                <label class="chk-label">
                  <input type="checkbox" v-model="ingestTriggerWdd" :disabled="ingestLoading">
                  Asignar via WDD
                </label>
              </div>
            </div>
            <div v-if="ingestError" class="form-error">
              <i class='bx bx-error-circle'></i> {{ ingestError }}
            </div>
            <div class="modal-actions">
              <button type="button" @click="showIngest = false" class="btn-secondary" :disabled="ingestLoading">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="ingestLoading">
                <i v-if="ingestLoading" class='bx bx-loader-alt bx-spin'></i>
                {{ ingestLoading ? 'Enviando...' : 'Ingestar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== Placeholder ===== */
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
  padding: 1.25rem;
  max-width: 280px;
}
.placeholder__icon { font-size: 2rem; color: var(--text-secondary); opacity: 0.3; }
.placeholder__title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
.placeholder__subtitle { font-size: 0.8rem; color: var(--text-secondary); }

/* ===== Panel shell ===== */
.conv-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main);
}

/* ===== Wide mode: side-by-side layout ===== */
.conv-panel--wide {
  flex-direction: row;
}

.conv-list-col {
  min-width: 240px;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

/* ===== Resize handle between list and reading ===== */
.conv-resize-handle {
  width: 6px;
  margin-left: -3px;
  margin-right: -3px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  background: transparent;
  transition: background 0.15s;
  border-left: 1px solid var(--border-light);
}

.conv-resize-handle:hover,
.conv-resize-handle:active {
  background: rgba(42, 199, 143, 0.4);
}

.conv-reading-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ===== Reading nav toolbar ===== */
.reading-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  background: var(--bg-main);
}

.reading-nav__left {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.reading-nav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.12s;
}

.reading-nav__btn:hover:not(:disabled) {
  border-color: var(--primary-500);
  color: var(--primary-500);
}

.reading-nav__btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.reading-nav__pos {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-left: 0.3rem;
  font-weight: 500;
}

/* ===== Reading placeholder (wide mode) ===== */
.reading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 0.5rem;
  color: var(--text-secondary);
  opacity: 0.4;
}
.reading-placeholder__icon { font-size: 2.5rem; }
.reading-placeholder__text { font-size: 0.85rem; font-weight: 500; }

/* ===== Toolbar ===== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.toolbar__left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.toolbar__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar__count {
  font-size: 0.65rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  background: var(--primary-500);
  color: white;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  padding: 0 6px;
}

.toolbar__right {
  display: flex;
  gap: 0.25rem;
}

.toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 24px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: white;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
}
.toolbar__btn:hover { border-color: var(--primary-500); color: var(--primary-500); }

.toolbar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px; height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.15rem;
  transition: all 0.15s;
  margin-right: 0.4rem;
}
.toolbar__back:hover { color: var(--primary-500); background: var(--bg-card); }

.toolbar__breadcrumb {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ===== Search ===== */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.3rem 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  flex-shrink: 0;
}
.search-bar i { color: var(--text-secondary); font-size: 0.85rem; }
.search-bar__input {
  border: none; outline: none; width: 100%;
  font-size: 0.8rem; color: var(--text-primary); background: transparent;
}

/* ===== States ===== */
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 1.5rem 0.75rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  flex: 1;
}
.state i { font-size: 1.2rem; }
.state--error { color: var(--error-text); }

/* ===== Mail list (Outlook style) ===== */
.mail-list {
  flex: 1;
  overflow-y: auto;
}

.mail-item {
  display: flex;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  transition: background 0.1s;
  position: relative;
}

.mail-item:hover { background: #F8F9FA; }

.mail-item--selected {
  background: rgba(42, 199, 143, 0.08);
}
.mail-item--selected .mail-item__accent {
  opacity: 1;
}

.mail-item__accent {
  width: 3px;
  flex-shrink: 0;
  background: var(--primary-500);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.mail-item:hover .mail-item__accent { opacity: 0.5; }

.mail-item--dup { opacity: 0.5; }

.mail-item__body {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
}

.mail-item__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1px;
}

.mail-item__sender {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mail-item__date {
  font-size: 0.7rem;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.mail-item__subject {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.mail-item__preview {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  margin-top: 1px;
}

.mail-item__tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.dup-badge {
  display: inline-block;
  font-size: 0.58rem;
  font-weight: 700;
  background: #FEF3C7;
  color: #92400E;
  padding: 0 4px;
  border-radius: 3px;
  margin-right: 3px;
  vertical-align: middle;
}

.tag-chip {
  font-size: 0.62rem;
  font-weight: 600;
  background: rgba(42, 199, 143, 0.1);
  color: var(--primary-700);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.tag-chip--lg { font-size: 0.72rem; padding: 2px 9px; }

/* ===== Infinite scroll sentinel ===== */
.scroll-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  min-height: 1px;
}

/* ===== Loaded bar (replaces pagination) ===== */
.loaded-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.75rem;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
.loaded-bar__info { font-size: 0.7rem; color: var(--text-secondary); }

/* ===== Toast ===== */
.toast-banner {
  position: absolute;
  bottom: 2.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success-bg);
  color: var(--success-text);
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius-md);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  box-shadow: var(--shadow-sm);
  z-index: 10;
  white-space: nowrap;
}

/* ============ READING PANE ============ */
.reading {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.reading__header {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.reading__avatar {
  width: 30px; height: 30px;
  border-radius: var(--radius-full);
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 1.1rem;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
}

.reading__header-info {
  flex: 1;
  min-width: 0;
}

.reading__from {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary);
  word-break: break-all;
}

.reading__to {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.reading__date {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.reading__id {
  font-size: 0.7rem;
  color: var(--primary-500);
  background: rgba(42, 199, 143, 0.08);
  padding: 2px 7px;
  border-radius: 3px;
  flex-shrink: 0;
  align-self: flex-start;
}

.reading__subject {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
}

.reading__tags { display: flex; gap: 6px; flex-wrap: wrap; }

.reading__dup-warn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  background: #FEF3C7;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  color: #92400E;
  font-weight: 600;
}
.reading__dup-warn code { background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 3px; }

.reading__body {
  font-size: 0.82rem;
  color: var(--text-primary);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0.65rem;
  background: var(--bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  min-height: 60px;
}

.reading__meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.5rem;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
}

.reading__meta-row {
  display: flex;
  gap: 0.5rem;
}

.reading__meta-label {
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 70px;
}

.reading__meta-mono { font-family: monospace; font-size: 0.72rem; word-break: break-all; }

/* ===== Assignments ===== */
.reading__section {
  border-top: 1px solid var(--border-light);
  padding-top: 0.75rem;
}

.reading__section-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
}
.reading__section-title i { font-size: 1rem; }

.reading__empty { font-size: 0.82rem; color: var(--text-secondary); }

.assign-card {
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  padding: 0.6rem 0.75rem;
  font-size: 0.78rem;
}
.assign-card + .assign-card { margin-top: 0.4rem; }

.assign-card__top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.assign-card__id {
  font-size: 0.72rem;
  color: var(--primary-500);
  background: rgba(42, 199, 143, 0.08);
  padding: 1px 5px;
  border-radius: 3px;
}

.assign-card__reason {
  font-size: 0.68rem;
  font-weight: 600;
  background: rgba(96, 125, 234, 0.1);
  color: #607dea;
  padding: 1px 7px;
  border-radius: var(--radius-full);
}

.st--active { font-weight: 600; color: var(--success-text); font-size: 0.72rem; }
.st--inactive { color: var(--text-secondary); font-size: 0.72rem; }

.assign-card__bottom {
  color: var(--text-secondary);
}

/* ===== Ingest modal ===== */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center;
  z-index: 300; overflow-y: auto; padding: 1.25rem 0.75rem;
}
.modal-content {
  background: var(--bg-main); width: 100%; max-width: 520px;
  border-radius: var(--radius-lg); padding: 1.25rem;
  box-shadow: var(--shadow-lg); margin: auto;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;
}
.modal-header h2 { font-size: 0.95rem; font-weight: 700; }
.btn-close { background: transparent; border: none; font-size: 1.3rem; color: var(--text-secondary); cursor: pointer; }

.modal-form { display: flex; flex-direction: column; gap: 0.75rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.2rem; display: block; }
.form-group--full { grid-column: 1 / -1; }
.form-input {
  width: 100%; padding: 0.45rem; border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-primary);
}
.form-input:focus { outline: none; border-color: var(--primary-500); }
.form-input--textarea { resize: vertical; min-height: 70px; font-family: inherit; }
.form-input:disabled { background-color: var(--bg-card); opacity: 0.7; cursor: not-allowed; }

.chk-label {
  display: flex !important; align-items: center; gap: 0.5rem; cursor: pointer; padding-top: 1rem;
}
.chk-label input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--primary-500); }

.form-error {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.6rem 0.8rem; background-color: var(--error-bg);
  color: var(--error-text); border-radius: var(--radius-sm);
  font-size: 0.82rem; font-weight: 600;
}
.form-error i { font-size: 1rem; flex-shrink: 0; }

.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }

.btn-secondary {
  padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600;
  border: 1px solid var(--border-light); color: var(--text-primary);
  background: white; border-radius: var(--radius-md); cursor: pointer;
}
.btn-primary {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.5rem 1rem; background: var(--primary-500); color: white;
  font-weight: 600; font-size: 0.85rem; border: none;
  border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: var(--primary-600); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .modal-content { padding: 1rem; }
  .form-grid { grid-template-columns: 1fr; }
  .reading { padding: 0.5rem; }
  .conv-resize-handle { display: none; }
}
</style>
