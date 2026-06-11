// Escenario: regla "selladas no se eliminan".
// 1) Busca una ventana sellada (ya inició) y verifica que deleteWindow,
//    batchDelete y deleteGroup la rechazan en el front.
// 2) Abre su modal y verifica que el botón Eliminar está deshabilitado.
module.exports = async ({ page, sleep, shot }) => {
  await page.waitForFunction(() => {
    const pinia = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia
    const cal = pinia?._s?.get('calendar')
    return !!cal && !cal.loading && cal.windows.length > 0
  }, { timeout: 20000 })
  await sleep(1500)

  const res = await page.evaluate(async () => {
    const cal = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('calendar')
    const sealed = cal.windows.find(w => w.isSealed)
    if (!sealed) return { skip: 'no hay ventanas selladas en el rango visible' }
    const out = { id: sealed.id, date: sealed.scheduledDate }
    try { await cal.deleteWindow(sealed.id); out.single = 'BORRÓ (MAL)' }
    catch (e) { out.single = e.userMessage }
    try { const n = await cal.batchDelete([sealed.id]); out.batch = 'BORRÓ ' + n + ' (MAL)' }
    catch (e) { out.batch = e.userMessage }
    try { await cal.deleteGroup({ windows: [sealed] }); out.group = 'BORRÓ (MAL)' }
    catch (e) { out.group = e.userMessage }
    out.stillThere = cal.windows.some(w => w.id === sealed.id)
    return out
  })
  console.log('[sealed-guards]', JSON.stringify(res))
  if (res.skip) return

  // abrir el modal de esa ventana vía URL (?window=id) y mirar el botón
  await page.evaluate((id) => {
    const url = new URL(location.href)
    url.searchParams.set('window', id)
    history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, res.id)
  await page.goto(page.url().split('?')[0] + `?window=${res.id}`, { waitUntil: 'networkidle2' })
  await sleep(2500)
  const btn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.mbtn--danger')].find(x => x.textContent.includes('Eliminar'))
    return b ? { disabled: b.disabled, title: b.title } : null
  })
  console.log('[modal-btn]', JSON.stringify(btn))
  await shot('sealed-modal')
}
