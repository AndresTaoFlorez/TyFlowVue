<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['select', 'close'])

const menuRef = ref(null)
const adjustedX = ref(0)
const adjustedY = ref(0)

watch(() => props.visible, async (val) => {
  if (val) {
    adjustedX.value = props.x
    adjustedY.value = props.y
    await nextTick()
    if (menuRef.value) {
      const rect = menuRef.value.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        adjustedX.value = window.innerWidth - rect.width - 8
      }
      if (rect.bottom > window.innerHeight) {
        adjustedY.value = window.innerHeight - rect.height - 8
      }
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ctx-menu" ref="menuRef" :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }">
      <button
        v-for="item in items"
        :key="item.action"
        class="ctx-menu__item"
        :class="{ 'ctx-menu__item--danger': item.danger }"
        @click.stop="emit('select', item.action)"
      >
        <i :class="'bx ' + item.icon" class="ctx-menu__icon"></i>
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 200;
  background: var(--bg-main);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 0.3rem 0;
  min-width: 180px;
}

.ctx-menu__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-menu__item:hover { background: var(--bg-card); }

.ctx-menu__item--danger { color: var(--error-500); }
.ctx-menu__item--danger:hover { background: var(--error-bg); }

.ctx-menu__icon { font-size: 1rem; }
</style>
