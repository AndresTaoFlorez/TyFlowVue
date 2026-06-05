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
  const auth = await apiLogin(process.env.TYFLOW_EMAIL, process.env.TYFLOW_PASSWORD)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()

  await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  await page.goto('http://localhost:8182/app/calendario', { waitUntil: 'networkidle0', timeout: 20000 })
  await waitForApp(page)
  await new Promise(r => setTimeout(r, 4000))

  // Week view is the default, just screenshot
  await page.screenshot({ path: '.claude/screenshot_week.png' })
  console.log('[OK] screenshot_week.png')
  await browser.close()
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
