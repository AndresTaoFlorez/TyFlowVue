<script setup>
import { watch, onUnmounted } from 'vue'
import { useLayoutBoards } from '@/presentation/composables/useLayoutBoards'

// Board del sidebar: la vista monta este componente y su contenido se
// teletransporta al outlet #sidebar-board del shell (AppSidebar), el espacio
// libre bajo el brand. El contenido debe usar tokens --nav-* (theme-aware)
// para integrarse con el rail.
const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const boards = useLayoutBoards()

let registered = false
watch(() => props.disabled, (disabled) => {
  if (!disabled && !registered) { boards.register('sidebar'); registered = true }
  else if (disabled && registered) { boards.unregister('sidebar'); registered = false }
}, { immediate: true })

onUnmounted(() => {
  if (registered) boards.unregister('sidebar')
})
</script>

<template>
  <Teleport to="#sidebar-board" :disabled="disabled" defer>
    <slot />
  </Teleport>
</template>
