<script setup>
import { ref } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  specialists: { type: Array, default: () => [] },
  supportLevels: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  depth: { type: Number, default: 0 },
})

const emit = defineEmits(['add-child', 'edit', 'delete', 'rename'])

const expanded = ref(true)
const editing = ref(false)
const editName = ref('')

const toggle = () => { expanded.value = !expanded.value }

const startEdit = () => {
  editName.value = props.node.name
  editing.value = true
}

const submitEdit = () => {
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.node.name) {
    emit('rename', props.node, trimmed)
  }
  editing.value = false
}

const cancelEdit = () => { editing.value = false }

const typeIcon = { main_box: 'bx-inbox', level: 'bx-layer', specialist: 'bx-user' }
const typeColor = { main_box: '#2AC78F', level: '#607dea', specialist: '#f59e0b' }

const specName = (id) => {
  const u = props.specialists.find(s => s.specialistId === id)
  return u ? u.fullName : null
}

const levelName = (id) => {
  const l = props.supportLevels.find(s => s.id === id)
  return l ? l.name : null
}

const childType = () => {
  if (props.node.type === 'main_box') return 'level'
  return 'specialist'
}
</script>

<template>
  <div class="tree-node" :style="{ '--depth': depth }">
    <div class="tree-node__row" :class="{ 'tree-node__row--inactive': !node.isActive }">
      <!-- Expand/collapse -->
      <button
        v-if="node.children && node.children.length > 0"
        class="tree-node__toggle"
        @click="toggle"
      >
        <i :class="expanded ? 'bx bx-chevron-down' : 'bx bx-chevron-right'"></i>
      </button>
      <span v-else class="tree-node__toggle tree-node__toggle--leaf"></span>

      <!-- Icon -->
      <i :class="'bx ' + (typeIcon[node.type] || 'bx-folder')" class="tree-node__icon" :style="{ color: typeColor[node.type] || '#6c7293' }"></i>

      <!-- Name -->
      <div v-if="editing" class="tree-node__edit">
        <input
          v-model="editName"
          class="tree-node__edit-input"
          @keydown.enter="submitEdit"
          @keydown.escape="cancelEdit"
          @blur="submitEdit"
          ref="editInput"
          autofocus
        >
      </div>
      <div v-else class="tree-node__info" @dblclick="editable && startEdit()">
        <span class="tree-node__name">{{ node.name }}</span>
        <span class="tree-node__meta">
          <span class="tree-node__type">{{ node.type.replace('_', ' ') }}</span>
          <span v-if="node.specialistId && specName(node.specialistId)" class="tree-node__detail">{{ specName(node.specialistId) }}</span>
          <span v-if="node.supportLevelId && levelName(node.supportLevelId)" class="tree-node__detail">{{ levelName(node.supportLevelId) }}</span>
        </span>
      </div>

      <!-- Actions -->
      <div v-if="editable && !editing" class="tree-node__actions">
        <button class="tree-node__action" @click="$emit('add-child', { parentFolderId: node.id, type: childType() })" title="Agregar sub-carpeta">
          <i class='bx bx-plus'></i>
        </button>
        <button class="tree-node__action" @click="startEdit" title="Renombrar">
          <i class='bx bx-edit-alt'></i>
        </button>
        <button class="tree-node__action tree-node__action--danger" @click="$emit('delete', node)" title="Eliminar">
          <i class='bx bx-trash'></i>
        </button>
      </div>
    </div>

    <!-- Children -->
    <div v-if="expanded && node.children && node.children.length > 0" class="tree-node__children">
      <FolderTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :specialists="specialists"
        :support-levels="supportLevels"
        :editable="editable"
        :depth="depth + 1"
        @add-child="$emit('add-child', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @rename="(folder, newName) => $emit('rename', folder, newName)"
      />
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  --indent: calc(var(--depth, 0) * 1.25rem);
}

.tree-node__row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem 0.4rem calc(0.5rem + var(--indent));
  border-radius: var(--radius-sm);
  transition: background 0.1s;
}

.tree-node__row:hover {
  background: var(--bg-card);
}

.tree-node__row--inactive {
  opacity: 0.5;
}

.tree-node__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 3px;
  transition: background 0.1s;
}

.tree-node__toggle:hover {
  background: var(--border-light);
}

.tree-node__toggle--leaf {
  cursor: default;
}

.tree-node__icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.tree-node__info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  cursor: default;
}

.tree-node__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-node__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.tree-node__type {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--bg-card);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}

.tree-node__detail {
  font-size: 0.72rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* Edit inline */
.tree-node__edit {
  flex: 1;
}

.tree-node__edit-input {
  width: 100%;
  padding: 0.2rem 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1.5px solid var(--primary-500);
  border-radius: var(--radius-sm);
  outline: none;
  color: var(--text-primary);
  background: white;
}

/* Actions */
.tree-node__actions {
  display: flex;
  gap: 0.15rem;
  opacity: 0;
  transition: opacity 0.12s;
}

.tree-node__row:hover .tree-node__actions {
  opacity: 1;
}

.tree-node__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.1s;
}

.tree-node__action:hover {
  background: var(--border-light);
  color: var(--text-primary);
}

.tree-node__action--danger:hover {
  color: var(--error-500);
  background: var(--error-bg);
}

.tree-node__children {
  border-left: 1px solid var(--border-light);
  margin-left: calc(0.5rem + var(--indent) + 0.625rem);
}
</style>
