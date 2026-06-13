/**
 * color.js — Módulo de detección de color y texto legible.
 * ============================================================================
 *
 * Fuente ÚNICA y reutilizable para elegir un color de TEXTO estable y legible
 * sobre cualquier fondo (claro, oscuro o intermedio). Úsalo en TODAS PARTES
 * donde un color dinámico (color de aplicación, hash de nombre, carga, etc.)
 * pinte el fondo de un chip / pill / bloque y necesite texto encima:
 * calendario (work windows + pills), módulo de cases, badges, avatares…
 *
 * Idea clave: el texto NO se deriva "tiñendo el mismo color del fondo" (eso da
 * contraste inestable). En su lugar se parte del color de origen (para que el
 * texto conserve un tono propio y único, relacionado con la app) y se mezcla
 * lo MÍNIMO necesario hacia negro o blanco hasta garantizar un contraste WCAG
 * estable contra el fondo REAL renderizado. Así el tono del texto varía según
 * el fondo sea claro / oscuro / intermedio, pero siempre es legible.
 *
 * Funciones puras (sin DOM):
 *   parseColor, toHex, mix, relativeLuminance, contrastRatio
 * Resolución de colores CSS (con DOM, resuelve var()/color-mix()/nombres):
 *   resolveCssColor
 * API principal:
 *   readableTextColor(bg, source?, opts?)  → hex string
 *
 * NOTA de reactividad: `resolveCssColor` lee el valor RESUELTO de las CSS vars
 * (p.ej. --bg-card), que cambia con el tema [data-theme]. En componentes Vue,
 * incluye `usePreferencesStore().theme` como dependencia del computed para que
 * el texto se recalcule al cambiar de tema.
 */

// ---- Parsing ----------------------------------------------------------------

/**
 * Convierte una cadena de color simple a {r,g,b} (0-255).
 * Soporta #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(). No resuelve var()/
 * color-mix() (para eso usa resolveCssColor).
 * @returns {{r:number,g:number,b:number}|null}
 */
export function parseColor(input) {
  if (input == null) return null
  if (typeof input === 'object' && 'r' in input) return input
  let s = String(input).trim()

  if (s[0] === '#') {
    s = s.slice(1)
    if (s.length === 3 || s.length === 4) {
      s = s.split('').map(c => c + c).join('')
    }
    if (s.length >= 6) {
      return {
        r: parseInt(s.slice(0, 2), 16),
        g: parseInt(s.slice(2, 4), 16),
        b: parseInt(s.slice(4, 6), 16),
      }
    }
    return null
  }

  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] }
  }

  // Algunos navegadores serializan color computado como `color(srgb r g b)`
  // (componentes 0-1), p.ej. al resolver color-mix/gamut amplio.
  const cm = s.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (cm) {
    return { r: +cm[1] * 255, g: +cm[2] * 255, b: +cm[3] * 255 }
  }
  return null
}

