// Debug: clic en fila de la lista → ¿navega y abre el panel?
module.exports = async ({ page, sleep, shot }) => {
  page.on('console', (msg) => {
    const t = msg.type()
    if (t === 'error' || t === 'warning') console.log('[console]', t, msg.text().slice(0, 300))
  })
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 400)))

  await sleep(2000)
  // limpiar filtros persistidos (status=open por defecto puede estar vacío)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim().includes('Limpiar filtros')) { b.click(); return }
    }
  })
  await sleep(7000)
  console.log('[dom]', await page.evaluate(() => ({
    empty: document.querySelector('.ct__empty')?.textContent.trim().slice(0, 60) ?? null,
    skel: document.querySelectorAll('.ct__row--skel').length,
    count: document.querySelector('.cv__count')?.textContent.trim() ?? null,
  })).then(JSON.stringify))
  console.log('[url before]', await page.evaluate(() => location.href))
  const rows = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
  console.log('[rows]', rows)
  await page.click('.ct__row:not(.ct__row--skel)')
  await sleep(2500)
  console.log('[url after]', await page.evaluate(() => location.href))
  const state = await page.evaluate(() => ({
    cdp: !!document.querySelector('.cdp'),
    cdh: !!document.querySelector('.cdh'),
  }))
  console.log('[panel]', JSON.stringify(state))
  await shot('debug')
}
