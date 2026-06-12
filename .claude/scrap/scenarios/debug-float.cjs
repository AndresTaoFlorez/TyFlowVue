// Debug: modo flotante del detalle de caso
module.exports = async ({ page, sleep, shot }) => {
  // Esperar filas reales
  let rows = 0
  for (let i = 0; i < 40; i++) {
    rows = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
    if (rows > 0) break
    // si hay empty-state por filtros, limpiarlos
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.trim().includes('Limpiar filtros')) { b.click(); return }
      }
    })
    await sleep(2000)
  }
  console.log('[rows]', rows)
  await page.click('.ct__row:not(.ct__row--skel)')
  for (let i = 0; i < 15; i++) {
    if (await page.evaluate(() => !!document.querySelector('.cdp__title'))) break
    await sleep(1500)
  }
  await shot('a-docked')

  await page.evaluate(() => document.querySelector('[title="Ventana flotante"]')?.click())
  await sleep(1200)
  console.log('[float]', await page.evaluate(() => !!document.querySelector('.cdh--float')))
  await shot('b-float')

  // arrastrar la ventana por la zona de drag
  const zone = await page.evaluate(() => {
    const el = document.querySelector('.cdp__drag-zone')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (zone) {
    await page.mouse.move(zone.x, zone.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(zone.x - 40 * i, zone.y - 8 * i)
      await sleep(20)
    }
    await page.mouse.up()
    await sleep(600)
    await shot('c-float-moved')
  }
  console.log('[done]')
}
