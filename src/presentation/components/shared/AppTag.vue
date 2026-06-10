<script setup>
/**
 * AppTag — chip de aplicación color-coded (mismo look que el pill .wb__app del
 * calendario): fondo con un leve tinte del color de la aplicación + texto
 * legible calculado con utils/color.js. Reutilizable en TODAS PARTES donde se
 * muestre una aplicación como texto/tag/pill.
 *
 * Uso: <AppTag :application-id="id" /> (resuelve nombre+color del userStore)
 *      <AppTag name="X" color="#3b82f6" />  (override directo)
 */
import { computed } from 'vue'
import { useUserStore } from '@/presentation/stores/useUserStore'
import { usePreferencesStore } from '@/presentation/stores/usePreferencesStore'
import { appTintSurface } from '@/presentation/utils/color'

const props = defineProps({
  applicationId: { type: String, default: '' },
  name: { type: String, default: '' },   // override opcional
  color: { type: String, default: '' },  // override opcional
})

const userStore = useUserStore()
const prefs = usePreferencesStore()

const app = computed(() => userStore.applications.find(a => a.id === props.applicationId))
const label = computed(() => props.name || app.value?.name || props.applicationId || '—')
const baseColor = computed(() => props.color || app.value?.color || app.value?.theme?.color || '#2AC78F')

// Tinte leve del color de la app + texto legible (theme-aware). Ver utils/color.js.
const surface = computed(() => {
  void prefs.theme
  return appTintSurface(baseColor.value, { lightApp: 0.22, darkApp: 0.34 })
})
</script>

<template>
  <span class="app-tag" :style="{ background: surface.bg, color: surface.text }" :title="label">{{ label }}</span>
</template>

<style scoped>
.app-tag {
  display: inline-block;
  max-width: 100%;
  padding: 0.12rem 0.5rem;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}
</style>
