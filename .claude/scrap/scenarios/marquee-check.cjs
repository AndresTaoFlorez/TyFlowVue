/**
 * Escenario: verifica el marquee 2D GRANULAR del modo select. Crea 3 ventanas
 * solapadas (3 columnas) en un día vacío, entra en modo select y arrastra un
 * rectángulo que cubre SOLO las 2 primeras columnas → debe seleccionar 2, no 3.
 *
 *   node .claude/scrap/ui-shot.cjs --themes light --views Semana \
 *     --tag marquee --script .claude/scrap/scenarios/marquee-check.cjs
 */
module.exports = async ({ page, sleep, shot, pressKey, getText }) => {
  const log = (...a) => console.log('[marquee]', ...a)

  const ids = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.()
    await users.loadSelects?.()
    const specs = users.users.filter(u => u.specialistId).slice(0, 3)
    const application = users.applications[0]
    const D = '2026-06-13'
    const created = await cal.createWindows(
      specs.map(s => ({ specialistId: s.specialistId, applicationId: application.id, scheduledDate: D, startTime: '09:00', endTime: '12:00' }))
    )
    return created.map(w => w.id)
  })
  log('creadas', ids)
  await sleep(1600)

  // Entrar en modo select (tecla S).
  await pressKey('s')
  await sleep(300)

  // Rects on-screen de los 3 bloques (página central), ordenados por x.
  const rects = await page.evaluate((wids) => {
    const out = []
    for (const id of wids) {
      for (const el of document.querySelectorAll(`[data-window-id="${id}"]`)) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.left >= 0 && r.right <= window.innerWidth) {
          out.push({ id, left: r.left, right: r.right, top: r.top, bottom: r.bottom })
        }
      }
    }
    return out.sort((a, b) => a.left - b.left)
  }, ids)
  log('rects', rects.map(r => Math.round(r.left) + '-' + Math.round(r.right)))

  if (rects.length < 3) { log('FAIL: no se renderizaron 3 columnas'); return }

  // Marquee desde una celda VACÍA arriba del bloque 0 hasta cubrir bloques 0 y 1
  // (terminando antes del bloque 2). Selección esperada = 2.
  const startX = rects[0].left + 2
  const startY = rects[0].top - 40
  const endX = rects[1].right - 2
  const endY = rects[1].bottom - 6

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move((startX + endX) / 2, (startY + endY) / 2)
  await page.mouse.move(endX, endY)
  await page.mouse.up()
  await sleep(400)

  const count = await getText('.sel-bar__count')
  log('conteo tras marquee sobre 2 de 3 →', JSON.stringify(count))
  log(/\b2\b/.test(count || '') ? 'PASS ✓ selección granular (2 de 3)' : 'FAIL ✗')
  await shot('marquee-2-de-3')

  // Cleanup
  await page.evaluate(async (all) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    for (const id of all) { try { await cal.deleteWindow(id) } catch {} }
  }, ids)
  log('limpieza hecha')
}
