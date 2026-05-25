<script setup>
import { ref, computed } from 'vue'
import SectionLoader from '@/presentation/components/SectionLoader.vue'

const props = defineProps({
  application: { type: Object, required: true },
  specialists: { type: Array, default: () => [] },
  allUsers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  assigning: { type: Boolean, default: false },
})

const emit = defineEmits(['assign', 'remove', 'close'])

const busqueda = ref('')
const mostrarBusqueda = ref(false)

// IDs de specialists ya asignados a esta app
const assignedUserIds = computed(() =>
  new Set(props.specialists.map(u => u.id))
)

// Usuarios que son specialist y NO están ya asignados a esta app
const usuariosDisponibles = computed(() => {
  const term = busqueda.value.toLowerCase().trim()
  return props.allUsers.filter(u => {
    if (!u.specialistId) return false
    if (assignedUserIds.value.has(u.id)) return false
    if (!term) return true
    return u.fullName.toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term)
  })
})

const toggleBusqueda = () => {
  mostrarBusqueda.value = !mostrarBusqueda.value
  if (!mostrarBusqueda.value) busqueda.value = ''
}

const handleAssign = (user) => {
  emit('assign', user)
}

const handleRemove = (user) => {
  emit('remove', user)
}
</script>

<template>
  <div class="detail">
    <!-- Header -->
    <div class="detail__header">
      <div class="detail__title-row">
        <div class="detail__icon">
          <i class='bx bx-cube'></i>
        </div>
        <div>
          <h2 class="detail__name">{{ application.name }}</h2>
          <span class="detail__meta">ID: {{ application.id }}</span>
        </div>
      </div>
      <button class="detail__close" @click="$emit('close')" title="Cerrar">
        <i class='bx bx-x'></i>
      </button>
    </div>

    <!-- Specialist count + add button -->
    <div class="detail__toolbar">
      <h3 class="detail__section-title">
        <i class='bx bx-user'></i>
        Especialistas asignados
        <span class="detail__badge">{{ specialists.length }}</span>
      </h3>
      <button class="btn-add" @click="toggleBusqueda" :class="{ 'btn-add--active': mostrarBusqueda }">
        <i :class="mostrarBusqueda ? 'bx bx-x' : 'bx bx-plus'"></i>
        {{ mostrarBusqueda ? 'Cerrar' : 'Agregar' }}
      </button>
    </div>

    <!-- Search & assign panel -->
    <div v-if="mostrarBusqueda" class="search-panel">
      <div class="search-panel__input-wrap">
        <i class='bx bx-search'></i>
        <input
          v-model="busqueda"
          type="text"
          placeholder="Buscar especialista por nombre o correo..."
          class="search-panel__input"
        >
      </div>

      <div v-if="assigning" class="search-panel__status">
        <i class='bx bx-loader-alt bx-spin'></i> Asignando...
      </div>

      <div v-else-if="usuariosDisponibles.length === 0" class="search-panel__empty">
        {{ busqueda.trim() ? 'No se encontraron especialistas.' : 'No hay especialistas disponibles para asignar.' }}
      </div>

      <ul v-else class="search-panel__results">
        <li
          v-for="user in usuariosDisponibles"
          :key="user.id"
          class="search-result"
          @click="handleAssign(user)"
        >
          <div class="search-result__avatar">
            {{ user.firstName?.charAt(0) }}{{ user.firstSurname?.charAt(0) }}
          </div>
          <div class="search-result__info">
            <span class="search-result__name">{{ user.fullName }}</span>
            <span class="search-result__email">{{ user.email }}</span>
          </div>
          <i class='bx bx-plus-circle search-result__action'></i>
        </li>
      </ul>
    </div>

    <!-- Loading -->
    <SectionLoader v-if="loading" message="Cargando especialistas..." />

    <!-- Specialist list -->
    <ul v-else-if="specialists.length > 0" class="specialist-list">
      <li v-for="user in specialists" :key="user.id" class="specialist-item">
        <div class="specialist-item__avatar">
          {{ user.firstName?.charAt(0) }}{{ user.firstSurname?.charAt(0) }}
        </div>
        <div class="specialist-item__info">
          <span class="specialist-item__name">{{ user.fullName }}</span>
          <span class="specialist-item__email">{{ user.email }}</span>
        </div>
        <button class="specialist-item__remove" @click="handleRemove(user)" title="Quitar de la aplicación">
          <i class='bx bx-x'></i>
        </button>
      </li>
    </ul>

    <div v-else class="detail__empty">
      <i class='bx bx-user-x'></i>
      <p>No hay especialistas asignados.</p>
      <p class="detail__empty-hint">Usa el botón "Agregar" para asignar especialistas.</p>
    </div>
  </div>
</template>

<style scoped>
.detail {
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail__title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.detail__icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.35rem;
  flex-shrink: 0;
}

.detail__name {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.detail__meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.detail__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}

.detail__close:hover {
  color: var(--text-primary);
}

.detail__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-light);
}

.detail__section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail__section-title i {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.detail__badge {
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-full);
  margin-left: 0.2rem;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1.5px solid var(--primary-500);
  color: var(--primary-500);
  background: white;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-add:hover {
  background: var(--primary-500);
  color: white;
}

.btn-add--active {
  background: var(--primary-500);
  color: white;
}

/* ---- Search panel ---- */
.search-panel {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-panel__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
}

.search-panel__input-wrap i {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.search-panel__input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  color: var(--text-primary);
}

.search-panel__status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  padding: 0.5rem 0;
}

.search-panel__empty {
  font-size: 0.82rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.5rem 0;
  text-align: center;
}

.search-panel__results {
  list-style: none;
  max-height: 12rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.search-result {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s ease;
}

.search-result:hover {
  background: white;
}

.search-result__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: #E0E7FF;
  color: #4F46E5;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.search-result__info {
  flex: 1;
  min-width: 0;
}

.search-result__name {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result__email {
  display: block;
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result__action {
  font-size: 1.2rem;
  color: var(--primary-500);
  flex-shrink: 0;
  transition: transform 0.12s;
}

.search-result:hover .search-result__action {
  transform: scale(1.15);
}

/* ---- Specialist list ---- */
.specialist-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.specialist-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.6rem;
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}

.specialist-item:hover {
  background: var(--bg-card);
}

.specialist-item__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background: var(--primary-gradient);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.specialist-item__info {
  flex: 1;
  min-width: 0;
}

.specialist-item__name {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.specialist-item__email {
  display: block;
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.specialist-item__remove {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  opacity: 0;
  transition: all 0.12s;
}

.specialist-item:hover .specialist-item__remove {
  opacity: 1;
}

.specialist-item__remove:hover {
  color: var(--error-500);
  background: var(--error-bg);
}

.detail__empty {
  text-align: center;
  padding: 2rem 0;
  color: var(--text-secondary);
}

.detail__empty i {
  font-size: 2.5rem;
  opacity: 0.4;
  margin-bottom: 0.5rem;
}

.detail__empty p {
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.detail__empty-hint {
  font-size: 0.75rem !important;
  font-style: italic;
  opacity: 0.7;
}
</style>
