// Escenario E2E: 1) lápiz del grupo abre el modal individual DIRECTO en
// edición; 2) asignación masiva crea una serie real vía POST /recurring
// (1 combo × 2 días, sin repetición) y luego se deshace con Ctrl+Z.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await page.waitForSelector('.wb, .wgb', { timeout: 20000 })
  await sleep(1500)

  // ---- 1) Grupo → lápiz → edición directa ----
  const wgb = await page.$('.wgb')
  if (wgb) {
    await wgb.click()
    await sleep(900)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.mmember__btn')]
      const pencil = btns.find(b => b.title.includes('Editar'))
      if (pencil) pencil.click()
    })
    await sleep(900)
    await shot('pencil-edit')
    const inEdit = await page.evaluate(() => !!document.querySelector('.wm .mgrid2 input[type=date]'))
    console.log('[edit-direct]', inEdit ? 'modal abrió EN EDICIÓN (OK)' : 'modal en vista (ventana sellada o FALLO)')
    await page.keyboard.press('Escape')
    await sleep(500)
    await page.keyboard.press('Escape')
    await sleep(500)
  }

  // ---- 2) Bulk → serie real → undo ----
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('.specrow')].some(r => r.textContent.includes('Justicia XXI Web'))
  }, { timeout: 20000 })
  await page.click('.cside__create')
  await sleep(400)
  await page.evaluate(() => document.querySelectorAll('.cside__menu-item')[1].click())
  await sleep(900)

  // 1 especialista (Andres Tao, tiene Justicia asignada), 1 app, 2 días
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('.pillwrap')]
    const spec = [...wraps[0].querySelectorAll('.pill')].find(p => p.textContent.includes('Andres Tao'))
    if (spec) spec.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('.pillwrap')]
    const app = [...wraps[1].querySelectorAll('.pill')].find(p => p.textContent.includes('Justicia XXI Web'))
    if (app) app.click()
  })
  await sleep(300)
  // Horario nocturno para no solapar con ventanas existentes
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.timebox input')]
    inputs[0].value = '21:00'; inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[1].value = '23:00'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(300)
  await page.evaluate(() => {
    const dayBtns = [...document.querySelectorAll('.daypick__btn')]
    dayBtns[5].click()  // Sábado
    dayBtns[6].click()  // Domingo
  })
  await sleep(500)
  await shot('bulk-ready')
  const summary = await page.evaluate(() => document.querySelector('.bsummary')?.textContent?.trim())
  console.log('[summary]', summary)

  // Crear
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mbtn--primary')].find(b => b.textContent.includes('Crear'))
    if (btn) btn.click()
  })
  await sleep(2500)
  await shot('created')
  const toast = await page.evaluate(() => document.querySelector('.toast, [class*=toast]')?.textContent?.trim())
  console.log('[toast]', toast || '(sin toast visible)')

  // Verificar herencia encadenada en el store (2ª ocurrencia hereda de la 1ª)
  const chain = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const recent = cal.windows.filter(w => w.startTime === '21:00').map(w => ({
      id: w.id, date: w.scheduledDate, inherits: w.inheritsOnReopen, parent: w.inheritedFromWindowId,
    }))
    return recent
  })
  console.log('[serie]', JSON.stringify(chain))

  // Undo para no dejar datos de prueba
  await page.keyboard.down('Control')
  await page.keyboard.press('z')
  await page.keyboard.up('Control')
  await sleep(2000)
  await shot('after-undo')
}
