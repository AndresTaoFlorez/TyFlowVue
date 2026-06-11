// Escenario: fuerza tema oscuro SOLO en el DOM (data-theme), sin tocar el
// store de preferencias — el store hace PATCH al backend al cambiar `theme`
// y mutar ahí CAMBIA LA CUENTA del usuario (pasó: le reseteamos su tema).
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  await sleep(2500)
  await shot('semana')
}