/** {r,g,b} → '#rrggbb' (defensivo: null → negro). */
export function toHex(rgb) {
  if (!rgb) return '#000000'
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`
}

/**
 * Mezcla lineal en sRGB: resultado = a*(1-t) + b*t.
 * Equivale a color-mix(in srgb, B (t*100)%, A) — t es la fracción de `b`.
 */
export function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

// ---- Luminance & contrast (WCAG 2.1) ---------------------------------------

const _toLinear = (c) => {
  const x = c / 255
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
export function relativeLuminance(color) {
  const c = parseColor(color)
  if (!c) return 0.5
  return 0.2126 * _toLinear(c.r) + 0.7152 * _toLinear(c.g) + 0.0722 * _toLinear(c.b)
}

/** Razón de contraste WCAG entre dos colores (1 … 21). */
export function contrastRatio(c1, c2) {
  const l1 = relativeLuminance(c1)
  const l2 = relativeLuminance(c2)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// ---- CSS color resolution (var(), color-mix(), nombres) --------------------

let _probe = null
/**
 * Resuelve cualquier color CSS (incluido var(), color-mix(), nombres) a {r,g,b}
 * usando un elemento sonda oculto, leyendo getComputedStyle. Theme-aware: las
 * CSS vars se resuelven contra el [data-theme] actual. Devuelve null sin DOM.
 */
export function resolveCssColor(value) {
  if (typeof document === 'undefined' || !document.body) return parseColor(value)
  if (!_probe) {
    _probe = document.createElement('span')
    // Estructura en CSS (.css-color-probe en reset.css); aquí solo se asigna el
    // `color` a medir, que es inherente a la sonda.
    _probe.className = 'css-color-probe'
    document.body.appendChild(_probe)
  }
  _probe.style.color = ''
  _probe.style.color = value
  const resolved = getComputedStyle(_probe).color
  return parseColor(resolved) || parseColor(value)
}

const _toRgb = (x) => parseColor(x) || resolveCssColor(x) || { r: 128, g: 128, b: 128 }

// ---- API principal ----------------------------------------------------------

/**
 * Devuelve un color de TEXTO legible (hex) sobre `bg`. Parte de un neutro
 * limpio (negro o blanco, el que más contraste dé) y le añade un TOQUE SUTIL
 * del tono de `source`, garantizando el contraste objetivo. Esto da un texto
 * nítido y serio (no turbio) que se ve bien tanto en tema claro como oscuro,
 * con un tono propio y único que varía según el fondo sea claro/oscuro.
 *
 * Diseño: sesgamos hacia el neutro (no hacia el color) — maximizar el tono
 * produce texto turbio y poco legible, sobre todo en dark mode. El `tint`
 * controla cuánto color se insinúa; si no alcanza el contraste, se reduce.
 *
 * @param {string|object} bg      fondo real (acepta var()/color-mix()/hex/rgb).
 * @param {string|object} [source=bg]  color base cuyo tono se insinúa (color de la app).
 * @param {object} [opts]
 * @param {number} [opts.minContrast=4.5]  contraste WCAG objetivo (AA texto normal).
 * @param {number} [opts.tint=0.22]        fracción de tono del `source` sobre el neutro (0-1).
 * @returns {string} hex
 */
export function readableTextColor(bg, source = bg, opts = {}) {
  const { minContrast = 4.5, tint = 0.22 } = opts
  const bgC = _toRgb(bg)
  const srcC = _toRgb(source)

  // Neutro base: el que más contraste da contra el fondo.
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const anchor = contrastRatio(black, bgC) >= contrastRatio(white, bgC) ? black : white

  // Neutro + toque de tono; si no cumple el contraste, reduce el tono hacia el neutro.
  let t = tint
  let c = mix(anchor, srcC, t)
  for (let i = 0; i < 8 && contrastRatio(c, bgC) < minContrast; i++) {
    t *= 0.6
    c = mix(anchor, srcC, t)
  }
  // Garantía dura: si ni el neutro casi puro alcanza, usa el neutro.
  if (contrastRatio(c, bgC) < minContrast) c = anchor
  return toHex(c)
}

/**
 * Conveniencia para fondos "tinte de color sobre una superficie" (el patrón de
 * las work windows / pills): calcula el fondo real `color-mix(in srgb, color
 * pct%, var(surfaceVar))`, resuelve según el tema y devuelve el texto legible.
 *
 * @param {string} color        color de origen (hex de la app).
 * @param {object} [opts]
 * @param {number} [opts.pct=32]            % del color sobre la superficie.
 * @param {string} [opts.surfaceVar='--wb-surface']  CSS var de la superficie.
 * @param {number} [opts.minContrast=4.5]
 * @returns {string} hex
 */
export function readableTextOnTint(color, opts = {}) {
  const { pct = 32, surfaceVar = '--wb-surface', minContrast = 4.5 } = opts
  // Mezcla en JS (no enviamos color-mix al navegador: algunos serializan el
  // resultado como color(srgb …) y rompía el parseo).
  const surface = _toRgb(`var(${surfaceVar})`)
  const bgRgb = mix(surface, _toRgb(color), pct / 100)
  return readableTextColor(bgRgb, color, { minContrast })
}

/** ¿Tema oscuro activo? Lee [data-theme] del documento. */
export function isDarkTheme() {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

/**
 * Superficie de bloque "tinte de app" + texto, theme-aware y como FUENTE ÚNICA
 * del color final. El problema en dark mode era que tintar el color de la app
 * sobre el gris de la tarjeta lo dejaba turbio/apagado; aquí, en oscuro, se usa
 * más proporción de color sobre `--wb-surface` (casi-negro) para mantenerlo
 * vivo. En claro conserva el pastel actual. Devuelve hex resueltos.
 *
 * @param {string} color  color de la app (hex).
 * @param {object} [opts]
 * @param {number} [opts.lightPct=32]  % de color en tema claro.
 * @param {number} [opts.darkPct=46]   % de color en tema oscuro (más vivo).
 * @param {string} [opts.surfaceVar='--wb-surface']
 * @returns {{ bg: string, text: string }}
 */
export function appTintSurface(color, opts = {}) {
  const { lightApp = 0.82, darkApp = 0.9, surfaceVar = '--wb-surface', minContrast = 4.5 } = opts
  // Fondo = color de la app con un LEVE filtro hacia la superficie del tema
  // (suaviza un poco en claro, mantiene vivo en oscuro) — el color sigue siendo
  // claramente el de la aplicación, solo se asienta mejor en ambos temas.
  const frac = isDarkTheme() ? darkApp : lightApp
  const surface = _toRgb(`var(${surfaceVar})`)
  const app = _toRgb(color)
  const bgRgb = mix(surface, app, frac)
  return { bg: toHex(bgRgb), text: readableTextColor(bgRgb, app, { minContrast }) }
}
