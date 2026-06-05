/**
 * Screenshot scraper for visual QA.
 * Logs in via API, injects token, navigates to target, takes screenshot.
 *
 * Usage: node .claude/screenshot.cjs [url] [output] [--click=selector] [--wait=ms]
 */
const puppeteer = require('C:/nvm4w/nodejs/node_modules/puppeteer')
const path = require('path')
const http = require('http')

const args = process.argv.slice(2)
const positional = args.filter(a => !a.startsWith('--'))
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.slice(2).split('=')
  return [k, v ?? 'true']
}))

const TARGET_URL = positional[0] || 'http://localhost:8182/app/calendario'
const OUTPUT = positional[1] || path.join(__dirname, 'screenshot.png')
const API_BASE = 'http://localhost:8181'
const CLICK_SEL = flags.click || null
const WAIT_MS = parseInt(flags.wait) || 3000

function apiLogin(email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password })
    const url = new URL(`${API_BASE}/auth/login`)
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.access_token) resolve(json)
          else reject(new Error(`Login failed: ${data}`))
        } catch { reject(new Error(`Login parse error: ${data}`)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })
  const page = await browser.newPage()

  try {
    // Login
    const email = process.env.TYFLOW_EMAIL
    const password = process.env.TYFLOW_PASSWORD
    if (!email || !password) throw new Error('Set TYFLOW_EMAIL and TYFLOW_PASSWORD')

    console.log('[1] Logging in...')
    const auth = await apiLogin(email, password)

    // Inject token
    await page.goto('http://localhost:8182/', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.evaluate((t, r) => {
      localStorage.setItem('tyflow_token', t)
      if (r) localStorage.setItem('tyflow_refresh_token', r)
    }, auth.access_token, auth.refresh_token)

    // Navigate
    console.log(`[2] Navigating to ${TARGET_URL}`)
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 15000 })
    console.log(`[3] At: ${page.url()}`)

    // Wait for render
    await new Promise(r => setTimeout(r, WAIT_MS))

    // Optional click
    if (CLICK_SEL) {
      console.log(`[4] Clicking: ${CLICK_SEL}`)
      await page.click(CLICK_SEL)
      await new Promise(r => setTimeout(r, WAIT_MS))
    }

    await page.screenshot({ path: OUTPUT, fullPage: false })
    console.log(`[OK] ${OUTPUT}`)
  } catch (err) {
    console.error('[ERROR]', err.message)
    await page.screenshot({ path: OUTPUT }).catch(() => {})
  } finally {
    await browser.close()
  }
}

run()
