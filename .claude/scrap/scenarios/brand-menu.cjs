// Escenario: menú contextual del brand (estilo Notion).
// 1) Captura base (sin hover: caret y « ocultos). 2) Hover sobre la sidebar
// (aparece «). 3) Hover sobre el brand (aparece caret). 4) Click → menú
// contextual abierto. 5) Navega con el menú a Usuarios y verifica.
module.exports = async ({ page, sleep, shot }) => {
  await page.waitForSelector('.sidebar__brand', { timeout: 15000 })
  await sleep(1200)

  // mouse fuera de la sidebar
  await page.mouse.move(800, 400)
  await sleep(400)
  await shot('base')

  // hover sobre la sidebar (zona baja, lejos del brand) → aparece «
  const aside = await page.$('.sidebar')
  const box = await aside.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await sleep(400)
  await shot('hover-sidebar')

  // hover sobre el brand → aparece caret
  await page.hover('.sidebar__brand')
  await sleep(400)
  await shot('hover-brand')

  // click → menú abierto
  await page.click('.sidebar__brand')
  await sleep(450)
  await shot('menu-open')

  // navegar a Usuarios desde el menú
  await page.evaluate(() => {
    ;[...document.querySelectorAll('.navmenu__item')].find(i => i.textContent.includes('Usuarios'))?.click()
  })
  await sleep(1500)
  const url = await page.evaluate(() => location.pathname)
  const menuGone = await page.evaluate(() => !document.querySelector('.navmenu'))
  console.log('[nav]', JSON.stringify({ url, menuGone }))
  await shot('after-nav')

  // botón « oculta la sidebar
  await page.hover('.sidebar')
  await sleep(300)
  await page.click('.sidebar__collapse-btn')
  await sleep(600)
  await shot('collapsed')
}
