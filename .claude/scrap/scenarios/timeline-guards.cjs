// Verifica: (1) reducir el fin de una ventana en turno a antes de NOW se
// bloquea con mensaje; (2) un update rechazado por el backend ya no es
// silencioso (la razón se propaga).
module.exports = async ({ page, sleep, shot }) => {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading && s.windows.length > 0
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }

  // 1 — guard frontend: fin en el pasado sobre ventana en turno
  const r1 = await page.evaluate(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const w = cal.windows.find(x => x.isInShift)
    if (!w) return 'no-inshift'
    try {
      await cal.resizeWindow({ window: w, endTime: '00:30' })
      return 'NO-BLOQUEÓ'
    } catch (e) { return e?.userMessage || String(e) }
  })
  console.log('[guard-fin-pasado]', r1)

  // 2 — update single rechazado por backend (cambiar inicio de sellada,
  //     saltando los pre-checks del store): la razón debe propagarse
  const r2 = await page.evaluate(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const w = cal.windows.find(x => x.isInShift)
    if (!w) return 'no-inshift'
    const { updateWorkWindowUseCase } = await import('/src/application/use-cases/work-windows/UpdateWorkWindowUseCase.js')
    try {
      const res = await updateWorkWindowUseCase(w, { startTime: '01:00', targetDate: w.scheduledDate })
      return res === null ? 'SILENCIO (null) — BUG' : 'inesperado: aplicó'
    } catch (e) { return 'propaga: ' + (e?.userMessage || e?.message || String(e)).slice(0, 120) }
  })
  console.log('[update-rechazado]', r2)
}
