import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * Módulo de tipografía adaptativa.
 *
 * A diferencia de las unidades CSS `cqh`/`cqw` (que dependen de un solo eje y
 * topan rápido con `clamp`), aquí se mide el tamaño REAL renderizado del div
 * contenedor (ancho Y alto, vía ResizeObserver) y, además, se considera el
 * ancho del viewport del navegador. Con ambos datos se calcula un tamaño de
 * fuente en px para que el texto se vea bien dentro de su caja: un bloque
 * ancho y alto recibe texto más grande; uno angosto o bajo lo mantiene
 * compacto.
 */

/**
 * Función pura: dado el tamaño de la caja (px) devuelve un font-size (px).
 *
 * @param {number} w  ancho del contenedor en px
 * @param {number} h  alto del contenedor en px
 * @param {object} opts
 * @param {number} opts.min          tamaño mínimo en px
 * @param {number} opts.max          tamaño máximo en px
 * @param {number} opts.base         tamaño de referencia en px
 * @param {number} opts.refWidth     ancho donde el font === base
 * @param {number} opts.refHeight    alto donde el font === base
 * @param {number} opts.widthWeight  peso del ancho vs alto (0..1)
 * @param {number} opts.viewportNudge px añadidos por cada px de viewport sobre refViewport
 * @param {number} opts.refViewport  ancho de viewport de referencia
 */
export function fitFontSize(w, h, opts = {}) {
  const {
    min = 11,
    max = 18,
    base = 12.5,
    refWidth = 150,
    refHeight = 64,
    widthWeight = 0.6,
    viewportNudge = 0.0035,
    refViewport = 1440,
  } = opts

  if (!w || !h) return base

  const wRatio = w / refWidth
  const hRatio = h / refHeight
  // Mezcla geométrica ponderada de ambos ejes: ninguno domina por completo,
  // así el texto no desborda cajas angostas ni queda diminuto en cajas grandes.
  const ratio = Math.pow(wRatio, widthWeight) * Math.pow(hRatio, 1 - widthWeight)
  let size = base * ratio

  // Aporte secundario del viewport (monitores 2K/4K más amplios).
  if (typeof window !== 'undefined') {
    size += Math.max(0, window.innerWidth - refViewport) * viewportNudge
  }

  return Math.min(max, Math.max(min, size))
}

/**
 * Observa el tamaño renderizado de un elemento.
 * @param {import('vue').Ref<HTMLElement|null>} elRef
 * @returns {{ width: import('vue').Ref<number>, height: import('vue').Ref<number> }}
 */
export function useElementSize(elRef) {
  const width = ref(0)
  const height = ref(0)
  let ro = null
  let el = null

  const read = () => {
    if (!el) return
    width.value = el.clientWidth
    height.value = el.clientHeight
  }

  const attach = (node) => {
    if (ro) { ro.disconnect(); ro = null }
    el = node || null
    if (!el || typeof ResizeObserver === 'undefined') { read(); return }
    ro = new ResizeObserver(read)
    ro.observe(el)
    read()
  }

  watch(elRef, attach, { immediate: true })
  onBeforeUnmount(() => { if (ro) ro.disconnect() })

  return { width, height }
}

/**
 * Tipografía adaptativa lista para usar: enlaza un elemento y devuelve un
 * font-size reactivo en px, recalculado al cambiar la caja o el viewport.
 *
 * @param {import('vue').Ref<HTMLElement|null>} elRef
 * @param {object} opts  ver {@link fitFontSize}
 * @returns {{ fontSize: import('vue').Ref<number>, width: import('vue').Ref<number>, height: import('vue').Ref<number> }}
 */
export function useAdaptiveFont(elRef, opts = {}) {
  const { width, height } = useElementSize(elRef)
  const fontSize = ref(opts.base ?? 12.5)

  const update = () => { fontSize.value = fitFontSize(width.value, height.value, opts) }

  watch([width, height], update, { immediate: true })

  const onResize = () => update()
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize, { passive: true })
  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', onResize)
  })

  return { fontSize, width, height }
}
