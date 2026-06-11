// Escenario temporal: fuerza tema oscuro vía Pinia (initFromPreferences del backend
// pisa el localStorage sembrado) y captura la vista Semana del calendario.
module.exports = async ({ page, shot, sleep, clickByText }) => {
  await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const prefs = pinia._s.get('preferences')
    prefs.theme = 'dark'
  })
  await sleep(2500)
  await shot('semana')
}
