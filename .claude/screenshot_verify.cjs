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

async function waitFor(page, checkFn, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await page.evaluate(checkFn)
    if (result) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

async function run() {
  const auth = await apiLogin(EMAIL, PASSWORD)
  console.log('[1] Login OK')

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

  // 1. Lista with Todos filter + data
  await page.goto(BASE + '/app/cases/list/open', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 3000))
  // Click Todos
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === 'Todos') { b.click(); return }
    }
  })
  await waitFor(page, () => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length > 0, 15000)
  await new Promise(r => setTimeout(r, 2000))
  await page.screenshot({ path: '.claude/verify_lista.png' })
  console.log('[2] Lista saved')

  // Click first case for detail
  const hasRows = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
  if (hasRows > 0) {
    await page.evaluate(() => document.querySelector('.ct__row:not(.ct__row--skel)').click())
    await new Promise(r => setTimeout(r, 2500))
    await page.screenshot({ path: '.claude/verify_detail.png' })
    console.log('[3] Detail saved')
  }

  // 2. Especialistas
  await page.goto(BASE + '/app/cases/specialists', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  await page.screenshot({ path: '.claude/verify_especialistas.png' })
  console.log('[4] Especialistas saved')

  // 3. Cargas
  await page.goto(BASE + '/app/cases/loads', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 5000))
  // Click first specialist
  await page.evaluate(() => {
    const items = document.querySelectorAll('[class*="spec-item"], [class*="spec-row"]')
    if (items.length > 0) items[0].click()
  })
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '.claude/verify_cargas.png' })
  console.log('[5] Cargas saved')

  // 4. Create modal
  await page.goto(BASE + '/app/cases/list/open', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 3000))
  await page.evaluate(() => {
    const btn = document.querySelector('.cv__create-btn')
    if (btn) btn.click()
  })
  await new Promise(r => setTimeout(r, 1500))
  await page.screenshot({ path: '.claude/verify_create.png' })
  console.log('[6] Create modal saved')

  await browser.close()
  console.log('[DONE]')
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
