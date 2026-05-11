<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'success' },
  visible: { type: Boolean, default: false },
  duration: { type: Number, default: 3000 },
})

const emit = defineEmits(['close'])

const show = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    show.value = true
    setTimeout(() => {
      show.value = false
      emit('close')
    }, props.duration)
  } else {
    show.value = false
  }
})
</script>

<template>
  <Transition name="toast">
    <div v-if="show" class="toast" :class="`toast--${type}`">
      <i :class="type === 'success' ? 'bx bx-check-circle' : 'bx bx-error-circle'" class="toast__icon"></i>
      <span class="toast__message">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 200;
}

.toast--success {
  background-color: #ECFDF5;
  color: #065F46;
  border-left: 3px solid var(--primary-500);
}

.toast--error {
  background-color: #FEF2F2;
  color: #991B1B;
  border-left: 3px solid var(--error-500);
}

.toast__icon {
  font-size: 1.3rem;
  flex-shrink: 0;
}

.toast-enter-active {
  animation: toast-in 0.35s ease;
}

.toast-leave-active {
  animation: toast-out 0.3s ease;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(1rem); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(1rem); }
}
</style>
