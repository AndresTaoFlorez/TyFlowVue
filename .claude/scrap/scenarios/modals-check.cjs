// Escenario: verifica los 4 modales rediseñados (Fase 7) en dark (DOM-only).
// 1) detalle individual  2) grupo (mmembers)  3) crear individual  4) bulk.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForSelector('.wb, .wgb', { timeout: 20000 })
  await sleep(1500)

  // 1) Detalle individual: click en un bloque individual (.wb)
  const wb = await page.$('.wb')
  if (wb) {
    await wb.click()
    await sleep(900)
    await shot('detail')
    await page.keyboard.press('Escape')
    await sleep(600)
  }

  // 2) Grupo: click en bloque agrupado (.wgb)
  const wgb = await page.$('.wgb')
  if (wgb) {
    await wgb.click()
    await sleep(900)
    await shot('group')
    // lápiz del primer miembro → modal individual con back
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.mmember__btn')]
      const pencil = btns.find(b => b.title.includes('Editar'))
      if (pencil) pencil.click()
    })
    await sleep(900)
    await shot('group-member-detail')
    await page.keyboard.press('Escape')
    await sleep(600)
    await page.keyboard.press('Escape')
    await sleep(600)
  }

  // 3) Crear individual (vía Crear del sidebar)
  await page.click('.cside__create')
  await sleep(400)
  await page.evaluate(() => document.querySelectorAll('.cside__menu-item')[0].click())
  await sleep(900)
  await shot('create-single')
  await page.keyboard.press('Escape')
  await sleep(600)

  // 4) Asignación masiva: seleccionar 2 specs, 1 app, L-V, cada semana + tras 3
  await page.click('.cside__create')
  await sleep(400)
  await page.evaluate(() => document.querySelectorAll('.cside__menu-item')[1].click())
  await sleep(900)
  await shot('bulk-empty')
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('.pillwrap')]
    const specPills = [...wraps[0].querySelectorAll('.pill')]
    specPills.slice(0, 2).forEach(p => p.click())
    const appPills = [...wraps[1].querySelectorAll('.pill')]
    if (appPills[1]) appPills[1].click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const dayBtns = [...document.querySelectorAll('.daypick__btn')]
    dayBtns.slice(0, 5).forEach(b => b.click())   // L-V
  })
  await sleep(300)
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.chiprow .chip')]
    const weekly = chips.find(c => c.textContent.trim() === 'Cada semana')
    if (weekly) weekly.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip--sm')]
    const after = chips.find(c => c.textContent.trim() === 'Tras N')
    if (after) after.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const inp = document.querySelector('.afterbox input')
    if (inp) {
      inp.value = '3'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await sleep(500)
  await shot('bulk-filled')
  const summary = await page.evaluate(() => document.querySelector('.bsummary')?.textContent?.trim())
  console.log('[bulk summary]', summary)
  await page.keyboard.press('Escape')
  await sleep(400)
}
