<script setup>
import { useAuthStore } from '@/presentation/stores/useAuthStore'

const authStore = useAuthStore()

defineProps({
  collapsed: { type: Boolean, default: false }
})

defineEmits(['toggle-sidebar'])
</script>

<template>
  <header class="layout__header topbar">
    <div class="topbar__left">
      <button class="sidebar-toggle" @click="$emit('toggle-sidebar')" aria-label="Toggle sidebar">
        <i class='bx' :class="collapsed ? 'bx-menu' : 'bx-menu-alt-left'"></i>
      </button>
    </div>
  </header>
</template>
