<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/presentation/stores/useSettingsStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useSettingsStore()
const userStore = useUserStore()

const saving = ref(false)
const toast = ref(null)  // { type: 'success'|'error', text }
let toastTimer = null

function showToast(type, text) {
  clearTimeout(toastTimer)
  toast.value = { type, text }
  toastTimer = setTimeout(() => { toast.value = null }, 3000)
}

// ── Create forms ──
const showNewLevel = ref(false)
const newLevelName = ref('')
const newLevelDesc = ref('')
const showNewCategory = ref(false)
const newCatName = ref('')
const newCatDesc = ref('')

// ── Inline edit ──
const editingLevelId = ref(null)
const editLevelName = ref('')
const editLevelDesc = ref('')
const editingCatId = ref(null)
const editCatName = ref('')
const editCatDesc = ref('')

const applications = computed(() => userStore.applications ?? [])

// ── Pending local state (batch save) ──
const pendingLevelIds = ref(null)    // null = no pending changes
const pendingCategoryIds = ref(null) // null = no pending changes

const expandedLevelId = ref(null)

// Committed pivot IDs
const committedLevelIds = computed(() => store.appLevelPivots.map(p => p.support_level_id))
const committedCategoryIds = computed(() => store.levelCategoryPivots.map(p => p.support_category_id))

// Effective IDs shown in UI (pending or committed)
const effectiveLevelIds = computed(() => pendingLevelIds.value ?? committedLevelIds.value)
const effectiveCategoryIds = computed(() => pendingCategoryIds.value ?? committedCategoryIds.value)

const hasLevelChanges = computed(() => pendingLevelIds.value !== null)
const hasCategoryChanges = computed(() => pendingCategoryIds.value !== null)

// ── Bulk select computeds ──
const allLevelsSelected = computed(() =>
  store.supportLevels.length > 0 &&
  store.supportLevels.every(lv => effectiveLevelIds.value.includes(lv.id))
)
const noLevelsSelected = computed(() =>
  store.supportLevels.every(lv => !effectiveLevelIds.value.includes(lv.id))
)
const allCategoriesSelected = computed(() =>
  store.supportCategories.length > 0 &&
  store.supportCategories.every(cat => effectiveCategoryIds.value.includes(cat.id))
)
const noCategoriesSelected = computed(() =>
  store.supportCategories.every(cat => !effectiveCategoryIds.value.includes(cat.id))
)

// ── Undo state for bulk ops ──
const _prevLevelIds    = ref(null)
const _prevCategoryIds = ref(null)
let _levelUndoTimer    = null
let _catUndoTimer      = null

function _snapshotLevels() {
  _prevLevelIds.value = [...effectiveLevelIds.value]
  clearTimeout(_levelUndoTimer)
  _levelUndoTimer = setTimeout(() => { _prevLevelIds.value = null }, 8_000)
}

function _snapshotCategories() {
  _prevCategoryIds.value = [...effectiveCategoryIds.value]
  clearTimeout(_catUndoTimer)
  _catUndoTimer = setTimeout(() => { _prevCategoryIds.value = null }, 8_000)
}

function selectAllLevels() {
  _snapshotLevels()
  pendingLevelIds.value = store.supportLevels.map(lv => lv.id)
}
function selectNoneLevels() {
  _snapshotLevels()
  pendingLevelIds.value = []
}
function undoLevels() {
  if (_prevLevelIds.value === null) return
  pendingLevelIds.value = _prevLevelIds.value
  _prevLevelIds.value = null
  clearTimeout(_levelUndoTimer)
}

function selectAllCategories() {
  _snapshotCategories()
  pendingCategoryIds.value = store.supportCategories.map(cat => cat.id)
}
function selectNoneCategories() {
  _snapshotCategories()
  pendingCategoryIds.value = []
}
function undoCategories() {
  if (_prevCategoryIds.value === null) return
  pendingCategoryIds.value = _prevCategoryIds.value
  _prevCategoryIds.value = null
  clearTimeout(_catUndoTimer)
}

function _onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (_prevCategoryIds.value !== null) {
      e.preventDefault()
      undoCategories()
    } else if (_prevLevelIds.value !== null) {
      e.preventDefault()
      undoLevels()
    }
  }
}

