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
      menuRef.value.focus()
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ctx-menu"
      ref="menuRef"
      tabindex="-1"
      role="menu"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
      @keydown.escape="emit('close')"
    >
      <button
        v-for="item in items"
        :key="item.action"
        class="ctx-menu__item"
        :class="{ 'ctx-menu__item--danger': item.danger }"
        role="menuitem"
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
  padding: 0.25rem 0;
  min-width: 170px;
  outline: none;
  animation: ctx-appear 0.1s ease-out;
}

@keyframes ctx-appear {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-menu__item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.4rem 0.65rem;
  border: none;
  background: transparent;
  font-size: 0.8rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.ctx-menu__item:hover { background: var(--bg-card); }

.ctx-menu__item--danger {
  color: var(--error-500);
  border-top: 1px solid var(--border-light);
  margin-top: 0.15rem;
  padding-top: 0.45rem;
}
.ctx-menu__item--danger:hover { background: var(--error-bg); }

.ctx-menu__icon { font-size: 0.95rem; flex-shrink: 0; }
</style>
