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
    const hasSidebar = await page.evaluate(() => !!document.querySelector('.sidebar, .main-layout, nav'))
    if (hasSidebar) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function run() {
  const auth = await apiLogin(process.env.TYFLOW_EMAIL, process.env.TYFLOW_PASSWORD)
  console.log('[1] Login OK')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()

  // Go to app root, inject token
  await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // Reload to let the app read the token on boot
  await page.goto('http://localhost:8182/app/calendario', { waitUntil: 'networkidle0', timeout: 20000 })
  console.log('[2] Page loaded, waiting for app shell...')

  const appReady = await waitForApp(page, 15000)
  console.log('[3] App ready:', appReady)

  if (!appReady) {
    await page.screenshot({ path: '.claude/screenshot_day.png' })
    console.log('[!] App not ready, screenshot saved for debug')
    await browser.close()
    return
  }

  // Wait for data to load
  await new Promise(r => setTimeout(r, 4000))

  // Switch to Day view
  const clickedDay = await clickByText(page, 'button', 'Día')
  console.log('[4] Clicked Día:', clickedDay)
  await new Promise(r => setTimeout(r, 2000))

  // Click "Hoy"
  const clickedHoy = await clickByText(page, 'button', 'Hoy')
  console.log('[5] Clicked Hoy:', clickedHoy)
  await new Promise(r => setTimeout(r, 4000))

  // Log current state
  const info = await page.evaluate(() => {
    const header = document.querySelector('.cal__toolbar, .cal-toolbar, [class*="toolbar"]')
    return {
      url: window.location.href,
      title: document.title,
      headerText: header?.textContent?.trim()?.slice(0, 100) || 'no toolbar found',
      bodyClasses: document.body.className,
    }
  })
  console.log('[6] State:', JSON.stringify(info))

  await page.screenshot({ path: '.claude/screenshot_day.png' })
  console.log('[OK] screenshot_day.png')

  await browser.close()
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
