// Escenario: toggle de la app "Justicia XXI Web" en el cside, esperando a que
// la lista de aplicaciones esté cargada y haya bloques en el grid.
module.exports = async ({ page, shot, sleep }) => {
  await page.waitForSelector('.wb, .wgb', { timeout: 20000 })
  // Esperar a que la fila de la app exista (loadSelects es async)
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('.specrow')].some(r => r.textContent.includes('Justicia XXI Web'))
  }, { timeout: 20000 })
  await sleep(800)
  await shot('before')
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.specrow')].find(r => r.textContent.includes('Justicia XXI Web'))
    row.click()
  })
  await sleep(1200)
  await shot('app-off')
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.specrow')].find(r => r.textContent.includes('Justicia XXI Web'))
    row.click()
  })
  await sleep(800)
}
