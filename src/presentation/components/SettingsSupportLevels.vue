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

async function handleCreate() {
  if (!newName.value.trim()) return
  submitting.value = true
  feedback.value = null
  try {
    await store.createSupportLevel({
      name: newName.value.trim(),
      description: newDesc.value.trim() || null,
    })
    newName.value = ''
    newDesc.value = ''
    showForm.value = false
    feedback.value = { type: 'success', text: 'Nivel creado correctamente.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error creando nivel' }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id) {
  feedback.value = null
  try {
    await store.deleteSupportLevel(id)
    confirmDeleteId.value = null
    feedback.value = { type: 'success', text: 'Nivel eliminado.' }
  } catch (e) {
    feedback.value = { type: 'error', text: e.response?.data?.detail || e.message || 'Error eliminando nivel' }
    confirmDeleteId.value = null
  }
}
</script>

<template>
  <section class="sl">
    <div class="sl__header">
      <div>
        <h2 class="sl__heading">Niveles de Soporte</h2>
        <p class="sl__desc">Gestiona los niveles de soporte para la distribución de casos.</p>
      </div>
      <button v-if="!showForm" class="sl__add-btn" @click="showForm = true">
        <i class="bx bx-plus"></i> Nuevo nivel
      </button>
    </div>

    <!-- Feedback -->
    <div v-if="feedback" class="sl__feedback" :class="feedback.type === 'success' ? 'sl__feedback--ok' : 'sl__feedback--err'">
      <i :class="feedback.type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'"></i>
      {{ feedback.text }}
      <button class="sl__feedback-close" @click="feedback = null"><i class="bx bx-x"></i></button>
    </div>

    <!-- Create form -->
    <div v-if="showForm" class="sl__form">
      <div class="sl__form-fields">
        <div class="sl__form-field">
          <label class="sl__form-label">Nombre *</label>
          <input v-model="newName" type="text" class="sl__form-input" placeholder="ej. básico, avanzado" />
        </div>
        <div class="sl__form-field">
          <label class="sl__form-label">Descripción</label>
          <input v-model="newDesc" type="text" class="sl__form-input" placeholder="Descripción del nivel" />
        </div>
      </div>
      <div class="sl__form-actions">
        <button class="sl__form-btn sl__form-btn--cancel" @click="showForm = false; newName = ''; newDesc = ''">
          Cancelar
        </button>
        <button class="sl__form-btn sl__form-btn--save" :disabled="submitting || !newName.trim()" @click="handleCreate">
          <i v-if="submitting" class="bx bx-loader-alt bx-spin"></i>
          {{ submitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="sl__loading">
      <i class="bx bx-loader-alt bx-spin"></i> Cargando...
    </div>

    <!-- Empty -->
    <div v-else-if="store.supportLevels.length === 0" class="sl__empty">
      No hay niveles de soporte registrados.
    </div>

    <!-- List -->
    <div v-else class="sl__list">
      <div v-for="sl in store.supportLevels" :key="sl.id" class="sl__card">
        <div class="sl__card-left">
          <i class="bx bx-layer sl__card-icon"></i>
          <div class="sl__card-info">
            <span class="sl__card-name">{{ sl.name }}</span>
            <span v-if="sl.description" class="sl__card-desc">{{ sl.description }}</span>
          </div>
        </div>
        <div class="sl__card-actions">
          <template v-if="confirmDeleteId === sl.id">
            <span class="sl__confirm-text">Eliminar?</span>
            <button class="sl__action-btn sl__action-btn--danger" @click="handleDelete(sl.id)">Sí</button>
            <button class="sl__action-btn" @click="confirmDeleteId = null">No</button>
          </template>
          <button v-else class="sl__action-btn sl__action-btn--danger" @click="confirmDeleteId = sl.id">
            <i class="bx bx-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sl__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
}

.sl__heading {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.sl__desc {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.sl__add-btn {
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
.sl__add-btn:hover { background: var(--primary-600); }

/* Feedback */
.sl__feedback {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.85rem;
}
.sl__feedback--ok { background: var(--success-bg); color: var(--success-text); }
.sl__feedback--err { background: var(--error-bg); color: var(--error-text); }
.sl__feedback-close {
  margin-left: auto;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
}

/* Form */
.sl__form {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
}

.sl__form-fields {
  display: flex;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}

.sl__form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sl__form-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.sl__form-input {
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-main);
  outline: none;
}
.sl__form-input:focus { border-color: var(--primary-500); }

.sl__form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.sl__form-btn {
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.12s;
}
.sl__form-btn--cancel {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}
.sl__form-btn--save {
  background: var(--primary-500);
  color: white;
}
.sl__form-btn--save:hover:not(:disabled) { background: var(--primary-600); }
.sl__form-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Loading / Empty */
.sl__loading, .sl__empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding: 1rem 0;
}

/* List */
.sl__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sl__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.sl__card-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.sl__card-icon {
  font-size: 1.2rem;
  color: var(--primary-500);
  flex-shrink: 0;
}

.sl__card-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.sl__card-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sl__card-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.sl__card-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.sl__confirm-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--error-text);
}

.sl__action-btn {
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
.sl__action-btn:hover {
  background: var(--bg-main);
}
.sl__action-btn--danger {
  color: var(--error-500);
  border-color: transparent;
}
.sl__action-btn--danger:hover {
  background: var(--error-bg);
}

@media (max-width: 768px) {
  .sl__form-fields { flex-direction: column; }
}
</style>
