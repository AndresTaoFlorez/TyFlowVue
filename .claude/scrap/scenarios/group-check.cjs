/**
 * Verifica el agrupado SOLO por starts_at+ends_at idénticos: 3 ventanas con el
 * mismo rango exacto (distintos especialistas) → UN bloque con varios avatares;
 * una con rango distinto → bloque separado.
 */
module.exports = async ({ page, sleep, shot }) => {
  const log = (...a) => console.log('[group]', ...a)

  const info = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const prefs = pinia._s.get('preferences'); prefs.theme = 'light'
    document.documentElement.setAttribute('data-theme', 'light')
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.(); await users.loadSelects?.()
    const specs = users.users.filter(u => u.specialistId).slice(0, 3)
    const apps = users.applications
    const D = '2026-06-13'
    const items = [
      // 3 con rango EXACTO idéntico (09:00–12:00), misma app, distintos especialistas → agrupan
      { specialistId: specs[0].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
      { specialistId: specs[1].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
      { specialistId: specs[2].specialistId, applicationId: apps[0].id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
    ]
    // 1 con rango distinto → NO agrupa (columna aparte). Solo si hay 2ª app, para
    // no chocar con la 1ª ventana (mismo especialista+app no puede solaparse).
    if (apps[1]) items.push({ specialistId: specs[0].specialistId, applicationId: apps[1].id, scheduledDate: D, startTime: '09:00', endTime: '13:00' })
    const created = await cal.createWindows(items)
    return { ids: created.map(w => w.id), names: specs.map(s => s.fullName) }
  })
  log('creadas; especialistas del grupo:', info.names)
  await sleep(1700)

  const dom = await page.evaluate(() => ({
    grupos: document.querySelectorAll('.wgb').length,
    avataresEnGrupo: document.querySelector('.wgb') ? document.querySelectorAll('.wgb .wgb__avatar').length : 0,
    bloquesSimples: document.querySelectorAll('.wb').length,
  }))
  log('DOM →', JSON.stringify(dom))
  log(dom.grupos === 1 && dom.avataresEnGrupo >= 3 ? 'PASS ✓ 1 grupo con 3 avatares' : 'revisar')
  await shot('grupo-avatares')

  await page.evaluate(async (ids) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    for (const id of ids) { try { await cal.deleteWindow(id) } catch {} }
  }, info.ids)
  log('limpieza hecha')
}
