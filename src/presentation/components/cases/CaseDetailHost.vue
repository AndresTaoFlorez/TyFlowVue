<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import CaseDetailModal from '@/presentation/components/cases/CaseDetailModal.vue'
import { useCaseDetailMode } from '@/presentation/composables/useCaseDetailMode'

// Host multi-modo del detalle de caso. Renderiza CaseDetailModal en:
//  - 'right' / 'left': bloque dócil — el layout padre (CasesView) lo posiciona.
//  - 'float':  ventana flotante arrastrable y redimensionable (Teleport a body).
//  - 'full':   cubre por completo el área del padre (position absolute).
// `allowDocked: false` fuerza float cuando el contexto no tiene split (Especialistas).
const props = defineProps({
  allowDocked: { type: Boolean, default: true },
})

const { mode, setMode, floatRect, clampFloatRect } = useCaseDetailMode()

const effectiveMode = computed(() => {
  if (!props.allowDocked && (mode.value === 'right' || mode.value === 'left')) return 'float'
  return mode.value
})

// ── Float: drag ───────────────────────────────────────
function onDragStart(e) {
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const orig = { ...floatRect.value }
  const onMove = (ev) => {
    floatRect.value.x = orig.x + (ev.clientX - startX)
    floatRect.value.y = orig.y + (ev.clientY - startY)
    clampFloatRect()
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── Float: resize (esquina inferior derecha) ─────────
function onResizeStart(e) {
  e.preventDefault()
  e.stopPropagation()
  const startX = e.clientX
  const startY = e.clientY
  const orig = { ...floatRect.value }
  document.body.style.cursor = 'nwse-resize'
  document.body.style.userSelect = 'none'
  const onMove = (ev) => {
    floatRect.value.w = orig.w + (ev.clientX - startX)
    floatRect.value.h = orig.h + (ev.clientY - startY)
    clampFloatRect()
  }
  const onUp = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onWindowResize() {
  clampFloatRect()
}

onMounted(() => window.addEventListener('resize', onWindowResize))
onUnmounted(() => window.removeEventListener('resize', onWindowResize))
</script>

<template>
  <!-- Flotante: ventana movible sobre toda la app -->
  <Teleport v-if="effectiveMode === 'float'" to="body">
    <div
      class="cdh cdh--float"
      :style="{
        left: floatRect.x + 'px',
        top: floatRect.y + 'px',
        width: floatRect.w + 'px',
        height: floatRect.h + 'px',
      }"
    >
      <CaseDetailModal
        :mode="effectiveMode"
        class="cdh__modal"
        @set-mode="setMode"
        @drag-start="onDragStart"
      />
      <div class="cdh__resize-corner" @mousedown="onResizeStart">
        <i class="bx bx-expand-alt"></i>
      </div>
    </div>
  </Teleport>

  <!-- Página completa: cubre el área del contenedor padre -->
  <div v-else-if="effectiveMode === 'full'" class="cdh cdh--full">
    <CaseDetailModal :mode="effectiveMode" class="cdh__modal" @set-mode="setMode" />
  </div>

  <!-- Docked (right/left): el padre controla ancho/orden -->
  <div v-else class="cdh cdh--docked" :class="'cdh--' + effectiveMode">
    <CaseDetailModal :mode="effectiveMode" class="cdh__modal" @set-mode="setMode" />
  </div>
</template>

<style scoped>
.cdh__modal { height: 100%; }

/* ── Docked ── */
.cdh--docked {
  height: 100%;
  min-width: 320px;
}
.cdh--left :deep(.cdp) {
  border-left: none;
  border-right: 1px solid var(--border-light);
}

/* ── Full ── */
.cdh--full {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--bg-main);
}
.cdh--full :deep(.cdp) { border-left: none; }
.cdh--full :deep(.cdp__body) {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
}

/* ── Float ── */
.cdh--float {
  position: fixed;
  z-index: 300;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  box-shadow: 0 24px 64px rgba(8, 14, 30, 0.38), 0 4px 16px rgba(8, 14, 30, 0.22);
  background: var(--bg-main);
  display: flex;
  flex-direction: column;
}
.cdh--float :deep(.cdp) { border-left: none; }

.cdh__resize-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: nwse-resize;
  color: var(--text-secondary);
  opacity: 0.5;
  z-index: 5;
}
.cdh__resize-corner:hover { opacity: 1; }
.cdh__resize-corner i { font-size: 0.8rem; transform: rotate(90deg); }

/* En móvil el modal interno ya se vuelve fullscreen fijo; el host no estorba */
@media (max-width: 768px) {
  .cdh--float {
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border-radius: 0;
  }
  .cdh__resize-corner { display: none; }
}
</style>
