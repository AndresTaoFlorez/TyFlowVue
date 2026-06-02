<script setup>
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '@/presentation/stores/useSettingsStore'
import { useUserStore } from '@/presentation/stores/useUserStore'

const store = useSettingsStore()
const userStore = useUserStore()

const feedback = ref(null)
const saving = ref(false)

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

// IDs of levels linked to selected app
const linkedLevelIds = computed(() =>
  store.appLevelPivots.map(p => p.support_level_id)
)

// IDs of categories linked to selected level
const linkedCategoryIds = computed(() =>
  store.levelCategoryPivots.map(p => p.support_category_id)
)

// Expanded level (to show its categories)
const expandedLevelId = ref(null)

function selectApp(appId) {
  store.loadAppLevels(appId)
  expandedLevelId.value = null
  feedback.value = null
}

function expandLevel(levelId) {
  if (expandedLevelId.value === levelId) {
    expandedLevelId.value = null
    return
  }
  expandedLevelId.value = levelId
  store.loadLevelCategories(levelId)
}

// ── Toggle level link for app ──
async function toggleLevel(levelId) {
  saving.value = true
  feedback.value = null
  const current = [...linkedLevelIds.value]
  const idx = current.indexOf(levelId)
  if (idx !== -1) {
    current.splice(idx, 1)
    if (expandedLevelId.value === levelId) expandedLevelId.value = null
  } else {
    current.push(levelId)
  }
  try {
    await store.syncAppLevels(store.selectedAppId, current)
    feedback.value = { type: 'success', text: 'Niveles actualizados.' }
  } catch {
    feedback.value = { type: 'error', text: store.error || 'Error sincronizando' }
  } finally {
    saving.value = false
  }
}

// ── Toggle category link for level ──
async function toggleCategory(categoryId) {
  saving.value = true
  feedback.value = null
  const current = [...linkedCategoryIds.value]
  const idx = current.indexOf(categoryId)
  if (idx !== -1) current.splice(idx, 1)
  else current.push(categoryId)
  try {
    await store.syncLevelCategories(expandedLevelId.value, current)
    feedback.value = { type: 'success', text: 'Categorías actualizadas.' }
  } catch {
    feedback.value = { type: 'error', text: store.error || 'Error sincronizando' }
  } finally {
    saving.value = false
  }
}

// ── Create new level (entity + link) ──
async function handleCreateLevel() {
  if (!newLevelName.value.trim()) return
  saving.value = true
  feedback.value = null
  try {
    const created = await store.createSupportLevel({
      name: newLevelName.value.trim(),
      description: newLevelDesc.value.trim() || null,
    })
    // Auto-link to current app
    if (store.selectedAppId) {
      const ids = [...linkedLevelIds.value, created.id]
      await store.syncAppLevels(store.selectedAppId, ids)
    }
    newLevelName.value = ''
    newLevelDesc.value = ''
    showNewLevel.value = false
    feedback.value = { type: 'success', text: 'Nivel creado y vinculado.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error creando nivel' }
  } finally {
    saving.value = false
  }
}

// ── Create new category (entity + link) ──
async function handleCreateCategory() {
  if (!newCatName.value.trim()) return
  saving.value = true
  feedback.value = null
  try {
    const created = await store.createSupportCategory({
      name: newCatName.value.trim(),
      description: newCatDesc.value.trim() || null,
    })
    // Auto-link to current level
    if (expandedLevelId.value) {
      const ids = [...linkedCategoryIds.value, created.id]
      await store.syncLevelCategories(expandedLevelId.value, ids)
    }
    newCatName.value = ''
    newCatDesc.value = ''
    showNewCategory.value = false
    feedback.value = { type: 'success', text: 'Categoría creada y vinculada.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error creando categoría' }
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
    feedback.value = { type: 'success', text: 'Nivel actualizado.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error' }
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
    feedback.value = { type: 'success', text: 'Categoría actualizada.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error' }
  } finally {
    saving.value = false
  }
}

function levelName(id) {
  return store.supportLevels.find(l => l.id === id)?.name ?? id.slice(0, 8)
}

function categoryName(id) {
  return store.supportCategories.find(c => c.id === id)?.name ?? id.slice(0, 8)
}
</script>

