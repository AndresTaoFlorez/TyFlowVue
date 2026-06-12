// Escenario: tour completo del módulo Casos rediseñado.
// Lista (filtros de header, modos del panel de detalle) + Especialistas
// (dashboard, panel de cargas, modo columnas).
module.exports = async ({ page, sleep, shot, clickByText, BASE }) => {
  const clickBtnContaining = (text) => page.evaluate((t) => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim().includes(t)) { b.click(); return true }
    }
    return false
  }, text)

  const clickByTitle = (title) => page.evaluate((t) => {
    const el = document.querySelector(`[title="${t}"]`)
    if (el) { el.click(); return true }
    return false
  }, title)

  // 1 — Lista con filtros persistidos (posible vacío)
  await shot('1-lista-inicial')

  // 2 — Limpiar filtros si la lista está vacía
  await clickBtnContaining('Limpiar filtros')
  await sleep(4500)
  await shot('2-lista-todos')

  // 3 — Menú contextual del header Estado
  await clickBtnContaining('Estado')
  await sleep(500)
  await shot('3-filtro-estado-abierto')

  // 4 — Filtrar por Asignado
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.cfm__item')) {
      if (b.textContent.trim() === 'Asignado') { b.click(); return }
    }
  })
  await sleep(4000)
  await shot('4-filtrados-asignados')

  // 5 — Abrir el primer caso (panel derecho por defecto)
  await page.click('.ct__row:not(.ct__row--skel)')
  await sleep(2500)
  await shot('5-detalle-derecha')

  // 6 — Modo flotante
  await clickByTitle('Ventana flotante')
  await sleep(800)
  await shot('6-detalle-flotante')

  // 7 — Página completa
  await clickByTitle('Página completa')
  await sleep(800)
  await shot('7-detalle-full')

  // 8 — Panel a la izquierda
  await clickByTitle('Panel a la izquierda')
  await sleep(800)
  await shot('8-detalle-izquierda')

  // 9 — restaurar derecha y cerrar
  await clickByTitle('Panel a la derecha')
  await sleep(400)
  await page.keyboard.press('Escape')
  await sleep(600)

  // 10 — Especialistas (dashboard)
  await page.goto(BASE + '/app/cases/specialists', { waitUntil: 'networkidle2' })
  await sleep(3000)
  await shot('10-especialistas-dashboard')

  // 11 — Cambiar visualización de una card (actividad)
  await page.evaluate(() => {
    const btn = document.querySelector('.sdc__view-btn[title="Actividad (7 días)"]')
    if (btn) btn.click()
  })
  await sleep(500)
  await shot('11-card-actividad')

  // 12 — Expandir detalle de cargas del primer especialista
  await clickBtnContaining('Detalle de cargas')
  await sleep(2500)
  await shot('12-panel-cargas')

  // 13 — Expandir una ventana (casos recibidos)
  await page.evaluate(() => {
    const row = document.querySelector('.sdp__win-row')
    if (row) row.click()
  })
  await sleep(800)
  await shot('13-ventana-expandida')

  // 14 — Abrir un caso desde la ventana (host flotante)
  const openedCase = await page.evaluate(() => {
    const c = document.querySelector('.sdp__case')
    if (c) { c.click(); return true }
    return false
  })
  if (openedCase) {
    await sleep(2000)
    await shot('14-caso-desde-ventana')
    await page.keyboard.press('Escape')
    await sleep(500)
  }

  // 15 — Modo columnas
  await page.goto(BASE + '/app/cases/loads', { waitUntil: 'networkidle2' })
  await sleep(3000)
  await shot('15-modo-columnas')
}