onMounted(()  => window.addEventListener('keydown', _onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', _onKeydown)
  clearTimeout(_levelUndoTimer)
  clearTimeout(_catUndoTimer)
})

function selectApp(appId) {
  store.loadAppLevels(appId)
  pendingLevelIds.value = null
  pendingCategoryIds.value = null
  _prevLevelIds.value = null
  _prevCategoryIds.value = null
  expandedLevelId.value = null
  toast.value = null
}

function expandLevel(levelId) {
  if (expandedLevelId.value === levelId) {
    expandedLevelId.value = null
    pendingCategoryIds.value = null
    _prevCategoryIds.value = null
    return
  }
  pendingCategoryIds.value = null
  _prevCategoryIds.value = null
  expandedLevelId.value = levelId
  store.loadLevelCategories(levelId)
}

// ── Local toggles (no API call) ──
function toggleLevel(levelId) {
  const current = [...effectiveLevelIds.value]
  const idx = current.indexOf(levelId)
  if (idx !== -1) {
    current.splice(idx, 1)
    if (expandedLevelId.value === levelId) {
      expandedLevelId.value = null
      pendingCategoryIds.value = null
    }
  } else {
    current.push(levelId)
  }
  pendingLevelIds.value = current
}

function toggleCategory(categoryId) {
  const current = [...effectiveCategoryIds.value]
  const idx = current.indexOf(categoryId)
  if (idx !== -1) current.splice(idx, 1)
  else current.push(categoryId)
  pendingCategoryIds.value = current
}

// ── Batch save ──
async function saveLevels() {
  if (!pendingLevelIds.value || !store.selectedAppId) return
  saving.value = true
  try {
    await store.syncAppLevels(store.selectedAppId, pendingLevelIds.value)
    pendingLevelIds.value = null
    _prevLevelIds.value = null
    showToast('success', 'Niveles guardados correctamente.')
  } catch {
    showToast('error', store.error || 'Error guardando niveles')
  } finally {
    saving.value = false
  }
}

async function saveCategories() {
  if (!pendingCategoryIds.value || !expandedLevelId.value) return
  saving.value = true
  try {
    await store.syncLevelCategories(expandedLevelId.value, pendingCategoryIds.value)
    pendingCategoryIds.value = null
    _prevCategoryIds.value = null
    showToast('success', 'Categorías guardadas correctamente.')
  } catch {
    showToast('error', store.error || 'Error guardando categorías')
  } finally {
    saving.value = false
  }
}

// ── Create new level ──
async function handleCreateLevel() {
  if (!newLevelName.value.trim()) return
  saving.value = true
  try {
    const created = await store.createSupportLevel({
      name: newLevelName.value.trim(),
      description: newLevelDesc.value.trim() || null,
    })
    if (store.selectedAppId) {
      const ids = [...effectiveLevelIds.value, created.id]
      await store.syncAppLevels(store.selectedAppId, ids)
      pendingLevelIds.value = null
    }
    newLevelName.value = ''
    newLevelDesc.value = ''
    showNewLevel.value = false
    showToast('success', 'Nivel creado y vinculado.')
  } catch (e) {
    showToast('error', e.response?.data?.detail || e.message || 'Error creando nivel')
  } finally {
    saving.value = false
  }
}

// ── Create new category ──
async function handleCreateCategory() {
  if (!newCatName.value.trim()) return
  saving.value = true
  try {
    const created = await store.createSupportCategory({
      name: newCatName.value.trim(),
      description: newCatDesc.value.trim() || null,
    })
    if (expandedLevelId.value) {
      const ids = [...effectiveCategoryIds.value, created.id]
      await store.syncLevelCategories(expandedLevelId.value, ids)
      pendingCategoryIds.value = null
    }
    newCatName.value = ''
    newCatDesc.value = ''
    showNewCategory.value = false
    showToast('success', 'Categoría creada y vinculada.')
  } catch (e) {
    showToast('error', e.response?.data?.detail || e.message || 'Error creando categoría')
  } finally {
    saving.value = false
  }
}

