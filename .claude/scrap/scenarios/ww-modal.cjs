// Escenario: modal unificado de work window — abre el detalle de un bloque,
// copia el ID con clic, edita la hora de fin inline (footer Descartar/Guardar)
// y descarta los cambios.
module.exports = async ({ page, sleep, shot, clickByText }) => {
  await page.waitForSelector('.wb', { timeout: 10000 })
  await sleep(800)

  // Abrir el modal clicando el primer bloque
  const wb = await page.$('.wb')
  await wb.click()
  await sleep(600)
  await shot('ww-modal-open')

  // Copiar ID con clic directo en el chip
  await page.click('.wm__id-chip')
  await sleep(300)
  await shot('ww-modal-id-copied')
  await sleep(1500)

  // Editar hora de fin inline → debe aparecer Descartar / Guardar cambios
  await page.evaluate(() => {
    const els = document.querySelectorAll('.wm__input--time')
    const el = els[1]
    if (!el || el.disabled) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '23:45')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await sleep(400)
  await shot('ww-modal-dirty')

  // Descartar vuelve a los valores originales
  await clickByText('Descartar')
  await sleep(400)
  await shot('ww-modal-discarded')
}
