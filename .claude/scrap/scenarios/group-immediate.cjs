// Verifica: (1) dos ventanas creadas con el MISMO rango se agrupan
// inmediatamente (sin recargar); (2) ventanas selladas no muestran el handle
// de resize superior. Crea datos reales y los borra al final.
module.exports = async ({ page, sleep, shot }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 300)))

  // esperar a que el calendario cargue ventanas
  for (let i = 0; i < 45; i++) {
    const ok = await page.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__
      const s = app?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading && (s.windows?.length ?? 0) >= 0 && !!document.querySelector('.cal-page, .cp, [class*=cal]')
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }
  await sleep(1500)

  // 2 especialistas distintos con app (desde users store)
  const ctx = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const users = pinia._s.get('users')
    const specs = users.users.filter(u => u.specialistId)
    const apps = users.applications
    return {
      s1: specs[0]?.specialistId, s2: specs[1]?.specialistId,
      a1: apps[0]?.id, a2: apps[1]?.id,
      count: specs.length,
    }
  })
  console.log('[ctx]', JSON.stringify(ctx))
  if (!ctx.s1 || !ctx.s2) { console.log('[abort] no hay 2 especialistas'); return }

  // mañana, 09:00-11:30, mismo rango exacto, especialistas distintos
  const tomorrow = new Date(Date.now() + 86400000)
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  // crear la PRIMERA
  await page.evaluate(async ({ s1, a1, date }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    await cal.createWindows([{ specialistId: s1, applicationId: a1, scheduledDate: date, startTime: '09:00', endTime: '11:30' }])
  }, { s1: ctx.s1, a1: ctx.a1, date })
  await sleep(1200)

  const before = await page.evaluate(() => document.querySelectorAll('.wgb').length)

  // crear la SEGUNDA con el MISMO rango (otro especialista + otra app)
  await page.evaluate(async ({ s2, a2, date }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    await cal.createWindows([{ specialistId: s2, applicationId: a2, scheduledDate: date, startTime: '09:00', endTime: '11:30' }])
  }, { s2: ctx.s2, a2: ctx.a2 ?? ctx.a1, date })
  await sleep(1500)

  const after = await page.evaluate(() => document.querySelectorAll('.wgb').length)
  console.log('[groups]', 'antes:', before, 'después:', after, after > before ? 'PASS agrupa sin recargar' : 'FAIL no agrupó')
  await shot('1-grupo-inmediato')

  // ── Handles en ventanas selladas ──
  const handles = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const now = Date.now()
    const out = { sealedChecked: 0, sealedWithTop: 0, futureChecked: 0, futureWithTop: 0 }
    for (const el of document.querySelectorAll('.wb')) {
      // localizar la ventana por geometría no es fiable; usar data attr si existe
      const id = el.dataset.windowId
      const w = cal.windows.find(x => x.id === id)
      if (!w) continue
      const sealed = now >= new Date(w.startsAt).getTime()
      const hasTop = !!el.querySelector('.wb__handle--top')
      if (sealed) { out.sealedChecked++; if (hasTop) out.sealedWithTop++ }
      else { out.futureChecked++; if (hasTop) out.futureWithTop++ }
    }
    return out
  })
  console.log('[handles]', JSON.stringify(handles),
    handles.sealedChecked > 0 && handles.sealedWithTop === 0 ? 'PASS selladas sin handle top' : '(revisar)')

  // ── limpieza: borrar las 2 ventanas creadas ──
  const cleaned = await page.evaluate(async ({ date }) => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const mine = cal.windows.filter(w => w.scheduledDate === date && w.startTime === '09:00' && w.endTime === '11:30')
    if (mine.length) await cal.batchDelete(mine.map(w => w.id))
    return mine.length
  }, { date })
  console.log('[cleanup]', cleaned, 'ventanas borradas')
  await sleep(1000)
}
