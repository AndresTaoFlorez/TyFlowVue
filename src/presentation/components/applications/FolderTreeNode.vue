<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  specialists: { type: Array, default: () => [] },
  supportLevels: { type: Array, default: () => [] },
  selectedFolderId: { type: String, default: null },
  collapsedMainBoxIds: { type: Set, default: () => new Set() },
  depth: { type: Number, default: 0 },
  isLast: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'context-menu', 'toggle-collapse'])

const expanded = ref(true)

const toggle = () => { expanded.value = !expanded.value }

const isMainBox = computed(() => props.node.type === 'main_box')
const isTreeCollapsed = computed(() => isMainBox.value && props.collapsedMainBoxIds.has(props.node.id))
const showChildren = computed(() => {
  if (!props.node.children || props.node.children.length === 0) return false
  if (isTreeCollapsed.value) return false
  return expanded.value
})

function onToggleCollapse(event) {
  event.stopPropagation()
  emit('toggle-collapse', props.node.id)
}

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

const subtitle = () => {
  if (props.node.specialistId) {
    const name = specName(props.node.specialistId)
    if (name) return name
  }
  if (props.node.supportLevelId) {
    const name = levelName(props.node.supportLevelId)
    if (name) return name
  }
  return null
}

function onRowClick() {
  emit('select', props.node)
}

function onContextMenu(event) {
  event.preventDefault()
  event.stopPropagation()
  emit('context-menu', event, props.node)
}

function onDotsClick(event) {
  event.stopPropagation()
  emit('context-menu', event, props.node)
}

</script>

<template>
  <div class="tn">
    <!-- Row -->
    <div
      class="tn__row"
      :class="{
        'tn__row--inactive': !node.isActive,
        'tn__row--selected': selectedFolderId === node.id,
      }"
      @click="onRowClick"
      @contextmenu="onContextMenu"
    >
      <!-- Chevron -->
      <button
        v-if="node.children && node.children.length > 0"
        class="tn__chevron"
        @click.stop="toggle"
      >
        <i :class="expanded ? 'bx bxs-down-arrow' : 'bx bxs-right-arrow'"></i>
      </button>
      <span v-else class="tn__chevron tn__chevron--leaf"></span>

      <!-- Icon -->
      <i
        :class="'bx ' + (typeIcon[node.type] || 'bx-folder')"
        class="tn__icon"
        :style="{ color: typeColor[node.type] || '#94a3b8' }"
      ></i>

      <!-- Label -->
      <div class="tn__label">
        <span class="tn__name" :title="node.name">{{ node.name }}</span>
        <span v-if="subtitle()" class="tn__sub" :title="subtitle()">{{ subtitle() }}</span>
      </div>

      <!-- Collapse-all toggle (main_box only) -->
      <button
        v-if="isMainBox && node.children && node.children.length > 0"
        class="tn__collapse-all"
        :title="isTreeCollapsed ? 'Expandir todo' : 'Contraer todo'"
        @click="onToggleCollapse($event)"
      >
        <i :class="isTreeCollapsed ? 'bx bx-chevrons-down' : 'bx bx-chevrons-up'"></i>
      </button>

      <!-- Dots -->
      <button class="tn__dots" @click="onDotsClick($event)" title="Opciones">
        <i class='bx bx-dots-vertical-rounded'></i>
      </button>
    </div>

    <!-- Children -->
    <div v-if="showChildren" class="tn__children">
      <FolderTreeNode
        v-for="(child, idx) in node.children"
        :key="child.id"
        :node="child"
        :specialists="specialists"
        :support-levels="supportLevels"
        :selected-folder-id="selectedFolderId"
        :collapsed-main-box-ids="collapsedMainBoxIds"
        :depth="depth + 1"
        :is-last="idx === node.children.length - 1"
        @select="$emit('select', $event)"
        @context-menu="(ev, n) => $emit('context-menu', ev, n)"
        @toggle-collapse="$emit('toggle-collapse', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
/* ===== Node wrapper ===== */
.tn {
  position: relative;
}

/* ===== Row ===== */
.tn__row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background 0.1s;
  min-height: 24px;
}

.tn__row:hover { background: var(--bg-card); }

.tn__row--selected {
  background: rgba(42, 199, 143, 0.1);
}
.tn__row--selected:hover {
  background: rgba(42, 199, 143, 0.15);
}

.tn__row--inactive { opacity: 0.45; }

/* ===== Chevron ===== */
.tn__chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 7px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.1s;
}

.tn__chevron:hover { background: var(--border-light); }
.tn__chevron--leaf { cursor: default; visibility: hidden; }

/* ===== Icon ===== */
.tn__icon {
  font-size: 13px;
  flex-shrink: 0;
  line-height: 1;
}

/* ===== Label ===== */
.tn__label {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.tn__name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tn__sub {
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.1;
}

/* ===== Dots ===== */
.tn__dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
  font-size: 13px;
}

.tn__row:hover .tn__dots { opacity: 1; }
.tn__dots:hover { background: var(--border-light); color: var(--text-primary); }

/* ===== Collapse-all button (main_box only) ===== */
.tn__collapse-all {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s, color 0.1s;
  font-size: 13px;
}

.tn__row:hover .tn__collapse-all { opacity: 0.6; }
.tn__collapse-all:hover { opacity: 1 !important; background: var(--border-light); color: var(--text-primary); }

/* ===== Children — tree guides ===== */
.tn__children {
  position: relative;
  margin-left: 5px;
  padding-left: 7px;
}

/* Vertical guide line */
.tn__children::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-light);
}

/* Horizontal connector on each child row */
.tn__children > .tn {
  position: relative;
}

.tn__children > .tn::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 12px;
  width: 5px;
  height: 1px;
  background: var(--border-light);
}

/* For the last child, trim the vertical line to the connector */
.tn__children > .tn:last-of-type::after {
  content: '';
  position: absolute;
  left: -7px;
  top: 12px;
  bottom: 0;
  width: 1px;
  background: var(--bg-main);
}

</style>
