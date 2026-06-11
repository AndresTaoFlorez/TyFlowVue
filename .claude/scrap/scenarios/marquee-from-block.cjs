/**
 * Verifica que en modo select el lazo puede ARRANCAR encima de una ventana (no
 * solo en celdas vacías) y que rozar otra ventana basta para seleccionarla.
 * Crea 3 ventanas en columnas, arrastra desde el bloque 0 rozando el bloque 1 →
 * deben quedar 2 seleccionadas (no la 3ª).
 */
module.exports = async ({ page, sleep, shot, getText }) => {
  const log = (...a) => console.log('[mq-block]', ...a)

  const ids = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    pinia._s.get('preferences').theme = 'light'
    document.documentElement.setAttribute('data-theme', 'light')
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.(); await users.loadSelects?.()
    const specs = users.users.filter(u => u.specialistId).slice(0, 3)
    const apps = users.applications
    const D = '2026-06-13'
    // Tiempos distintos → 3 columnas (no agrupan), solapadas.
    const created = await cal.createWindows([
      { specialistId: specs[0].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
      { specialistId: specs[1].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:30', endTime: '12:30' },
      { specialistId: specs[2].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '10:00', endTime: '13:00' },
    ])
    return created.map(w => w.id)
  })
  log('creadas', ids)
  await sleep(1500)

  // Activar modo select (clic real en el botón).
  const r = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.toolbar__tool-btn')].find(b => b.querySelector('.bx-select-multiple'))
    if (!sel) return null
    const b = sel.getBoundingClientRect()
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })
  if (r) await page.mouse.click(r.x, r.y)
  await sleep(400)

  const rects = await page.evaluate((wids) => {
    const out = []
    for (const id of wids) for (const el of document.querySelectorAll(`[data-window-id="${id}"]`)) {
      const b = el.getBoundingClientRect()
      if (b.width > 0 && b.left >= 0 && b.right <= window.innerWidth) out.push({ id, left: b.left, right: b.right, top: b.top, bottom: b.bottom })
    }
    return out.sort((a, b) => a.left - b.left)
  }, ids)
  log('rects', rects.map(r => Math.round(r.left) + '-' + Math.round(r.right)))
  if (rects.length < 3) { log('FAIL: faltan columnas'); return }

  // Arrancar el arrastre ENCIMA del bloque 0 (centro) y rozar el bloque 1.
  const startX = (rects[0].left + rects[0].right) / 2
  const startY = (rects[0].top + rects[0].bottom) / 2
  const endX = rects[1].left + 4   // apenas un trozito del bloque 1
  const endY = startY + 30
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move((startX + endX) / 2, startY + 10)
  await page.mouse.move(endX, endY)
  await sleep(120)
  const marq = await page.evaluate(() => !!document.querySelector('.cal-marquee'))
  await page.mouse.up()
  await sleep(300)

  const count = await getText('.sel-bar__count')
  log('marquee visible durante arrastre →', marq)
  log('conteo tras lazo desde bloque 0 rozando bloque 1 →', JSON.stringify(count))
  log(/\b2\b/.test(count || '') ? 'PASS ✓ lazo desde encima + roce = 2 seleccionadas' : 'revisar')
  await shot('marquee-desde-bloque')

  await page.evaluate(async (all) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    for (const id of all) { try { await cal.deleteWindow(id) } catch {} }
  }, ids)
  log('limpieza hecha')
}
