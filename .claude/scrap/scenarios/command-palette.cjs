// Escenario: command palette (Ctrl+K) — abre el modal, escribe una búsqueda
// y navega a Configuración › Roles con Enter.
module.exports = async ({ page, sleep, shot }) => {
  await sleep(1500)

  // Abrir con Ctrl+K
  await page.keyboard.down('Control')
  await page.keyboard.press('k')
  await page.keyboard.up('Control')
  await sleep(400)
  await shot('palette-open')

  // Buscar (insensible a acentos: "jerarquia" debe encontrar "Jerarquía")
  await page.type('.cp__input', 'jerarquia', { delay: 30 })
  await sleep(400)
  await shot('palette-search')

  // Enter → navega a Configuración con la sección activa
  await page.keyboard.press('Enter')
  await sleep(1200)
  await shot('palette-navigated')

  // Reabrir y cerrar con ESC
  await page.keyboard.down('Control')
  await page.keyboard.press('k')
  await page.keyboard.up('Control')
  await sleep(400)
  await page.keyboard.press('Escape')
  await sleep(300)
  await shot('palette-closed')
}
