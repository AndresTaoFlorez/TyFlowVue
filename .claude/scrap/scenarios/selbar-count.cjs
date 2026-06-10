/**
 * Escenario: verifica que sel-bar__count NO se queda pegado cuando una ventana
 * seleccionada desaparece por otra vía (reconciliación del Set en CalendarioView).
 *
 *   node .claude/scrap/ui-shot.cjs --themes light --views "" \
 *     --tag selbar --script .claude/scrap/scenarios/selbar-count.cjs
 *
 * Flujo: crea 3 ventanas de prueba (días distintos, futuro) vía store → entra en
 * modo select (tecla S) → ctrl+click en las 3 → conteo "3" → borra UNA por fuera
 * de la sel-bar (cal.deleteWindow, simula borrador/menú/undo) → conteo debe bajar
 * a "2". Limpia las ventanas de prueba al final.
 *
 * Crea datos reales: si el proceso se corta a la mitad, pueden quedar ventanas de
 * prueba el 11–13 jun 2026 (especialista/app primeros disponibles) — borrar a mano.
 */
module.exports = async ({ page, sleep, shot, pressKey, getText }) => {
  const log = (...a) => console.log('[selbar]', ...a)

  // 1) Crear 3 ventanas de prueba en días distintos (sin agrupar), en el futuro.
  const ids = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.()
    await users.loadSelects?.()
    const spec = users.users.find(u => u.specialistId)
    const application = users.applications[0]
    if (!spec || !application) throw new Error('faltan especialista/aplicación de prueba')
    const created = await cal.createWindows([
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: '2026-06-11', startTime: '09:00', endTime: '10:00' },
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: '2026-06-12', startTime: '11:00', endTime: '12:00' },
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: '2026-06-13', startTime: '13:00', endTime: '14:00' },
    ])
    return created.map(w => w.id)
  })
  log('creadas', ids)
  await sleep(1500)

  // 2) Entrar en modo select con la tecla S (verifica también el atajo).
  await pressKey('s')
  await sleep(400)

  // 3) Seleccionar las 3 con ctrl+click (acumula en lugar de reemplazar).
  await page.keyboard.down('Control')
  for (const id of ids) {
    const sel = `[data-window-id="${id}"]`
    try { await page.click(sel) } catch (e) { log('no se pudo click', id, e.message) }
    await sleep(150)
  }
  await page.keyboard.up('Control')
  await sleep(400)

  const countBefore = await getText('.sel-bar__count')
  log('conteo tras seleccionar 3 →', JSON.stringify(countBefore))
  await shot('1-tres-seleccionadas')

  // 4) Borrar UNA ventana por fuera de la sel-bar (simula borrador/menú/undo:
  //    cambia calStore.windows sin tocar la selección). El watcher debe podar.
  await page.evaluate(async (victimId) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    await cal.deleteWindow(victimId)
  }, ids[0])
  await sleep(800)

  const countAfter = await getText('.sel-bar__count')
  log('conteo tras borrar 1 →', JSON.stringify(countAfter))
  await shot('2-dos-seleccionadas')

  // 5) Veredicto.
  const ok = /\b3\b/.test(countBefore || '') && /\b2\b/.test(countAfter || '')
  log(ok ? 'PASS ✓ el conteo se reconcilió (3 → 2)' : 'FAIL ✗ conteo inesperado')

  // 6) Limpieza: borrar las ventanas de prueba restantes.
  await page.evaluate(async (remaining) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    for (const id of remaining) { try { await cal.deleteWindow(id) } catch {} }
  }, ids.slice(1))
  log('limpieza hecha')
}
