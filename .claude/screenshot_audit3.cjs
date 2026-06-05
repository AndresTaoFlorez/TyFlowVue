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

  // Inject tokens + clear stale cache
  await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.clear()
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // Navigate to casos
  await page.goto('http://localhost:8182/app/casos', { waitUntil: 'networkidle2', timeout: 20000 })
  await waitForApp(page)
  await new Promise(r => setTimeout(r, 4000))

  // Click "Todos" filter to show all cases (default is "Abiertos" which may be empty)
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.cf__pill, .ct__filter-btn, button')
    for (const b of btns) {
      if (b.textContent.trim() === 'Todos') { b.click(); return }
    }
  })
  await new Promise(r => setTimeout(r, 4000))

  // Screenshot list
  await page.screenshot({ path: '.claude/audit3_list.png' })
  const rowCount = await page.evaluate(() => document.querySelectorAll('.ct__row').length)
  console.log(`[2] List: ${rowCount} rows`)

  if (rowCount > 0) {
    // Click first case
    await page.evaluate(() => document.querySelector('.ct__row').click())
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: '.claude/audit3_detail.png' })
    console.log('[3] Detail saved')

    // Click WDD Auto if available
    const wddClicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('.cdm__action')
      for (const btn of btns) {
        if (btn.textContent.includes('WDD')) { btn.click(); return true }
      }
      return false
    })
    if (wddClicked) {
      await new Promise(r => setTimeout(r, 4000))
      await page.screenshot({ path: '.claude/audit3_assign.png' })
      console.log('[4] Assign panel saved')
    } else {
      console.log('[4] No WDD button (case not assignable)')
    }
  }

  if (consoleErrors.length > 0) {
    console.log('\n=== CONSOLE ERRORS ===')
    consoleErrors.forEach(e => console.log(e))
  } else {
    console.log('\n[OK] No console errors')
  }

  await browser.close()
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
