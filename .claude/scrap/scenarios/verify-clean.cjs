// Escenario: recarga forzada desde backend y reporta/limpia ventanas 21:00
// (datos de prueba). Dice si el undo realmente borró en el backend.
module.exports = async ({ page, sleep }) => {
  await page.waitForSelector('.cal-area, .wb, .wgb', { timeout: 20000 })
  await sleep(2000)
  const result = await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    await cal.forceReload()
    const test = cal.windows.filter(w => w.startTime === '21:00')
    const found = test.map(w => ({ id: w.id, date: w.scheduledDate }))
    if (test.length) await cal.batchDelete(test.map(w => w.id))
    await cal.forceReload()
    const remaining = cal.windows.filter(w => w.startTime === '21:00').length
    return { found, remaining }
  })
  console.log('[backend-check]', JSON.stringify(result))
}
