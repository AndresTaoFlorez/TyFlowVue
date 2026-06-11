/**
 * Verifica que el recuadro de selección (marquee) SE VE durante el arrastre.
 * No necesita ventanas: entra en modo select, arrastra en una zona del grid y
 * comprueba que .cal-marquee existe y queda dentro de la pantalla (antes el
 * Teleport faltaba y el position:fixed lo sacaba de cuadro).
 */
module.exports = async ({ page, sleep, shot, pressKey }) => {
  const log = (...a) => console.log('[marquee-vis]', ...a)

  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    pinia._s.get('preferences').theme = 'light'
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await sleep(1500)
  // Activar modo select con un CLIC REAL de mouse sobre el botón.
  const r = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.toolbar__tool-btn')]
    const sel = btns.find(b => b.querySelector('.bx-select-multiple'))
    if (!sel) return null
    const b = sel.getBoundingClientRect()
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })
  if (r) await page.mouse.click(r.x, r.y)
  await sleep(400)
  const selMode = await page.evaluate(() => !!document.querySelector('.cal--select-tool'))
  log('modo select activo →', selMode)

  // Arrastrar en LUN 8 (columna vacía) hacia abajo. (Sidebar ~256px + gutter ~56px
  // → LUN 8 empieza ~312px; uso x=400 para caer dentro de la columna.)
  await page.mouse.move(400, 300)
  await page.mouse.down()
  await page.mouse.move(450, 440)
  await page.mouse.move(500, 540)
  await sleep(150)

  const vis = await page.evaluate(() => {
    const m = document.querySelector('.cal-marquee')
    if (!m) return { exists: false }
    const b = m.getBoundingClientRect()
    const cs = getComputedStyle(m)
    return {
      exists: true,
      w: Math.round(b.width), h: Math.round(b.height),
      left: Math.round(b.left), top: Math.round(b.top),
      onscreen: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
      border: cs.borderTopStyle, bg: cs.backgroundColor,
    }
  })
  log('marquee →', JSON.stringify(vis))
  log(vis.exists && vis.onscreen && vis.w > 50 ? 'PASS ✓ recuadro visible y en pantalla' : 'FAIL ✗')
  await shot('marquee-mid-drag')
  await page.mouse.up()
}
