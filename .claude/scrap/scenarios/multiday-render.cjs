// Reproduce la creación de UNA ventana que cruza días (nuevo flujo del modal
// estilo Google Calendar) y captura cómo se representa en la semana.
module.exports = async ({ page, sleep, shot }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 300)))

  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }
  await sleep(1500)
  await shot('0-antes')

  const ctx = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const users = pinia._s.get('users')
    const cal = pinia._s.get('calendar')
    return {
      spec: cal.windows[0]?.specialistId ?? users.users.find(u => u.specialistId)?.specialistId,
      app: cal.windows[0]?.applicationId ?? users.applications[0]?.id,
      windows: cal.windows.length,
    }
  })
  console.log('[ctx]', JSON.stringify(ctx))

  const d1 = new Date(Date.now() + 86400000)
  const d2 = new Date(Date.now() + 2 * 86400000)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const err = await page.evaluate(async ({ spec, app, date, endDate }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    try {
      await cal.createWindows([{ specialistId: spec, applicationId: app, scheduledDate: date, endDate, startTime: '22:00', endTime: '06:00' }])
      return null
    } catch (e) { return e?.userMessage || String(e) }
  }, { spec: ctx.spec, app: ctx.app, date: iso(d1), endDate: iso(d2) })
  console.log('[create]', err ?? 'ok')
  await sleep(2000)
  await shot('1-multidia')

  // inspección: cuántos bloques pinta y con qué clases
  const repr = await page.evaluate(({ date }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const w = cal.windows.find(x => x.scheduledDate === date && x.startTime === '22:00')
    return {
      id: w?.id, startsAt: w?.startsAt, endsAt: w?.endsAt,
      spans: w?.spansMultipleDays,
      blocks: document.querySelectorAll(`[data-window-id="${w?.id}"]`).length,
    }
  }, { date: iso(d1) })
  console.log('[repr]', JSON.stringify(repr))

  // limpieza
  const cleaned = await page.evaluate(async ({ date }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const mine = cal.windows.filter(w => w.scheduledDate === date && w.startTime === '22:00')
    if (mine.length) await cal.batchDelete(mine.map(w => w.id))
    return mine.length
  }, { date: iso(d1) })
  console.log('[cleanup]', cleaned)
}
