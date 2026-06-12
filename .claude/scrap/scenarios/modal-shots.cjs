// Capturas: modal de creación (Google-style) y panel de grupo (filas tab-eables)
module.exports = async ({ page, sleep, shot }) => {
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__?.config.globalProperties.$pinia._s.get('calendar')
      return s && !s.loading && s.windows.length > 0
    }).catch(() => false)
    if (ok) break
    await sleep(2000)
  }
  await sleep(800)

  // 1 — abrir modal de crear (botón Crear del sidebar)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim().startsWith('Crear')) { b.click(); return }
    }
  })
  await sleep(900)
  // si el botón Crear es dropdown, clicar la opción "Ventana"
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('button, [role=menuitem], .cside__menu-item')) {
      const t = el.textContent.trim().toLowerCase()
      if (t.includes('ventana') && !t.includes('asign')) { el.click(); return }
    }
  })
  await sleep(900)
  console.log('[modal]', await page.evaluate(() => !!document.querySelector('.modal__title')))
  await shot('1-create-modal')
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    document.querySelector('.modal__x')?.click()
  })
  await sleep(600)

  // 2 — abrir un grupo (bloque .wgb) → panel de grupo
  const hasGroup = await page.evaluate(() => {
    const g = document.querySelector('.wgb')
    if (!g) return false
    g.click()
    return true
  })
  await sleep(1200)
  console.log('[group-panel]', hasGroup, await page.evaluate(() => document.querySelectorAll('.mmember').length))
  if (hasGroup) await shot('2-group-panel')
}
