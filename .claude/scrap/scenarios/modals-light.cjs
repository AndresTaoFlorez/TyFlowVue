// Escenario: modales en tema CLARO (DOM-only) — grupo + bulk.
module.exports = async ({ page, shot, sleep }) => {
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForSelector('.wb, .wgb', { timeout: 20000 })
  await sleep(1500)
  const wgb = await page.$('.wgb')
  if (wgb) {
    await wgb.click()
    await sleep(900)
    await shot('group')
    await page.keyboard.press('Escape')
    await sleep(600)
  }
  await page.click('.cside__create')
  await sleep(400)
  await page.evaluate(() => document.querySelectorAll('.cside__menu-item')[1].click())
  await sleep(900)
  await shot('bulk')
  await page.keyboard.press('Escape')
}
