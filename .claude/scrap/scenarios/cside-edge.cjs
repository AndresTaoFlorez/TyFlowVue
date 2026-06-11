// Escenario: bordes del cside — búsqueda con lupa, rail colapsado, y
// verificación de que otras rutas no muestran el cside.
module.exports = async ({ page, shot, sleep, BASE }) => {
  await page.waitForSelector('.specrow', { timeout: 20000 })
  await sleep(1000)

  // 1) Lupa de especialistas + filtro por texto
  await page.evaluate(() => document.querySelectorAll('.cside__tool')[0].click())
  await sleep(300)
  await page.type('.cside__search input', 'diego')
  await sleep(600)
  await shot('search')

  // 2) Colapsar el rail → cside debe ocultarse
  await page.click('.sidebar__collapse-btn')
  await sleep(800)
  await shot('collapsed')
  await page.click('.sidebar__collapse-btn')
  await sleep(500)

  // 3) Otra ruta → sin cside
  await page.goto(BASE + '/app/users', { waitUntil: 'networkidle2' })
  await sleep(2000)
  const hasCside = await page.evaluate(() => !!document.querySelector('.cside'))
  console.log('[check] cside en /app/users:', hasCside ? 'PRESENTE (MAL)' : 'ausente (OK)')
  await shot('users')
}
