/**
 * Verifica el CRDT Last-Write-Wins en _mergeWindows: una ventana movida
 * localmente hace poco (sellada con _localUpdatedAt) NO debe ser pisada por un
 * fetch en background que trae su posición vieja (= no "salta").
 *
 * Estrategia: crear W en una semana LEJANA (no cargada), moverla localmente +
 * sellarla SIN avisar al backend, navegar a esa semana (dispara fetch+merge con
 * la posición vieja del server) y comprobar que sigue en la posición local.
 */
module.exports = async ({ page, sleep }) => {
  const log = (...a) => console.log('[crdt]', ...a)
  const FAR = '2027-06-15'

  const res = await page.evaluate(async (FAR) => {
    const app = document.querySelector('#app').__vue_app__
    const cal = app.config.globalProperties.$pinia._s.get('calendar')
    const users = app.config.globalProperties.$pinia._s.get('users')
    await users.loadUsers?.(); await users.loadSelects?.()
    const spec = users.users.find(u => u.specialistId)
    const application = users.applications[0]
    const created = await cal.createWindows([
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: FAR, startTime: '09:00', endTime: '11:00' },
    ])
    const id = created[0].id
    const W = cal.windows.find(w => w.id === id)
    const origStart = W.startTime

    // Mover localmente +5h y sellar (CRDT), SIN llamar al backend.
    const moved = Object.assign(Object.create(Object.getPrototypeOf(W)), W)
    moved.startsAt = new Date(new Date(W.startsAt).getTime() + 5 * 3600 * 1000).toISOString()
    moved.endsAt = new Date(new Date(W.endsAt).getTime() + 5 * 3600 * 1000).toISOString()
    moved.withLocalUpdate()
    const movedStart = moved.startTime
    cal.windows = cal.windows.map(w => (w.id === id ? moved : w))

    return { id, origStart, movedStart }
  }, FAR)
  log('creada', res.id, '| orig', res.origStart, '| movida(local)', res.movedStart)

  // Navegar a la semana lejana → dispara loadWindows (fetch trae la pos vieja).
  await page.evaluate((FAR) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    cal.goToDate(FAR)
  }, FAR)
  await sleep(2500)

  const after = await page.evaluate((id) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const w = cal.windows.find(x => x.id === id)
    return w ? w.startTime : null
  }, res.id)
  log('startTime tras fetch+merge →', after)
  log(after === res.movedStart ? 'PASS ✓ el cambio local reciente sobrevivió (no saltó)'
                               : `FAIL ✗ saltó a ${after} (esperaba ${res.movedStart})`)

  // Cleanup
  await page.evaluate(async (id) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    try { await cal.deleteWindow(id) } catch {}
  }, res.id)
  log('limpieza hecha')
}
