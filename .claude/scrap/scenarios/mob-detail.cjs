/**
 * Escenario (móvil): verifica el DETALLE de ventana a pantalla completa con las
 * acciones de contexto dentro (Copiar/Cortar/Agregar especialista), reusando el
 * deep-link ?window=<id>.
 *
 *   node .claude/scrap/ui-shot.cjs --themes light --views "" --viewport 390x844 \
 *     --tag mob-detail --script .claude/scrap/scenarios/mob-detail.cjs
 *
 * Crea 1 ventana futura, abre su detalle por router push, captura, limpia.
 */
module.exports = async ({ page, sleep, shot }) => {
  const log = (...a) => console.log('[mob-detail]', ...a)

  const id = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.()
    await users.loadSelects?.()
    const spec = users.users.find(u => u.specialistId)
    const application = users.applications[0]
    const created = await cal.createWindows([
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: '2026-06-12', startTime: '10:00', endTime: '11:00' },
    ])
    return created[0].id
  })
  log('creada', id)
  await sleep(800)

  // Abrir el detalle por deep-link (?window=) usando el router de la app.
  await page.evaluate((wid) => {
    const app = document.querySelector('#app').__vue_app__
    app.config.globalProperties.$router.push({ path: '/app/calendar', query: { window: wid } })
  }, id)
  await sleep(900)
  await shot('detalle')

  // Limpieza
  await page.evaluate(async (wid) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    try { await cal.deleteWindow(wid) } catch {}
  }, id)
  log('limpieza hecha')
}