// ── Inline edit level ──
function startEditLevel(lv) {
  editingLevelId.value = lv.id
  editLevelName.value = lv.name
  editLevelDesc.value = lv.description || ''
}

async function saveEditLevel(id) {
  if (!editLevelName.value.trim()) return
  saving.value = true
  try {
    await store.updateSupportLevel(id, {
      name: editLevelName.value.trim(),
      description: editLevelDesc.value.trim() || null,
    })
    editingLevelId.value = null
    showToast('success', 'Nivel actualizado.')
  } catch (e) {
    showToast('error', e.response?.data?.detail || e.message || 'Error')
  } finally {
    saving.value = false
  }
}

// ── Inline edit category ──
function startEditCat(cat) {
  editingCatId.value = cat.id
  editCatName.value = cat.name
  editCatDesc.value = cat.description || ''
}

async function saveEditCat(id) {
  if (!editCatName.value.trim()) return
  saving.value = true
  try {
    await store.updateSupportCategory(id, {
      name: editCatName.value.trim(),
      description: editCatDesc.value.trim() || null,
    })
    editingCatId.value = null
    showToast('success', 'Categoría actualizada.')
  } catch (e) {
    showToast('error', e.response?.data?.detail || e.message || 'Error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="sh">
    <!-- Fixed toast — no layout shift -->
    <Transition name="sh-toast">
      <div
        v-if="toast"
        class="sh__toast"
        :class="toast.type === 'success' ? 'sh__toast--ok' : 'sh__toast--err'"
      >
        <i :class="toast.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
        {{ toast.text }}
      </div>
    </Transition>

    <div class="sh__header">
      <div>
        <h2 class="sh__heading">Jerarquía de Soporte</h2>
        <p class="sh__desc">Gestiona la relación Aplicación → Niveles → Categorías.</p>
      </div>
    </div>

    <!-- Step 1: Select Application -->
    <div class="sh__step">
      <label class="sh__step-label"><i class="bx bx-cube"></i> Aplicación</label>
      <div v-if="userStore.loadingSelects" class="sh__loading">
        <i class="bx bx-loader-alt bx-spin"></i> Cargando...
      </div>
      <select v-else class="sh__select" :value="store.selectedAppId ?? ''" @change="selectApp($event.target.value || null)">
        <option value="">— Seleccionar aplicación —</option>
        <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
      </select>
    </div>

    <!-- Step 2: Levels for selected app -->
    <template v-if="store.selectedAppId">
      <div class="sh__section">
        <div class="sh__section-header">
          <span class="sh__section-title"><i class="bx bx-layer"></i> Niveles de soporte</span>
          <div class="sh__section-actions">
            <div v-if="store.supportLevels.length > 1" class="sh__bulk">
              <button type="button" class="sh__bulk-btn" :disabled="allLevelsSelected" @click="selectAllLevels">Todos</button>
              <span class="sh__bulk-sep">/</span>
              <button type="button" class="sh__bulk-btn" :disabled="noLevelsSelected" @click="selectNoneLevels">Ninguno</button>
            </div>
            <!-- Guardar niveles -->
            <button
              v-if="hasLevelChanges"
              class="sh__save-levels-btn"
              :disabled="saving"
              @click="saveLevels"
            >
              <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-save'"></i>
              Guardar
            </button>
            <button class="sh__add-btn" @click="showNewLevel = !showNewLevel">
              <i class="bx" :class="showNewLevel ? 'bx-x' : 'bx-plus'"></i>
              {{ showNewLevel ? 'Cancelar' : 'Nuevo' }}
            </button>
          </div>
        </div>

        <!-- Create level form -->
        <div v-if="showNewLevel" class="sh__inline-form">
          <input v-model="newLevelName" type="text" class="sh__input" placeholder="Nombre del nivel" />
          <input v-model="newLevelDesc" type="text" class="sh__input sh__input--sm" placeholder="Descripción (opcional)" />
          <button class="sh__save-btn" :disabled="!newLevelName.trim() || saving" @click="handleCreateLevel">
            <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-check'"></i>
          </button>
        </div>

        <div v-if="store.loadingPivots && !store.appLevelPivots.length" class="sh__loading">
          <i class="bx bx-loader-alt bx-spin"></i> Cargando...
        </div>

        <!-- All levels with toggle -->
        <div class="sh__items">
          <div v-for="lv in store.supportLevels" :key="lv.id" class="sh__item-group">
            <div class="sh__item" :class="{ 'sh__item--linked': effectiveLevelIds.includes(lv.id), 'sh__item--pending': pendingLevelIds !== null && effectiveLevelIds.includes(lv.id) !== committedLevelIds.includes(lv.id) }">
              <!-- Edit mode -->
              <template v-if="editingLevelId === lv.id">
                <div class="sh__edit-row">
                  <input v-model="editLevelName" class="sh__input" placeholder="Nombre" />
                  <input v-model="editLevelDesc" class="sh__input sh__input--sm" placeholder="Descripción" />
                  <button class="sh__icon-btn" @click="editingLevelId = null"><i class="bx bx-x"></i></button>
                  <button class="sh__icon-btn sh__icon-btn--ok" :disabled="saving || !editLevelName.trim()" @click="saveEditLevel(lv.id)">
                    <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-check'"></i>
                  </button>
                </div>
              </template>
              <!-- Display mode -->
              <template v-else>
                <button class="sh__toggle" @click="toggleLevel(lv.id)">
                  <i class="bx" :class="effectiveLevelIds.includes(lv.id) ? 'bx-check-square' : 'bx-square'"></i>
                </button>
                <div
                  class="sh__item-info"
                  :class="{ 'sh__item-info--clickable': effectiveLevelIds.includes(lv.id) }"
                  @click="effectiveLevelIds.includes(lv.id) ? expandLevel(lv.id) : null"
                >
                  <span class="sh__item-name">{{ lv.name }}</span>
                  <span v-if="lv.description" class="sh__item-desc">{{ lv.description }}</span>
                </div>
                <button class="sh__icon-btn" @click="startEditLevel(lv)"><i class="bx bx-pencil"></i></button>
                <i
                  v-if="effectiveLevelIds.includes(lv.id)"
                  class="bx sh__chevron"
                  :class="expandedLevelId === lv.id ? 'bx-chevron-up' : 'bx-chevron-down'"
                  @click="expandLevel(lv.id)"
                ></i>
              </template>
            </div>

            <!-- Expanded: categories for this level -->
            <div v-if="expandedLevelId === lv.id && effectiveLevelIds.includes(lv.id)" class="sh__sub">
              <div class="sh__sub-header">
                <span class="sh__sub-title"><i class="bx bx-category"></i> Categorías de "{{ lv.name }}"</span>
                <div class="sh__section-actions">
                  <div v-if="store.supportCategories.length > 1" class="sh__bulk">
                    <button type="button" class="sh__bulk-btn sh__bulk-btn--sm" :disabled="allCategoriesSelected" @click="selectAllCategories">Todos</button>
                    <span class="sh__bulk-sep">/</span>
                    <button type="button" class="sh__bulk-btn sh__bulk-btn--sm" :disabled="noCategoriesSelected" @click="selectNoneCategories">Ninguno</button>
                  </div>
                  <!-- Guardar categorías -->
                  <button
                    v-if="hasCategoryChanges"
                    class="sh__save-levels-btn sh__save-levels-btn--sm"
                    :disabled="saving"
                    @click="saveCategories"
                  >
                    <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-save'"></i>
                    Guardar
                  </button>
                  <button class="sh__add-btn sh__add-btn--sm" @click="showNewCategory = !showNewCategory">
                    <i class="bx" :class="showNewCategory ? 'bx-x' : 'bx-plus'"></i>
                  </button>
                </div>
              </div>

              <!-- Create category form -->
              <div v-if="showNewCategory" class="sh__inline-form">
                <input v-model="newCatName" type="text" class="sh__input" placeholder="Nombre de categoría" />
                <input v-model="newCatDesc" type="text" class="sh__input sh__input--sm" placeholder="Descripción (opcional)" />
                <button class="sh__save-btn" :disabled="!newCatName.trim() || saving" @click="handleCreateCategory">
                  <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-check'"></i>
                </button>
              </div>

              <div v-if="store.loadingPivots && !store.levelCategoryPivots.length" class="sh__loading">
                <i class="bx bx-loader-alt bx-spin"></i>
              </div>

              <div class="sh__items sh__items--nested">
                <div
                  v-for="cat in store.supportCategories"
                  :key="cat.id"
                  class="sh__item"
                  :class="{ 'sh__item--linked': effectiveCategoryIds.includes(cat.id) }"
                >
                  <!-- Edit mode -->
                  <template v-if="editingCatId === cat.id">
                    <div class="sh__edit-row">
                      <input v-model="editCatName" class="sh__input" placeholder="Nombre" />
                      <input v-model="editCatDesc" class="sh__input sh__input--sm" placeholder="Descripción" />
                      <button class="sh__icon-btn" @click="editingCatId = null"><i class="bx bx-x"></i></button>
                      <button class="sh__icon-btn sh__icon-btn--ok" :disabled="saving || !editCatName.trim()" @click="saveEditCat(cat.id)">
                        <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-check'"></i>
                      </button>
                    </div>
                  </template>
                  <!-- Display mode -->
                  <template v-else>
                    <button class="sh__toggle" @click="toggleCategory(cat.id)">
                      <i class="bx" :class="effectiveCategoryIds.includes(cat.id) ? 'bx-check-square' : 'bx-square'"></i>
                    </button>
                    <div class="sh__item-info">
                      <span class="sh__item-name">{{ cat.name }}</span>
                      <span v-if="cat.description" class="sh__item-desc">{{ cat.description }}</span>
                    </div>
                    <button class="sh__icon-btn" @click="startEditCat(cat)"><i class="bx bx-pencil"></i></button>
                  </template>
                </div>
              </div>

              <transition name="undo-fade">
                <button v-if="_prevCategoryIds !== null" type="button" class="sh__undo-btn" @click="undoCategories">
                  <i class='bx bx-undo'></i> Deshacer
                </button>
              </transition>
            </div>
          </div>
        </div>

        <transition name="undo-fade">
          <button v-if="_prevLevelIds !== null" type="button" class="sh__undo-btn" @click="undoLevels">
            <i class='bx bx-undo'></i> Deshacer
          </button>
        </transition>

        <div v-if="!store.loadingPivots && store.supportLevels.length === 0" class="sh__empty">
          No hay niveles de soporte. Crea uno primero.
        </div>
      </div>
    </template>

    <div v-else class="sh__hint">
      <i class="bx bx-info-circle"></i> Selecciona una aplicación para gestionar su jerarquía.
    </div>
  </section>
</template>

<style scoped>
.sh__header { margin-bottom: 1rem; }
.sh__heading { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem; }
.sh__desc { font-size: 0.82rem; color: var(--text-secondary); }

/* Fixed toast — no layout shift */
.sh__toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  pointer-events: none;
}
.sh__toast--ok { background: var(--success-bg); color: var(--success-text); }
.sh__toast--err { background: var(--error-bg); color: var(--error-text); }

.sh-toast-enter-active, .sh-toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.sh-toast-enter-from { opacity: 0; transform: translateY(8px); }
.sh-toast-leave-to { opacity: 0; transform: translateY(8px); }

/* Step */
.sh__step { margin-bottom: 1rem; }
.sh__step-label {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;
}
.sh__select {
  width: 100%; padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-light); border-radius: var(--radius-md);
  font-size: 0.85rem; color: var(--text-primary); background: var(--bg-card); outline: none;
}
.sh__select:focus { border-color: var(--primary-500); }

/* Section */
.sh__section { margin-bottom: 1.25rem; }
.sh__section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.65rem;
}
.sh__section-title {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.78rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.04em;
}
.sh__section-actions {
  display: flex; align-items: center; gap: 0.4rem;
}

