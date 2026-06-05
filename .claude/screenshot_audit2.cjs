const puppeteer = require('C:/nvm4w/nodejs/node_modules/puppeteer')
const http = require('http')

function apiLogin(email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password })
    const req = http.request({
      hostname: 'localhost', port: 8181, path: '/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          j.access_token ? resolve(j) : reject(new Error(data))
        } catch { reject(new Error(data)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function clickByText(page, selector, text) {
  return page.evaluate((sel, txt) => {
    const els = document.querySelectorAll(sel)
    for (const el of els) {
      if (el.textContent.trim() === txt) { el.click(); return true }
    }
    return false
  }, selector, text)
}

async function waitForApp(page, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const ready = await page.evaluate(() => !!document.querySelector('.sidebar, .main-layout, nav'))
    if (ready) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function run() {
  const consoleErrors = []

  const auth = await apiLogin(process.env.TYFLOW_EMAIL, process.env.TYFLOW_PASSWORD)
  console.log('[1] Login OK')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 },
  })
  const page = await browser.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
  })
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`))
  page.on('requestfailed', req => {
    consoleErrors.push(`[net-fail] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
  })

  await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // ── Casos: Lista con filtro "Todos" ──
  await page.goto('http://localhost:8182/app/casos', { waitUntil: 'networkidle2', timeout: 20000 })
  await waitForApp(page)
  await new Promise(r => setTimeout(r, 5000))

  // Click "Todos" filter to see all cases
  await clickByText(page, 'button', 'Todos')
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '.claude/audit2_casos_todos.png' })
  console.log('[2] Casos — Todos filter saved')

  // Click first table row to open detail
  const clicked = await page.evaluate(() => {
    const row = document.querySelector('table tbody tr, .case-row')
    if (row) { row.click(); return true }
    return false
  })
  if (clicked) {
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: '.claude/audit2_caso_detail.png' })
    console.log('[3] Caso detail saved')
  } else {
    console.log('[3] No case rows found')
  }

  // ── Casos: Cargas tab ──
  await clickByText(page, 'button, [role="tab"], span', 'Cargas')
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '.claude/audit2_casos_cargas.png' })
  console.log('[4] Casos — Cargas tab saved')

  // ── Report ──
  if (consoleErrors.length > 0) {
    console.log('\n=== CONSOLE ERRORS ===')
    consoleErrors.forEach(e => console.log(e))
  } else {
    console.log('\n[OK] No console errors detected')
  }

  await browser.close()
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
