import { onBeforeUnmount, nextTick } from 'vue'
import gsap from 'gsap'

/**
 * Drives the 3-page calendar buffer: translates a pre-rendered track
 * (prev | current | next) following wheel / touch gestures and commits a
 * navigation step.
 *
 * Posicionamiento con **xPercent** (relativo al ancho del propio track, que es
 * 300% del contenedor): es inmune a cambios de tamaño de pantalla/sidebar — no
 * hay px obsoletos que descuadren el layout. Centrado = -100/3 (muestra la
 * página central, índice 1).
 *
 * Al confirmar: cambia el offset del store, y en `nextTick` (antes del paint)
 * se recentra. Como las páginas se reutilizan por `key` de período, el nodo de
 * la página visible se mueve un slot a la izquierda a la vez que el track se
 * desplaza un slot a la derecha → se cancelan y el contenido NO parpadea.
 *
 * Gestos: mes = rueda vertical; semana/día = Shift+rueda; táctil = swipe horiz.
 *
 * @param {object} opts
 * @param {() => HTMLElement|null} opts.getTrack
 * @param {() => string} opts.getViewMode
 * @param {(dir:number)=>void} opts.onNavigate  dir = +1 next | -1 prev
 * @param {() => boolean} [opts.isBlocked]
 */
export function useCalendarPager({ getTrack, getViewMode, onNavigate, isBlocked }) {
  const DURATION = 0.19
  const EASE = 'power2.out'
  const STEP = 100 / 3              // un slot = 1/3 del ancho del track
  const CENTER = -STEP             // página central
  const WHEEL_COMMIT = 90          // px de delta acumulado para confirmar
  const TOUCH_COMMIT = 80          // px de arrastre para confirmar

  let animating = false
  let wheelAcc = 0
  let wheelTimer = null
  let startX = 0, startY = 0, lock = null, dragDx = 0, touchActive = false

  const _track = () => getTrack()
  const _pxToPct = (px) => {
    const t = _track()
    const w = t ? t.offsetWidth : window.innerWidth * 3
    return w ? (px / w) * 100 : 0
  }

  const _set = (pct) => {
    const t = _track()
    if (!t) return
    gsap.killTweensOf(t)
    gsap.set(t, { xPercent: pct })
  }
  const _tweenTo = (pct, onDone) => {
    const t = _track()
    if (!t) { if (onDone) onDone(); return }
    gsap.killTweensOf(t)
    gsap.to(t, { xPercent: pct, duration: DURATION, ease: EASE, onComplete: onDone })
  }

  const recenter = () => _set(CENTER)
  const isAnimating = () => animating

  const _commit = (dir) => {
    if (animating) return
    animating = true
    _tweenTo(CENTER - dir * STEP, () => {
      onNavigate(dir)
      // Recentrar tras el patch del DOM (microtask) y antes del paint:
      // el nodo reutilizado y el desplazamiento se cancelan → sin parpadeo.
      nextTick(() => { recenter(); animating = false })
    })
  }

  const _springBack = () => _tweenTo(CENTER)

  /** Anima una navegación ±1 ya aplicada al offset (botones / "Hoy"). */
  const animateNav = (dir) => {
    if (animating) return
    animating = true
    _set(dir > 0 ? 0 : CENTER - STEP)   // old page now at index 0 (next) / 2 (prev)
    _tweenTo(CENTER, () => { animating = false })
  }

  // ---- Wheel ----
  const onWheel = (e) => {
    if (isBlocked && isBlocked()) return
    const view = getViewMode()
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)
    // month: cualquier scroll navega (no hay horas que recorrer).
    // week/día: Shift+rueda (mouse) O swipe horizontal de trackpad (deltaX
    // dominante); el scroll vertical normal queda libre para las horas.
    const qualifies = view === 'month' ? !e.ctrlKey : (e.shiftKey || horizontal)
    if (!qualifies) return
    e.preventDefault()
    if (animating) return
    const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    wheelAcc += delta
    const t = _track()
    const pageW = t ? t.offsetWidth / 3 : window.innerWidth
    const clamped = Math.max(-pageW, Math.min(pageW, wheelAcc))
    _set(CENTER - _pxToPct(clamped))

    if (Math.abs(wheelAcc) >= pageW) {
      clearTimeout(wheelTimer)
      const dir = wheelAcc > 0 ? 1 : -1
      wheelAcc = 0
      _commit(dir)
      return
    }
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(() => {
      if (Math.abs(wheelAcc) >= WHEEL_COMMIT) {
        const dir = wheelAcc > 0 ? 1 : -1
        wheelAcc = 0
        _commit(dir)
      } else {
        wheelAcc = 0
        _springBack()
      }
    }, 110)
  }

  // ---- Touch ----
  const onTouchStart = (e) => {
    if (isBlocked && isBlocked()) return
    if (animating) return
    const t = e.touches[0]
    if (!t) return
    startX = t.clientX; startY = t.clientY; lock = null; dragDx = 0; touchActive = true
  }
  const onTouchMove = (e) => {
    if (!touchActive) return
    if (isBlocked && isBlocked()) return
    if (animating) return
    const t = e.touches[0]
    if (!t) return
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (lock === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      lock = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
    }
    if (lock !== 'h') return
    if (e.cancelable) e.preventDefault()
    dragDx = dx
    _set(CENTER + _pxToPct(dx))
  }
  const onTouchEnd = () => {
    const wasActive = touchActive
    touchActive = false
    if (!wasActive || lock !== 'h') { lock = null; return }
    lock = null
    if (Math.abs(dragDx) >= TOUCH_COMMIT) _commit(dragDx > 0 ? -1 : 1)
    else _springBack()
    dragDx = 0
  }

  onBeforeUnmount(() => {
    clearTimeout(wheelTimer)
    const t = _track()
    if (t) gsap.killTweensOf(t)
  })

  return { onWheel, onTouchStart, onTouchMove, onTouchEnd, recenter, animateNav, isAnimating }
}
