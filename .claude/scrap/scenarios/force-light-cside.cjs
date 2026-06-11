// Escenario: fuerza tema CLARO solo en el DOM (NO vía store: el store hace
// PATCH del theme al backend y cambia la cuenta del usuario). Captura el
// calendario con el cside cargado; luego baja el scroll del cside.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await page.waitForSelector('.specrow', { timeout: 15000 })
  await sleep(2000)
  await shot('semana')
  await page.evaluate(() => {
    const el = document.querySelector('.cside')
    if (el) el.scrollTop = el.scrollHeight
  })
  await sleep(600)
  await shot('cside-bottom')
}
