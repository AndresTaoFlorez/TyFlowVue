// Verifica el sellado en DOS NIVELES end-to-end (frontend + DB en vivo):
//  1. Ventana en turno: ajustar el FIN → debe FUNCIONAR (antes el backend lo rechazaba)
//  2. Ventana en turno: cambiar el INICIO → bloqueado
//  3. Ventana en turno: fin a antes de la Timeline → bloqueado
//  4. El fin se restaura al valor original al terminar.
module.exports = async ({ page, sleep, shot }) => {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading && s.windows.length > 0
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }

  const r = await page.evaluate(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const w = cal.windows.find(x => x.isInShift)
    if (!w) return { skip: 'no hay ventana en turno' }
    const out = { id: w.id, origEnd: w.endTime }

    // 1 — extender el fin 30 min → debe pasar
    const [eh, em] = w.endTime.split(':').map(Number)
    const newEndMins = Math.min(eh * 60 + em + 30, 23 * 60 + 59)
    const newEnd = `${String(Math.floor(newEndMins / 60)).padStart(2, '0')}:${String(newEndMins % 60).padStart(2, '0')}`
    try {
      await cal.resizeWindow({ window: w, endTime: newEnd })
      out.extendEnd = 'OK — fin ajustado a ' + newEnd
    } catch (e) { out.extendEnd = 'FALLO: ' + (e?.userMessage || e?.message) }

    // 2 — cambiar inicio → debe bloquearse
    try {
      await cal.resizeWindow({ window: cal.windows.find(x => x.id === w.id), startTime: '01:00' })
      out.changeStart = 'NO-BLOQUEÓ (mal)'
    } catch (e) { out.changeStart = 'bloqueado: ' + (e?.userMessage || e?.message).slice(0, 90) }

    // 3 — fin a antes de la timeline → debe bloquearse
    try {
      await cal.resizeWindow({ window: cal.windows.find(x => x.id === w.id), endTime: '00:30' })
      out.endPast = 'NO-BLOQUEÓ (mal)'
    } catch (e) { out.endPast = 'bloqueado: ' + (e?.userMessage || e?.message).slice(0, 90) }

    // 4 — restaurar el fin original
    try {
      await cal.resizeWindow({ window: cal.windows.find(x => x.id === w.id), endTime: out.origEnd })
      out.restore = 'restaurado a ' + out.origEnd
    } catch (e) { out.restore = 'FALLO restaurando: ' + (e?.userMessage || e?.message) }

    return out
  })
  console.log('[two-tier]', JSON.stringify(r, null, 1))

  // 5 — handles visibles: en turno debe haber bottom pero no top
  const handles = await page.evaluate(() => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const out = []
    for (const el of document.querySelectorAll('.wb')) {
      const w = cal.windows.find(x => x.id === el.dataset.windowId)
      if (!w || !w.isInShift) continue
      out.push({ id: w.id, top: !!el.querySelector('.wb__handle--top'), bottom: !!el.querySelector('.wb__handle--bottom') })
    }
    return out
  })
  console.log('[handles-inshift]', JSON.stringify(handles))
  await shot('seal')
}
