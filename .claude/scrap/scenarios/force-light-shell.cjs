// Escenario: fuerza tema CLARO solo en el DOM (NO vía store: el store hace
// PATCH del theme al backend y cambia la cuenta del usuario). Captura la
// vista actual (shell: sidebar + topbar + main) en light.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light')
  })
  await sleep(2000)
  await shot('light-forzado')
}
