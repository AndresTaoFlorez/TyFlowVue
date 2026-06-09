<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
  isMobile: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'close'])

const menuRef = ref(null)
const adjustedX = ref(0)
const adjustedY = ref(0)

watch([() => props.visible, () => props.x, () => props.y], async ([val]) => {
  if (val && !props.isMobile) {
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
    <!-- Desktop: cursor-anchored dropdown -->
    <div
      v-if="visible && !isMobile"
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

    <!-- Mobile: bottom-sheet action sheet -->
    <div v-if="visible && isMobile" class="ctx-sheet__overlay" @click.self="emit('close')">
      <div class="ctx-sheet" role="menu" @keydown.escape="emit('close')">
        <div class="ctx-sheet__handle"></div>
        <button
          v-for="item in items"
          :key="item.action"
          class="ctx-sheet__item"
          :class="{ 'ctx-sheet__item--danger': item.danger }"
          role="menuitem"
          @click.stop="emit('select', item.action)"
        >
          <i :class="'bx ' + item.icon" class="ctx-sheet__icon"></i>
          {{ item.label }}
        </button>
        <button class="ctx-sheet__item ctx-sheet__cancel" @click.stop="emit('close')">
          <i class="bx bx-x ctx-sheet__icon"></i>
          Cancelar
        </button>
      </div>
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

/* ---- Mobile bottom-sheet ---- */
.ctx-sheet__overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  animation: ctx-overlay-in 0.15s ease-out;
}

@keyframes ctx-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ctx-sheet {
  width: 100%;
  background: var(--bg-main);
  border-radius: var(--radius-lg, 1rem) var(--radius-lg, 1rem) 0 0;
  padding: 0.5rem 0 env(safe-area-inset-bottom, 0.5rem);
  animation: ctx-sheet-up 0.2s ease-out;
}

@keyframes ctx-sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.ctx-sheet__handle {
  width: 2rem;
  height: 0.25rem;
  background: var(--border-light);
  border-radius: 2px;
  margin: 0 auto 0.5rem;
}

.ctx-sheet__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.85rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 1rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.ctx-sheet__item:active { background: var(--bg-card); }

.ctx-sheet__item--danger {
  color: var(--error-500);
  border-top: 1px solid var(--border-light);
  margin-top: 0.25rem;
  padding-top: 0.9rem;
}

.ctx-sheet__cancel {
  border-top: 1px solid var(--border-light);
  margin-top: 0.25rem;
  padding-top: 0.9rem;
  color: var(--text-secondary);
}

.ctx-sheet__icon { font-size: 1.2rem; flex-shrink: 0; }
</style>