.sh__save-levels-btn {
  display: flex; align-items: center; gap: 0.2rem;
  padding: 0.3rem 0.6rem; background: var(--primary-500); color: white;
  font-size: 0.72rem; font-weight: 600; border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.12s;
}
.sh__save-levels-btn:hover:not(:disabled) { background: var(--primary-600); }
.sh__save-levels-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sh__save-levels-btn--sm { padding: 0.2rem 0.45rem; font-size: 0.68rem; }

.sh__add-btn {
  display: flex; align-items: center; gap: 0.2rem;
  padding: 0.3rem 0.6rem;
  background: var(--bg-card); color: var(--text-secondary);
  font-size: 0.72rem; font-weight: 600;
  border: 1px solid var(--border-light); border-radius: var(--radius-md);
  cursor: pointer; transition: all 0.12s;
}
.sh__add-btn:hover { border-color: var(--primary-500); color: var(--primary-500); }
.sh__add-btn--sm { padding: 0.2rem 0.45rem; font-size: 0.68rem; }

/* Inline form */
.sh__inline-form {
  display: flex; gap: 0.4rem; align-items: center;
  margin-bottom: 0.65rem; padding: 0.5rem;
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.sh__input {
  flex: 1; min-width: 0;
  padding: 0.4rem 0.55rem; border: 1px solid var(--border-light);
  border-radius: var(--radius-sm); font-size: 0.8rem;
  color: var(--text-primary); background: var(--bg-main); outline: none;
}
.sh__input:focus { border-color: var(--primary-500); }
.sh__input--sm { flex: 0.7; }
.sh__save-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  background: var(--primary-500); color: white; border: none; cursor: pointer;
  flex-shrink: 0; font-size: 1rem;
}
.sh__save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Items list */
.sh__items { display: flex; flex-direction: column; gap: 0.25rem; }
.sh__items--nested { margin-top: 0.35rem; }
.sh__item-group { display: flex; flex-direction: column; }

