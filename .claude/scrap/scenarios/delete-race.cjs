// Escenario: carrera fetch-stale vs delete de grupo (tombstones CRDT).
// 1) Crea 3 ventanas 21:00. 2) Dispara forceReload() SIN esperar (fetch en
// vuelo con datos que aún contienen las 3) e inmediatamente las borra con
// batchDelete. 3) Espera a que el fetch stale y los ecos RT asienten y
// verifica que NINGUNA reapareció.
module.exports = async ({ page, sleep, shot }) => {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia
    const cal = pinia?._s?.get('calendar')
    const users = pinia?._s?.get('users')
    return !!cal && !cal.loading && (users?.applications?.length > 0 || cal.windows.length > 0)
  }, { timeout: 20000 })
  await sleep(1500)

  const res = await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const userStore = pinia._s.get('users')

    // limpieza previa
    const leftovers = cal.windows.filter(w => w.startTime === '21:00').map(w => w.id)
    if (leftovers.length) await cal.batchDelete(leftovers)
    await new Promise(r => setTimeout(r, 800))

    const spec = cal.specialistsConVentana.find(u => u.fullName?.includes('Andres Tao')) || cal.specialistsConVentana[0]
    const appId = cal.windows[0]?.applicationId || userStore.applications[0]?.id
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dates = [0, 1, 2].map(n => { const d = new Date(); d.setDate(d.getDate() + n + 1); return fmt(d) })

    const created = await cal.createWindows(dates.map(date => ({
      specialistId: spec.specialistId, applicationId: appId,
      scheduledDate: date, startTime: '21:00', endTime: '22:00',
    })))
    const ids = created.map(w => w.id)
    await new Promise(r => setTimeout(r, 1500))   // dejar asentar creación + ecos

    // LA CARRERA: fetch en vuelo (aún "ve" las 3 ventanas) + delete inmediato
    cal.forceReload()                              // sin await — queda en vuelo
    await cal.batchDelete(ids)

    // muestrear reapariciones durante 5s (fetch stale resuelve + ecos RT)
    let maxAlive = 0
    const t0 = Date.now()
    while (Date.now() - t0 < 5000) {
      const alive = cal.windows.filter(w => ids.includes(w.id)).length
      if (alive > maxAlive) maxAlive = alive
      await new Promise(r => setTimeout(r, 50))
    }
    const finalAlive = cal.windows.filter(w => ids.includes(w.id)).length
    const final21 = cal.windows.filter(w => w.startTime === '21:00').length
    return { created: ids.length, maxAliveAfterDelete: maxAlive, finalAlive, final21 }
  })
  console.log('[delete-race]', JSON.stringify(res))
  await shot('after-delete-race')
}
