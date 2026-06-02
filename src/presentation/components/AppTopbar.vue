<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'

const authStore = useAuthStore()
const prefs = usePreferencesStore()
const route = useRoute()

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
      <h1 v-if="pageTitle" class="topbar__title">{{ pageTitle }}</h1>
    </div>
    <div class="topbar__right">
      <button class="topbar__theme-btn" @click="prefs.toggleTheme" :aria-label="prefs.theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
        <i class="bx" :class="prefs.theme === 'dark' ? 'bx-sun' : 'bx-moon'"></i>
      </button>
      <div id="topbar-actions" class="topbar__actions"></div>
    </div>
  </header>
</template>
