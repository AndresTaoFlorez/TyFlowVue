/**
 * Verifica que el FRONT rechaza mover una ventana al pasado (sin tocar backend ni
 * dejar el estado a medias / desaparecer), y que un movimiento futuro válido sí
 * funciona.
 */
module.exports = async ({ page, sleep }) => {
  const log = (...a) => console.log('[resched]', ...a)

  const res = await page.evaluate(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const users = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('users')
    await users.loadUsers?.(); await users.loadSelects?.()
    const spec = users.users.find(u => u.specialistId)
    const application = users.applications[0]
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    // Crear futura: now + 2 días, 10:00.
    const future = new Date(Date.now() + 2 * 86400000)
    const created = await cal.createWindows([
      { specialistId: spec.specialistId, applicationId: application.id, scheduledDate: fmt(future), startTime: '10:00', endTime: '11:00' },
    ])
    const id = created[0].id
    const W = () => cal.windows.find(w => w.id === id)
    const exists = () => !!W()
    const startOf = () => W()?.startTime

    // 1) Intento mover al PASADO real: now - 2h.
    const past = new Date(Date.now() - 2 * 3600000)
    const pastEnd = new Date(Date.now() - 1 * 3600000)
    const origStart = startOf(), origDate = W()?.scheduledDate
    let pastErr = null
    try {
      await cal.rescheduleWindow({ window: W(), targetDate: fmt(past), startTime: hm(past), endTime: hm(pastEnd) })
    } catch (e) { pastErr = e?.userMessage || String(e) }
    const afterPast = { exists: exists(), start: startOf(), date: W()?.scheduledDate, unchanged: startOf() === origStart && W()?.scheduledDate === origDate }

    // 2) Movimiento futuro VÁLIDO: now + 3 días 14:00.
    const okDate = fmt(new Date(Date.now() + 3 * 86400000))
    let okErr = null
    try {
      await cal.rescheduleWindow({ window: W(), targetDate: okDate, startTime: '14:00', endTime: '15:00' })
    } catch (e) { okErr = e?.userMessage || String(e) }
    const afterOk = { exists: exists(), start: startOf(), date: W()?.scheduledDate }

    return { id, pastErr, afterPast, okErr, afterOk, origStart, origDate }
  })
  log('rechazo al pasado →', JSON.stringify(res.pastErr))
  log('estado tras intento pasado →', JSON.stringify(res.afterPast))
  log('movimiento futuro válido err →', JSON.stringify(res.okErr))
  log('estado tras futuro →', JSON.stringify(res.afterOk))

  const pass = res.pastErr && res.afterPast.exists && res.afterPast.unchanged
    && !res.okErr && res.afterOk.start === '14:00'
  log(pass ? 'PASS ✓ pasado rechazado (sin mover ni desaparecer); futuro OK' : 'FAIL ✗')

  await page.evaluate(async (id) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    try { await cal.deleteWindow(id) } catch {}
  }, res.id)
  log('limpieza hecha')
}
