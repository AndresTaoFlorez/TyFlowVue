<script setup>
import { ref } from 'vue'
import { useSettingsStore } from '@/presentation/stores/useSettingsStore'

const store = useSettingsStore()

const showForm = ref(false)
const newName = ref('')
const newDesc = ref('')
const submitting = ref(false)
const feedback = ref(null)
const confirmDeleteId = ref(null)
const editingId = ref(null)
const editName = ref('')
const editDesc = ref('')
const saving = ref(false)

function startEdit(cat) {
  editingId.value = cat.id
  editName.value = cat.name
  editDesc.value = cat.description || ''
}

function cancelEdit() {
  editingId.value = null
}

async function handleUpdate(id) {
  if (!editName.value.trim()) return
  saving.value = true
  feedback.value = null
  try {
    await store.updateSupportCategory(id, {
      name: editName.value.trim(),
      description: editDesc.value.trim() || null,
    })
    editingId.value = null
    feedback.value = { type: 'success', text: 'Categoría actualizada.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error actualizando categoría' }
  } finally {
    saving.value = false
  }
}

async function handleCreate() {
  if (!newName.value.trim()) return
  submitting.value = true
  feedback.value = null
  try {
    await store.createSupportCategory({
      name: newName.value.trim(),
      description: newDesc.value.trim() || null,
    })
    newName.value = ''
    newDesc.value = ''
    showForm.value = false
    feedback.value = { type: 'success', text: 'Categoría creada correctamente.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error creando categoría' }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  feedback.value = null
  try {
    await store.deleteSupportCategory(id)
    confirmDeleteId.value = null
    feedback.value = { type: 'success', text: 'Categoría eliminada.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error eliminando categoría' }
    confirmDeleteId.value = null
  }
}
</script>

<template>
  <section class="sc">
    <div class="sc__header">
      <div>
        <h2 class="sc__heading">Categorías de Soporte</h2>
        <p class="sc__desc">Gestiona las categorías de soporte para clasificar casos.</p>
      </div>
      <button v-if="!showForm" class="sc__add-btn" @click="showForm = true">
        <i class="bx bx-plus"></i> Nueva categoría
      </button>
    </div>

    <!-- Feedback -->
    <div v-if="feedback" class="sc__feedback" :class="feedback.type === 'success' ? 'sc__feedback--ok' : 'sc__feedback--err'">
      <i :class="feedback.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
      {{ feedback.text }}
      <button class="sc__feedback-close" @click="feedback = null"><i class="bx bx-x"></i></button>
    </div>

    <!-- Create form -->
    <div v-if="showForm" class="sc__form">
      <div class="sc__form-fields">
        <div class="sc__form-field">
          <label class="sc__form-label">Nombre *</label>
          <input v-model="newName" type="text" class="sc__form-input" placeholder="ej. general, redes" />
        </div>
        <div class="sc__form-field">
          <label class="sc__form-label">Descripción</label>
          <input v-model="newDesc" type="text" class="sc__form-input" placeholder="Descripción de la categoría" />
        </div>
      </div>
      <div class="sc__form-actions">
        <button class="sc__form-btn sc__form-btn--cancel" @click="showForm = false; newName = ''; newDesc = ''">
          Cancelar
        </button>
        <button class="sc__form-btn sc__form-btn--save" :disabled="submitting || !newName.trim()" @click="handleCreate">
          <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
          {{ submitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="sc__loading">
      <i class="bx bx-loader-alt bx-spin"></i> Cargando...
    </div>

    <!-- Empty -->
    <div v-else-if="store.supportCategories.length === 0" class="sc__empty">
      No hay categorías de soporte registradas.
    </div>

    <!-- List -->
    <div v-else class="sc__list">
      <div v-for="cat in store.supportCategories" :key="cat.id" class="sc__card">
        <!-- Inline edit mode -->
        <template v-if="editingId === cat.id">
          <div class="sc__edit-fields">
            <input v-model="editName" type="text" class="sc__form-input" placeholder="Nombre" />
            <input v-model="editDesc" type="text" class="sc__form-input" placeholder="Descripción" />
          </div>
          <div class="sc__card-actions">
            <button class="sc__action-btn" @click="cancelEdit">
              <i class="bx bx-x"></i>
            </button>
            <button class="sc__action-btn sc__action-btn--save" :disabled="saving || !editName.trim()" @click="handleUpdate(cat.id)">
              <i class="bx" :class="saving ? 'bx-loader-alt bx-spin' : 'bx-check'"></i>
            </button>
          </div>
        </template>
        <!-- Display mode -->
        <template v-else>
          <div class="sc__card-left">
            <i class="bx bx-category sc__card-icon"></i>
            <div class="sc__card-info">
              <span class="sc__card-name">{{ cat.name }}</span>
              <span v-if="cat.description" class="sc__card-desc">{{ cat.description }}</span>
            </div>
          </div>
          <div class="sc__card-actions">
            <template v-if="confirmDeleteId === cat.id">
              <span class="sc__confirm-text">Eliminar?</span>
              <button class="sc__action-btn sc__action-btn--danger" @click="handleDelete(cat.id)">Sí</button>
              <button class="sc__action-btn" @click="confirmDeleteId = null">No</button>
            </template>
            <template v-else>
              <button class="sc__action-btn" @click="startEdit(cat)">
                <i class="bx bx-pencil"></i>
              </button>
              <button class="sc__action-btn sc__action-btn--danger" @click="confirmDeleteId = cat.id">
                <i class="bx bx-trash"></i>
              </button>
            </template>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sc__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
}

.sc__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.sc__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.sc__add-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.5rem 0.85rem;
  background: var(--primary-500);
  color: white;
  font-size: 0.82rem;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
}
.sc__add-btn:hover { background: var(--primary-600); }

/* Feedback */
.sc__feedback {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.85rem;
}
.sc__feedback--ok { background: var(--success-bg); color: var(--success-text); }
.sc__feedback--err { background: var(--error-bg); color: var(--error-text); }
.sc__feedback-close {
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

/* Form */
.sc__form {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
}

.sc__form-fields {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.sc__form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sc__form-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.sc__form-input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
}
.sc__form-input:focus { border-color: var(--primary-500); }

.sc__form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.sc__form-btn {
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}
.sc__form-btn--cancel {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}
.sc__form-btn--save {
  background: var(--primary-500);
  color: white;
}
.sc__form-btn--save:hover:not(:disabled) { background: var(--primary-600); }
.sc__form-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Loading / Empty */
.sc__loading, .sc__empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding: 1rem 0;
}

/* List */
.sc__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sc__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.sc__card-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.sc__card-icon {
  font-size: 1.2rem;
  color: var(--primary-500);
  flex-shrink: 0;
}

.sc__card-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.sc__card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sc__card-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sc__card-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.sc__confirm-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--error-text);
}

.sc__action-btn {
  padding: 0.3rem 0.55rem;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.12s;
}
.sc__action-btn:hover {
  background: var(--bg-main);
}
.sc__action-btn--danger {
  color: var(--error-500);
  border-color: transparent;
}
.sc__action-btn--danger:hover {
  background: var(--error-bg);
}
.sc__action-btn--save {
  color: var(--primary-500);
  border-color: transparent;
}
.sc__action-btn--save:hover:not(:disabled) {
  background: var(--primary-50, rgba(42, 199, 143, 0.1));
}
.sc__action-btn--save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Inline edit */
.sc__edit-fields {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}
.sc__edit-fields .sc__form-input {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .sc__form-fields { flex-direction: column; }
  .sc__edit-fields { flex-direction: column; }
}
</style>
