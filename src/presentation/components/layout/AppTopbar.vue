<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const authStore = useAuthStore()
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
      <div id="topbar-actions" class="topbar__actions"></div>
    </div>
  </header>
</template>
