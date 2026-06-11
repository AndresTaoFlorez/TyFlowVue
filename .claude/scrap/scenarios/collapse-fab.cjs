// Escenario: fuerza dark vía DOM, captura el calendario (bg uniforme),
// colapsa el rail (debe desaparecer del todo) y verifica el .nav-fab,
// luego reabre con el fab.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForSelector('.specrow', { timeout: 20000 })
  await sleep(1500)
  await shot('full')
  await page.click('.sidebar__collapse-btn')
  await sleep(800)
  await shot('collapsed')
  await page.click('.nav-fab')
  await sleep(800)
  await shot('reopened')
}