.sh__item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  background: var(--bg-card); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); transition: border-color 0.12s;
}
.sh__item--linked { border-left: 3px solid var(--primary-500); }
.sh__item--pending { border-left: 3px solid var(--primary-500); opacity: 0.75; }

.sh__toggle {
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary); font-size: 1.15rem;
  display: flex; align-items: center; flex-shrink: 0;
  transition: color 0.12s;
}
.sh__item--linked .sh__toggle { color: var(--primary-500); }

.sh__item-info {
  display: flex; flex-direction: column; gap: 0.05rem;
  min-width: 0; flex: 1;
}
.sh__item-info--clickable { cursor: pointer; }
.sh__item-name { font-size: 0.84rem; font-weight: 600; color: var(--text-primary); }
.sh__item-desc { font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sh__icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  background: none; border: none; cursor: pointer;
  color: var(--text-secondary); font-size: 0.9rem;
  flex-shrink: 0; transition: all 0.12s;
}
.sh__icon-btn:hover { background: var(--bg-main); color: var(--text-primary); }
.sh__icon-btn--ok { color: var(--primary-500); }
.sh__icon-btn--ok:hover { background: rgba(42, 199, 143, 0.1); }
.sh__icon-btn--ok:disabled { opacity: 0.4; cursor: not-allowed; }

