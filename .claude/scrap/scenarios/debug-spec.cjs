// Debug: dashboard de Especialistas con espera por condición (API lenta)
module.exports = async ({ page, sleep, shot, BASE }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 500)))
  page.on('response', (r) => {
    const u = r.url()
    if (u.includes(':8181')) console.log('[api]', r.status(), u.slice(21, 130))
  })

  await page.goto(BASE + '/app/cases/specialists', { waitUntil: 'networkidle2' })

  // Poll: hasta 90s esperando las cards
  let cards = 0
  for (let i = 0; i < 45; i++) {
    cards = await page.evaluate(() => document.querySelectorAll('.sdc').length)
    if (cards > 0) break
    await sleep(2000)
  }
  console.log('[cards]', cards)
  await shot('a-dashboard')

  const d = await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim().includes('Detalle de cargas')) { b.click(); return 'clicked' }
    }
    return 'no-btn'
  })
  console.log('[detalle]', d)

  // Poll: panel con ventanas
  let wins = 0
  for (let i = 0; i < 30; i++) {
    wins = await page.evaluate(() => document.querySelectorAll('.sdp__win').length)
    if (wins > 0) break
    await sleep(2000)
  }
  console.log('[panel-wins]', wins, await page.evaluate(() => location.href))
  await shot('b-panel')

  // Expandir primera ventana
  await page.evaluate(() => document.querySelector('.sdp__win-row')?.click())
  await sleep(1500)
  await shot('c-ventana')

  // Abrir caso desde la ventana si hay
  const opened = await page.evaluate(() => {
    const c = document.querySelector('.sdp__case')
    if (c) { c.click(); return true }
    return false
  })
  if (opened) {
    for (let i = 0; i < 15; i++) {
      const ok = await page.evaluate(() => !!document.querySelector('.cdh--float .cdp__title, .cdh .cdp__title'))
      if (ok) break
      await sleep(2000)
    }
    await shot('d-caso-flotante')
  }
  console.log('[done-scenario]')
}
