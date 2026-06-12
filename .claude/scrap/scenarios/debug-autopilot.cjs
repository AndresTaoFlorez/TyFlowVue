// Debug: estados de UI del autopilot (Detener + banner de resumen)
// Conduce el store Pinia directamente para simular el job sin asignar casos reales.
module.exports = async ({ page, sleep, shot }) => {
  // esperar a que la vista de casos esté montada
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => !!document.querySelector('.cv__topbar'))
    if (ok) break
    await sleep(2000)
  }

  const getStore = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('cases')`

  // 1 — job corriendo → botón Detener + pill de progreso
  await page.evaluate(`(() => {
    const s = ${getStore}
    s.autopilotState = { running: true, stopping: false, jobId: 'abc123', processed: 37, total: 104 }
  })()`)
  await sleep(600)
  await shot('1-running-detener')

  // 2 — deteniendo
  await page.evaluate(`(() => {
    const s = ${getStore}
    s.autopilotState = { running: true, stopping: true, jobId: 'abc123', processed: 41, total: 104 }
  })()`)
  await sleep(600)
  await shot('2-stopping')

  // 3 — completado con skips/fallos → banner warn
  await page.evaluate(`(() => {
    const s = ${getStore}
    s.autopilotState = { running: false, stopping: false, jobId: null, processed: 0, total: null }
    s.autopilotResult = {
      total: 104, assigned: 87, skipped: 14, failed: 3, cancelled: false,
      errors: [{ case_id: 'a0305b11', reason: 'P0001: no eligible specialists for category' }],
    }
  })()`)
  await sleep(600)
  await shot('3-result-warn')

  // 4 — detenido manualmente, todo OK
  await page.evaluate(`(() => {
    const s = ${getStore}
    s.autopilotResult = { total: 40, assigned: 22, skipped: 0, failed: 0, cancelled: true, errors: [] }
  })()`)
  await sleep(600)
  await shot('4-result-cancelled')
  console.log('[done]')
}
