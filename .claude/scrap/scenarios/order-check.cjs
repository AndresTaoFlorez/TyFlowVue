/**
 * Escenario: verifica el ORDEN de columnas (alfabético por especialista, luego
 * duración desc). Crea ventanas solapadas con especialistas distintos en un día
 * vacío (sáb 13 jun 2026) y registra los nombres + duraciones esperados.
 *
 *   node .claude/scrap/ui-shot.cjs --themes light --views Semana \
 *     --tag ordercheck --script .claude/scrap/scenarios/order-check.cjs
 */
module.exports = async ({ page, sleep, shot }) => {
  const log = (...a) => console.log('[order]', ...a)

  const info = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.()
    await users.loadSelects?.()
    const specs = users.users.filter(u => u.specialistId).slice(0, 4)
    const application = users.applications[0]
    const D = '2026-06-13'
    // Mismo app + especialistas DISTINTOS (el backend permite solape entre
    // especialistas distintos). Tres a 09:00–12:00 (igual duración, para que
    // el desempate quede en alfabético) + uno con duración mayor para probar el
    // desempate por tamaño contra otro del mismo nombre... usamos solo nombres.
    const created = await cal.createWindows([
      { specialistId: specs[0].specialistId, applicationId: application.id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
      { specialistId: specs[1].specialistId, applicationId: application.id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
      { specialistId: specs[2].specialistId, applicationId: application.id, scheduledDate: D, startTime: '09:00', endTime: '12:00' },
    ])
    const nameById = {}
    for (const s of specs) nameById[s.specialistId] = s.fullName
    return {
      ids: created.map(w => w.id),
      names: created.map(w => nameById[w.specialistId]),
    }
  })
  log('creadas:', info.names)
  log('orden alfabético esperado (izq→der):', [...info.names].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })))
  await sleep(1600)
  await shot('orden')

  await page.evaluate(async (ids) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    for (const id of ids) { try { await cal.deleteWindow(id) } catch {} }
  }, info.ids)
  log('limpieza hecha')
}
