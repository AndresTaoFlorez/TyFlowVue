// Escenario: estrés del CRDT/optimista.
// 1) Limpia residuos 21:00. 2) Crea una ventana. 3) La mueve 3 veces SEGUIDAS
// sin esperar (PATCHs en vuelo solapados). 4) Espera a que todo asiente y
// verifica que la posición final es la del ÚLTIMO movimiento (sin brincos),
// que no hay ids duplicados, y que el eco RT no duplicó la creación.
module.exports = async ({ page, sleep, shot }) => {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia
    const cal = pinia?._s?.get('calendar')
    const users = pinia?._s?.get('users')
    return !!cal && !cal.loading && (users?.applications?.length > 0 || cal.windows.length > 0)
  }, { timeout: 20000 })
  await sleep(1500)

  const store = (fn) => page.evaluate(fn)

  // 0) Limpieza de residuos (21:00 de corridas anteriores)
  const cleaned = await store(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const ids = cal.windows.filter(w => w.startTime === '21:00').map(w => w.id)
    if (ids.length) { try { await cal.batchDelete(ids) } catch (e) { return 'ERR ' + (e.userMessage || e.message) } }
    return ids.length
  })
  console.log('[cleanup]', cleaned)
  await sleep(800)

  // 1) Crear una ventana hoy 21:00–22:00 (futuro) vía store y medir duplicados
  //    mientras llega el eco RT.
  const createRes = await store(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const users = cal.specialistsConVentana
    const spec = users.find(u => u.fullName?.includes('Andres Tao')) || users[0]
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    // app: de una ventana existente, o del catálogo del userStore
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const userStore = pinia._s.get('users') || pinia._s.get('user')
    const anyW = cal.windows.find(w => w.specialistId === spec.specialistId) || cal.windows[0]
    const appId = anyW?.applicationId || userStore?.applications?.[0]?.id
    if (!appId) return { error: 'no application id disponible (stores: ' + [...pinia._s.keys()].join(',') + ')' }

    // muestrear duplicados durante 3s tras crear
    const sampler = { maxDup: 0 }
    const int = setInterval(() => {
      const ids = cal.windows.map(w => w.id)
      const dup = ids.length - new Set(ids).size
      if (dup > sampler.maxDup) sampler.maxDup = dup
    }, 50)

    let created
    try {
      created = await cal.createWindows([{
        specialistId: spec.specialistId, applicationId: appId,
        scheduledDate: date, startTime: '21:00', endTime: '22:00',
      }])
    } catch (e) {
      clearInterval(int)
      return { error: e.userMessage || e.message }
    }
    await new Promise(r => setTimeout(r, 3000))
    clearInterval(int)
    return { id: created[0].id, maxDupDuringCreate: sampler.maxDup }
  })
  console.log('[create]', JSON.stringify(createRes))
  if (createRes.error) { console.log('ABORT'); return }

  // 2) Tres resize SEGUIDOS sin await intermedio (carrera de PATCHs + ecos RT)
  const moveRes = await store(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const id = cal.windows.find(w => w.startTime === '21:00')?.id
    if (!id) return { error: 'ventana no encontrada' }
    const w = () => cal.windows.find(x => x.id === id)

    // tres cambios de fin encadenados sin esperar: 22:30 → 23:00 → 23:30
    const p1 = cal.resizeWindow({ window: w(), endTime: '22:30' }).catch(e => 'e1:' + (e.userMessage || e.message))
    const p2 = cal.resizeWindow({ window: w(), endTime: '23:00' }).catch(e => 'e2:' + (e.userMessage || e.message))
    const p3 = cal.resizeWindow({ window: w(), endTime: '23:30' }).catch(e => 'e3:' + (e.userMessage || e.message))

    // muestrear la posición visible cada 50ms para detectar "brincos hacia atrás"
    const seen = []
    const int = setInterval(() => { const x = w(); if (x) seen.push(x.endTime) }, 50)
    const errs = (await Promise.all([p1, p2, p3])).filter(x => typeof x === 'string')
    await new Promise(r => setTimeout(r, 4000))   // dejar llegar ecos RT + merges
    clearInterval(int)

    // brinco = el endTime visible retrocede en la serie muestreada
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    let jumps = 0
    for (let i = 1; i < seen.length; i++) {
      if (toMin(seen[i]) < toMin(seen[i - 1])) jumps++
    }
    const ids = cal.windows.map(x => x.id)
    return {
      finalEnd: w()?.endTime,
      jumps,
      samples: seen.length,
      dupes: ids.length - new Set(ids).size,
      errs,
    }
  })
  console.log('[rapid-resize]', JSON.stringify(moveRes))
  await shot('after-rapid')

  // 3) Limpieza final
  const fin = await store(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const ids = cal.windows.filter(w => w.startTime === '21:00').map(w => w.id)
    if (ids.length) { try { await cal.batchDelete(ids) } catch (e) { return 'ERR ' + (e.userMessage || e.message) } }
    return 'deleted ' + ids.length
  })
  console.log('[final-cleanup]', fin)
}
