// Escenario: interacciones del cside — toggle app, Todos/Ninguno de
// especialistas, pick en mini-cal, dropdown Crear → modal.
module.exports = async ({ page, shot, sleep }) => {
  await page.waitForSelector('.specrow', { timeout: 15000 })
  await sleep(1500)

  // 1) Apagar la app "Justicia XXI Web" → su bloque azul debe desaparecer
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.specrow')]
    const row = rows.find(r => r.textContent.includes('Justicia XXI Web'))
    if (row) row.click()
  })
  await sleep(1200)
  await shot('app-off')

  // 2) Ninguno (especialistas) → el grid debe quedar vacío
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('.cside__alllink')]
    const l = links.find(b => b.textContent.trim() === 'Ninguno')
    if (l) l.click()
  })
  await sleep(1200)
  await shot('specs-none')

  // 3) Restaurar: Todos + re-encender la app
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('.cside__alllink')]
    const l = links.find(b => b.textContent.trim() === 'Todos')
    if (l) l.click()
  })
  await sleep(400)
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.specrow')]
    const row = rows.find(r => r.textContent.includes('Justicia XXI Web'))
    if (row && !row.classList.contains('specrow--on')) row.click()
  })
  await sleep(800)

  // 4) Mini-cal: pick del 22 → la semana visible debe cambiar a 22-28
  await page.evaluate(() => {
    const days = [...document.querySelectorAll('.mini__day')]
    const d = days.find(b => b.textContent.trim() === '22' && !b.classList.contains('mini__day--out'))
    if (d) d.click()
  })
  await sleep(1500)
  await shot('mini-pick-22')

  // 5) Crear → dropdown abierto
  await page.click('.cside__create')
  await sleep(500)
  await shot('crear-menu')

  // 6) Ventana individual → modal de creación
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.cside__menu-item')]
    if (items[0]) items[0].click()
  })
  await sleep(1000)
  await shot('crear-modal')
}