.sh__chevron {
  font-size: 1rem; color: var(--text-secondary);
  cursor: pointer; flex-shrink: 0; transition: color 0.12s;
}
.sh__chevron:hover { color: var(--text-primary); }

/* Edit row */
.sh__edit-row {
  display: flex; align-items: center; gap: 0.35rem;
  flex: 1; min-width: 0;
}

/* Sub-section (categories) */
.sh__sub {
  margin-left: 1.5rem; margin-top: 0.35rem;
  padding: 0.65rem; padding-top: 0.5rem;
  border-left: 2px solid var(--border-light);
}
.sh__sub-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.45rem;
}
.sh__sub-title {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.03em;
}

/* Utils */
.sh__loading {
  font-size: 0.82rem; color: var(--text-secondary);
  display: flex; align-items: center; gap: 0.3rem; padding: 0.5rem 0;
}
.sh__empty {
  font-size: 0.82rem; color: var(--text-secondary); padding: 0.75rem 0;
}
.sh__hint {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.85rem; color: var(--text-secondary);
  padding: 1.5rem 0;
}

@media (max-width: 768px) {
  .sh__inline-form { flex-wrap: wrap; }
  .sh__input--sm { flex: 1; }
  .sh__sub { margin-left: 0.75rem; padding: 0.5rem; }
  .sh__toast { bottom: 0.75rem; right: 0.75rem; left: 0.75rem; }
}
</style>
