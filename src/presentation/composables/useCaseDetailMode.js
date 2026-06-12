import { ref, watch } from 'vue'

// Modo de presentación del detalle de caso, compartido entre CasesView y
// CaseDetailHost (estado a nivel de módulo: una sola fuente de verdad).
// 'right' | 'left' | 'float' | 'full'
const MODE_KEY = 'tyflow_case_detail_mode'
const RECT_KEY = 'tyflow_case_detail_float_rect'
const VALID_MODES = ['right', 'left', 'float', 'full']

function _loadMode() {
  const saved = localStorage.getItem(MODE_KEY)
  return VALID_MODES.includes(saved) ? saved : 'right'
}

function _loadRect() {
  try {
    const r = JSON.parse(localStorage.getItem(RECT_KEY))
    if (r && Number.isFinite(r.x) && Number.isFinite(r.y) &&
        Number.isFinite(r.w) && Number.isFinite(r.h)) return r
  } catch { /* corrupt — fall through to default */ }
  return { x: Math.max(40, window.innerWidth - 600), y: 90, w: 540, h: Math.min(720, window.innerHeight - 140) }
}

const mode = ref(_loadMode())
const floatRect = ref(_loadRect())

watch(mode, (m) => localStorage.setItem(MODE_KEY, m))
watch(floatRect, (r) => localStorage.setItem(RECT_KEY, JSON.stringify(r)), { deep: true })

export function useCaseDetailMode() {
  function setMode(m) {
    if (VALID_MODES.includes(m)) mode.value = m
  }

  // Mantiene la ventana flotante dentro del viewport
  function clampFloatRect() {
    const r = floatRect.value
    r.w = Math.min(Math.max(360, r.w), window.innerWidth - 24)
    r.h = Math.min(Math.max(280, r.h), window.innerHeight - 24)
    r.x = Math.min(Math.max(12 - r.w + 80, r.x), window.innerWidth - 80)
    r.y = Math.min(Math.max(0, r.y), window.innerHeight - 60)
  }

  return { mode, setMode, floatRect, clampFloatRect }
}
