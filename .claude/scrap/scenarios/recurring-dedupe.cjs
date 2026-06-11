// Escenario: 1) limpia residuos de pruebas (ventanas 21:00 del finde),
// 2) crea la serie esperando a que el backend responda, 3) verifica que NO
// haya ids duplicados en el store, 4) deshace y confirma limpieza.
module.exports = async ({ page, sleep, shot }) => {
  await page.waitForFunction(() => {
    return [...document.querySelectorAll('.specrow')].some(r => r.textContent.includes('Justicia XXI Web'))
  }, { timeout: 20000 })
  await sleep(1500)

  // 0) Limpieza de residuos de la corrida anterior
  const leftovers = await page.evaluate(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const ids = cal.windows.filter(w => w.startTime === '21:00').map(w => w.id)
    if (ids.length) await cal.batchDelete(ids)
    return ids.length
  })
  console.log('[cleanup] residuos eliminados:', leftovers)
  await sleep(800)

  // 1) Crear serie
  await page.click('.cside__create')
  await sleep(400)
  await page.evaluate(() => document.querySelectorAll('.cside__menu-item')[1].click())
  await sleep(900)
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('.pillwrap')]
    ;[...wraps[0].querySelectorAll('.pill')].find(p => p.textContent.includes('Andres Tao'))?.click()
  })
  await sleep(200)
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll('.pillwrap')]
    ;[...wraps[1].querySelectorAll('.pill')].find(p => p.textContent.includes('Justicia XXI Web'))?.click()
  })
  await sleep(200)
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('.timebox input')]
    inputs[0].value = '21:00'; inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    inputs[1].value = '23:00'; inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(200)
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.daypick__btn')]
    d[5].click(); d[6].click()
  })
  await sleep(400)
  await page.evaluate(() => {
    ;[...document.querySelectorAll('.mbtn--primary')].find(b => b.textContent.includes('Crear'))?.click()
  })

  // Esperar a que la serie aparezca en el store (o error visible)
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    return cal.windows.filter(w => w.startTime === '21:00').length >= 2 ||
      !!document.querySelector('.merror')
  }, { timeout: 20000 })
  await sleep(800)

  const check = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const cal = pinia._s.get('calendar')
    const ids = cal.windows.map(w => w.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    const serie = cal.windows.filter(w => w.startTime === '21:00').map(w => ({ id: w.id, date: w.scheduledDate, inherits: w.inheritsOnReopen, parent: w.inheritedFromWindowId }))
    const error = document.querySelector('.merror')?.textContent?.trim() || null
    return { total: ids.length, dupes, serie, error }
  })
  console.log('[dedupe-check]', JSON.stringify(check))
  await shot('created')

  // 2) Undo y confirmar limpieza
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control')
  await sleep(2500)
  const after = await page.evaluate(() => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    return pinia._s.get('calendar').windows.filter(w => w.startTime === '21:00').length
  })
  console.log('[after-undo] ventanas 21:00 restantes:', after)
}
