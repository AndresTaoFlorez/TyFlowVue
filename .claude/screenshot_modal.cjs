const puppeteer = require('C:/nvm4w/nodejs/node_modules/puppeteer')
const http = require('http')

const EMAIL = 'andrestao577@gmail.com'
const PASSWORD = 'pepita2026*'
const BASE = 'http://localhost:8182'
const API  = 'http://localhost:8181'

function apiLogin(email, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password })
    const url = new URL(API + '/auth/login')
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
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

async function run() {
  const auth = await apiLogin(EMAIL, PASSWORD)
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.clear()
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // Navigate to list, wait for page to fully render
  await page.goto(BASE + '/app/cases/list/open', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))

  // Debug: list all buttons found
  const btns = await page.evaluate(() =>
    [...document.querySelectorAll('button, a.cv__create-btn, [class*="create"], [class*="nuevo"]')]
      .map(b => ({ tag: b.tagName, text: b.textContent.trim().slice(0, 40), cls: b.className.slice(0, 60) }))
  )
  console.log('Buttons found:', JSON.stringify(btns, null, 2))

  // Try clicking with class selector
  const clicked = await page.evaluate(() => {
    // Try class-based
    let btn = document.querySelector('.cv__create-btn, [class*="create"], [class*="nuevo"]')
    if (btn) { btn.click(); return 'class: ' + btn.className }
    // Try text-based
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.includes('Nuevo')) { b.click(); return 'text: ' + b.textContent.trim() }
    }
    return false
  })
  console.log('Clicked:', clicked)

  if (clicked) {
    await new Promise(r => setTimeout(r, 1500))
    await page.screenshot({ path: '.claude/cases_create_modal.png' })
    console.log('Modal screenshot saved')
  }

  // Also take a high-res screenshot of the lista with detail open
  // First switch to Todos and wait
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === 'Todos') { b.click(); return }
    }
  })
  await new Promise(r => setTimeout(r, 4000))

  // Click first case
  const hasRows = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
  if (hasRows > 0) {
    await page.evaluate(() => document.querySelector('.ct__row:not(.ct__row--skel)').click())
    await new Promise(r => setTimeout(r, 3000))
    await page.screenshot({ path: '.claude/cases_detail_hires.png' })
    console.log('Detail hi-res saved')
  }

  // Take Cargas with a specialist selected
  await page.goto(BASE + '/app/cases/loads', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  // Click first specialist
  const specClicked = await page.evaluate(() => {
    const items = document.querySelectorAll('.clv__spec-item, [class*="spec-row"], [class*="spec-item"]')
    if (items.length > 0) { items[0].click(); return true }
    return false
  })
  if (specClicked) {
    await new Promise(r => setTimeout(r, 4000))
    await page.screenshot({ path: '.claude/cases_cargas_selected.png' })
    console.log('Cargas with specialist saved')
  }

  await browser.close()
  console.log('[DONE]')
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