<template>
  <section class="sh">
    <div class="sh__header">
      <div>
        <h2 class="sh__heading">Jerarquía de Soporte</h2>
        <p class="sh__desc">Gestiona la relación Aplicación → Niveles → Categorías.</p>
      </div>
    </div>

    <!-- Feedback -->
    <div v-if="feedback" class="sh__feedback" :class="feedback.type === 'success' ? 'sh__feedback--ok' : 'sh__feedback--err'">
      <i :class="feedback.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
      {{ feedback.text }}
      <button class="sh__feedback-close" @click="feedback = null"><i class="bx bx-x"></i></button>
    </div>

    <!-- Step 1: Select Application -->
    <div class="sh__step">
      <label class="sh__step-label"><i class="bx bx-cube"></i> Aplicación</label>
      <select class="sh__select" :value="store.selectedAppId ?? ''" @change="selectApp($event.target.value || null)">
        <option value="">— Seleccionar aplicación —</option>
        <option v-for="app in applications" :key="app.id" :value="app.id">{{ app.name }}</option>
      </select>
    </div>

    <!-- Step 2: Levels for selected app -->
    <template v-if="store.selectedAppId">
      <div class="sh__section">
        <div class="sh__section-header">
          <span class="sh__section-title"><i class="bx bx-layer"></i> Niveles de soporte</span>
          <button class="sh__add-btn" @click="showNewLevel = !showNewLevel">
            <i class="bx" :class="showNewLevel ? 'bx-x' : 'bx-plus'"></i>
            {{ showNewLevel ? 'Cancelar' : 'Nuevo' }}
          </button>
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
            <div class="sh__item" :class="{ 'sh__item--linked': linkedLevelIds.includes(lv.id) }">
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
                <button class="sh__toggle" @click="toggleLevel(lv.id)" :disabled="saving">
                  <i class="bx" :class="linkedLevelIds.includes(lv.id) ? 'bx-check-square' : 'bx-square'"></i>
                </button>
                <div class="sh__item-info" @click="linkedLevelIds.includes(lv.id) ? expandLevel(lv.id) : null" :class="{ 'sh__item-info--clickable': linkedLevelIds.includes(lv.id) }">
                  <span class="sh__item-name">{{ lv.name }}</span>
                  <span v-if="lv.description" class="sh__item-desc">{{ lv.description }}</span>
                </div>
                <button class="sh__icon-btn" @click="startEditLevel(lv)"><i class="bx bx-pencil"></i></button>
                <i v-if="linkedLevelIds.includes(lv.id)" class="bx sh__chevron" :class="expandedLevelId === lv.id ? 'bx-chevron-up' : 'bx-chevron-down'" @click="expandLevel(lv.id)"></i>
              </template>
            </div>

            <!-- Expanded: categories for this level -->
            <div v-if="expandedLevelId === lv.id && linkedLevelIds.includes(lv.id)" class="sh__sub">
              <div class="sh__sub-header">
                <span class="sh__sub-title"><i class="bx bx-category"></i> Categorías de "{{ lv.name }}"</span>
                <button class="sh__add-btn sh__add-btn--sm" @click="showNewCategory = !showNewCategory">
                  <i class="bx" :class="showNewCategory ? 'bx-x' : 'bx-plus'"></i>
                </button>
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
                <div v-for="cat in store.supportCategories" :key="cat.id" class="sh__item" :class="{ 'sh__item--linked': linkedCategoryIds.includes(cat.id) }">
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
                    <button class="sh__toggle" @click="toggleCategory(cat.id)" :disabled="saving">
                      <i class="bx" :class="linkedCategoryIds.includes(cat.id) ? 'bx-check-square' : 'bx-square'"></i>
                    </button>
                    <div class="sh__item-info">
                      <span class="sh__item-name">{{ cat.name }}</span>
                      <span v-if="cat.description" class="sh__item-desc">{{ cat.description }}</span>
                    </div>
                    <button class="sh__icon-btn" @click="startEditCat(cat)"><i class="bx bx-pencil"></i></button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="store.supportLevels.length === 0" class="sh__empty">
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

/* Feedback */
.sh__feedback {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.75rem; border-radius: var(--radius-md);
  font-size: 0.8rem; font-weight: 600; margin-bottom: 0.85rem;
}
.sh__feedback--ok { background: var(--success-bg); color: var(--success-text); }
.sh__feedback--err { background: var(--error-bg); color: var(--error-text); }
.sh__feedback-close { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; font-size: 1rem; }

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
.sh__add-btn {
  display: flex; align-items: center; gap: 0.2rem;
  padding: 0.3rem 0.6rem; background: var(--primary-500); color: white;
  font-size: 0.72rem; font-weight: 600; border: none; border-radius: var(--radius-md);
  cursor: pointer; transition: background 0.12s;
}
.sh__add-btn:hover { background: var(--primary-600); }
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
.sh__item--linked { border-color: var(--primary-500); border-left: 3px solid var(--primary-500); }

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
  cursor: pointer; flex-shrink: 0;
  transition: color 0.12s;
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
}
</style>
