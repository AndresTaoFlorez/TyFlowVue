// Escenario: menú contextual del brand en DARK (forzado solo en DOM) sobre el
// calendario — verifica que el dropdown se vea bien sobre el cside.
module.exports = async ({ page, sleep, shot }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForSelector('.sidebar__brand', { timeout: 15000 })
  await sleep(2000)
  await page.click('.sidebar__brand')
  await sleep(450)
  await shot('menu-open-cal')
}
