<script setup>
import { watch, onUnmounted } from 'vue'
import { useLayoutBoards } from '@/presentation/composables/useLayoutBoards'

// Board de la topbar: la vista monta este componente y su contenido se
// teletransporta al outlet #topbar-board del shell (AppTopbar). Mientras haya
// contenido publicado, la topbar oculta su título por defecto.
//
// `disabled` deja el contenido renderizando en sitio (p.ej. el calendario en
// móvil conserva su toolbar dentro de la vista) y NO cuenta como publicado.
const props = defineProps({
  disabled: { type: Boolean, default: false },
})

const boards = useLayoutBoards()

let registered = false
watch(() => props.disabled, (disabled) => {
  if (!disabled && !registered) { boards.register('topbar'); registered = true }
  else if (disabled && registered) { boards.unregister('topbar'); registered = false }
}, { immediate: true })

onUnmounted(() => {
  if (registered) boards.unregister('topbar')
})
</script>

<template>
  <Teleport to="#topbar-board" :disabled="disabled" defer>
    <slot />
  </Teleport>
</template>
