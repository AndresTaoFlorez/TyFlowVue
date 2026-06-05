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
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()

  // Capture console errors and failed network requests
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console] ${msg.text()}`)
  })
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`))
  page.on('requestfailed', req => {
    consoleErrors.push(`[net-fail] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
  })

  // Inject auth tokens
  await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // ── Calendario: Week view ──
  await page.goto('http://localhost:8182/app/calendario', { waitUntil: 'networkidle2', timeout: 20000 })
  await waitForApp(page)
  await new Promise(r => setTimeout(r, 6000))
  await page.screenshot({ path: '.claude/audit_calendario_week.png' })
  console.log('[2] Calendario — Week view saved')

  // ── Calendario: Day view ──
  await clickByText(page, 'button', 'Día')
  await new Promise(r => setTimeout(r, 4000))
  await page.screenshot({ path: '.claude/audit_calendario_day.png' })
  console.log('[3] Calendario — Day view saved')

  // ── Casos ──
  await page.goto('http://localhost:8182/app/casos', { waitUntil: 'networkidle2', timeout: 20000 })
  await waitForApp(page)
  await new Promise(r => setTimeout(r, 5000))
  await page.screenshot({ path: '.claude/audit_casos.png' })
  console.log('[4] Casos view saved')

  // Try to click on first case row to open detail (if any exist)
  const hasCase = await page.evaluate(() => {
    const row = document.querySelector('.cases-table tbody tr, .case-card, [class*="case-row"], [class*="caso"]')
    if (row) { row.click(); return true }
    return false
  })
  if (hasCase) {
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: '.claude/audit_caso_detail.png' })
    console.log('[5] Caso detail saved')
  } else {
    console.log('[5] No cases found to click — skipped detail')
  }

  // ── Report console errors ──
  if (consoleErrors.length > 0) {
    console.log('\n=== CONSOLE ERRORS ===')
    consoleErrors.forEach(e => console.log(e))
  } else {
    console.log('\n[OK] No console errors detected')
  }

  await browser.close()
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
