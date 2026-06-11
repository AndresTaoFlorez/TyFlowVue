<script setup>
import '@/styles/components/layout/topbar.css'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { useLayoutBoards } from '@/presentation/composables/useLayoutBoards'

const authStore = useAuthStore()
const route = useRoute()

// Board contextual: si una vista publica contenido (<TopbarBoard>), ocupa el
// espacio central y el título por defecto de la ruta se oculta.
const { hasTopbarContent } = useLayoutBoards()

defineProps({
  collapsed: { type: Boolean, default: false }
})

defineEmits(['toggle-sidebar'])

const pageTitle = computed(() => route.meta?.title || '')
</script>

<template>
  <header class="layout__header topbar">
    <div class="topbar__left">
      <button class="sidebar-toggle sidebar-toggle--mobile" @click="$emit('toggle-sidebar')" aria-label="Toggle sidebar">
        <i class='bx bx-menu'></i>
      </button>
      <h1 v-if="pageTitle && !hasTopbarContent" class="topbar__title">{{ pageTitle }}</h1>
      <div id="topbar-board" class="topbar__board"></div>
    </div>
    <div class="topbar__right">
      <div id="topbar-actions" class="topbar__actions"></div>
    </div>
  </header>
</template>
