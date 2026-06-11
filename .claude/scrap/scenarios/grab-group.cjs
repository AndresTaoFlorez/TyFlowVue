/**
 * Verifica que el lazo agarra los bloques de GRUPO (ventanas con rango idéntico,
 * sin data-window-id individual sino data-window-ids). Crea 3 idénticas → 1
 * grupo; lazo sobre él → 3 seleccionadas.
 */
module.exports = async ({ page, sleep, getText }) => {
  const log = (...a) => console.log('[grab-grp]', ...a)

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
    // Rango EXACTO idéntico → agrupan en un solo bloque.
    const created = await cal.createWindows(
      specs.map(s => ({ specialistId: s.specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:00', endTime: '12:00' }))
    )
    return created.map(w => w.id)
  })
  log('creadas', ids)
  await sleep(1500)

  const tb = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.toolbar__tool-btn')].find(b => b.querySelector('.bx-select-multiple'))
    if (!sel) return null
    const b = sel.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })
  if (tb) await page.mouse.click(tb.x, tb.y)
  await sleep(400)

  const g = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-window-ids]')].find(e => {
      const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= window.innerWidth
    })
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, count: el.dataset.windowIds.split(',').length }
  })
  log('grupo en DOM →', JSON.stringify(g))
  if (!g) { log('FAIL: no se encontró bloque de grupo'); return }

  // Lazo desde celda vacía arriba, cubriendo el grupo.
  await page.mouse.move(g.left - 6, g.top - 40)
  await page.mouse.down()
  await page.mouse.move((g.left + g.right) / 2, (g.top + g.bottom) / 2)
  await page.mouse.move(g.right + 6, g.bottom + 10)
  await page.mouse.up()
  await sleep(300)

  const count = await getText('.sel-bar__count')
  log('conteo tras lazo sobre el grupo →', JSON.stringify(count), '| esperado', g.count)
  log(new RegExp('\\b' + g.count + '\\b').test(count || '') ? `PASS ✓ el lazo agarró las ${g.count} del grupo` : 'FAIL ✗')

  await page.evaluate(async (all) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    for (const id of all) { try { await cal.deleteWindow(id) } catch {} }
  }, ids)
  log('limpieza hecha')
}
