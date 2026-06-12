// Captura del modal de Asignación masiva rediseñado (Periodo Desde–Hasta)
module.exports = async ({ page, sleep, shot }) => {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }
  await sleep(800)

  // abrir el dropdown del botón Crear y elegir la opción masiva
  await page.evaluate(() => {
    const chev = document.querySelector('.cside__create-arrow, .cside__create-chevron, [class*=create] [class*=chev]')
    if (chev) { chev.click(); return }
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === 'Crear' || b.textContent.trim().startsWith('Crear')) { b.click(); return }
    }
  })
  await sleep(700)
  const opened = await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, [role=menuitem], li, .cside__menu-item, [class*=menu] *')) {
      const t = (el.textContent || '').trim().toLowerCase()
      if (t.includes('masiva') && t.length < 40) { el.click(); return t }
    }
    return null
  })
  console.log('[open-bulk]', opened)
  await sleep(900)

  // seleccionar 1 especialista + 1 app + L-V para ver el conteo
  await page.evaluate(() => {
    const pills = document.querySelectorAll('.bam .pillwrap')
    pills[0]?.querySelector('.pill')?.click()
    pills[1]?.querySelector('.pill')?.click()
  })
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.bam .daypick__btn')
    for (let i = 0; i < 5; i++) btns[i]?.click()
  })
  await sleep(600)
  console.log('[summary]', await page.evaluate(() => document.querySelector('.bsummary')?.textContent.trim().slice(0, 120)))
  await shot('bulk-rediseno')
}
