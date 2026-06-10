/**
 * Escenario: verifica que NO se agrupan ventanas y que los solapes quedan en
 * columnas lado a lado (estilo Google Calendar), con aire a la derecha.
 *
 *   node .claude/scrap/ui-shot.cjs --themes light --views Semana \
 *     --tag overlap --script .claude/scrap/scenarios/overlap-layout.cjs
 *
 * Crea 3 ventanas SOLAPADAS el mismo día/hora (antes se habrían fusionado en un
 * grupo) + 1 separada. Captura. Limpia al final.
 */
module.exports = async ({ page, sleep, shot }) => {
  const log = (...a) => console.log('[overlap]', ...a)

  const ids = await page.evaluate(async () => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const users = pinia._s.get('users')
    await users.loadUsers?.()
    await users.loadSelects?.()
    const specs = users.users.filter(u => u.specialistId)
    const apps = users.applications
    // El backend prohíbe solapar ventanas del mismo especialista+aplicación, así
    // que los solapes reales son entre combos distintos. Construyo combos únicos.
    const combos = []
    for (const sp of specs) for (const ap of apps) combos.push({ specialistId: sp.specialistId, applicationId: ap.id })
    if (combos.length < 3) throw new Error('no hay suficientes combos especialista×app para solapar')
    // 3 solapadas misma franja (10–11) en jue 11, combos distintos + 1 separada.
    const created = await cal.createWindows([
      { ...combos[0], scheduledDate: '2026-06-11', startTime: '10:00', endTime: '11:00' },
      { ...combos[1], scheduledDate: '2026-06-11', startTime: '10:00', endTime: '11:00' },
      { ...combos[2], scheduledDate: '2026-06-11', startTime: '10:00', endTime: '11:00' },
      { ...combos[0], scheduledDate: '2026-06-11', startTime: '14:00', endTime: '15:00' },
    ])
    return created.map(w => w.id)
  })
  log('creadas', ids)
  await sleep(1800)
  await shot('solapadas')

  // Limpieza
  await page.evaluate(async (all) => {
    const app = document.querySelector('#app').__vue_app__
    const pinia = app.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    for (const id of all) { try { await cal.deleteWindow(id) } catch {} }
  }, ids)
  log('limpieza hecha')
}
