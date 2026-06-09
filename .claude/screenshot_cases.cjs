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
  console.log('[1] Logging in...')
  const auth = await apiLogin(EMAIL, PASSWORD)
  console.log('[2] Login OK, launching browser...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()

  // Collect console errors
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(err.message))

  // Inject tokens
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.evaluate((t, r) => {
    localStorage.clear()
    localStorage.setItem('tyflow_token', t)
    if (r) localStorage.setItem('tyflow_refresh_token', r)
  }, auth.access_token, auth.refresh_token)

  // === Screenshot 1: Lista ===
  console.log('[3] Navigating to cases list...')
  await page.goto(BASE + '/app/cases/list/open', { waitUntil: 'networkidle2', timeout: 30000 })
  // Wait until table rows OR empty state appear (not skeleton)
  await waitFor(page, () => {
    return document.querySelectorAll('.ct__row:not(.ct__row--skel)').length > 0
      || !!document.querySelector('.ct__empty')
  }, 15000)
  await new Promise(r => setTimeout(r, 1500))
  await page.screenshot({ path: '.claude/cases_lista.png' })
  const rowCount = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
  console.log(`[4] Lista saved (${rowCount} rows)`)

  // Click "Todos" to show all statuses
  const clickedTodos = await page.evaluate(() => {
    const pills = document.querySelectorAll('button')
    for (const p of pills) {
      if (p.textContent.trim() === 'Todos') { p.click(); return true }
    }
    return false
  })
  if (clickedTodos) {
    console.log('[5] Clicked Todos filter, waiting for data...')
    await waitFor(page, () => {
      return document.querySelectorAll('.ct__row:not(.ct__row--skel)').length > 0
        || !!document.querySelector('.ct__empty')
    }, 15000)
    await new Promise(r => setTimeout(r, 2000))
  }
  await page.screenshot({ path: '.claude/cases_lista_todos.png' })
  const totalRows = await page.evaluate(() => document.querySelectorAll('.ct__row:not(.ct__row--skel)').length)
  console.log(`[6] Lista Todos saved (${totalRows} rows)`)

  // Click first row for detail
  if (totalRows > 0) {
    await page.evaluate(() => document.querySelector('.ct__row:not(.ct__row--skel)').click())
    await new Promise(r => setTimeout(r, 2500))
    await page.screenshot({ path: '.claude/cases_detail.png' })
    console.log('[7] Detail panel saved')
  } else {
    console.log('[7] No rows for detail')
  }

  // === Screenshot 2: Cargas ===
  console.log('[8] Navigating to Cargas...')
  await page.goto(BASE + '/app/cases/loads', { waitUntil: 'networkidle2', timeout: 30000 })
  // Wait for specialist list or loading to finish
  await waitFor(page, () => {
    return document.querySelectorAll('.clv__spec-item, .clv__spec-row').length > 0
      || !!document.querySelector('.clv__empty, .clv')
  }, 20000)
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '.claude/cases_cargas.png' })
  console.log('[9] Cargas saved')

  // Debug: log what we see
  const cargasDebug = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasSidebar: !!document.querySelector('.sidebar, nav'),
      bodyClasses: document.body.className,
      mainContent: document.querySelector('.cases, .clv, .cv')?.className || 'none',
      allClasses: [...new Set([...document.querySelectorAll('[class]')].map(e => e.className).filter(c => c.includes('clv') || c.includes('cases') || c.includes('cv')))].slice(0, 10),
    }
  })
  console.log('[9b] Cargas debug:', JSON.stringify(cargasDebug))

  // === Screenshot 3: Especialistas ===
  console.log('[10] Navigating to Especialistas...')
  await page.goto(BASE + '/app/cases/specialists', { waitUntil: 'networkidle2', timeout: 30000 })
  await waitFor(page, () => {
    return !!document.querySelector('.cv__spec, .cv, .cases')
  }, 15000)
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: '.claude/cases_especialistas.png' })
  console.log('[11] Especialistas saved')

  // === Screenshot 4: Create modal ===
  console.log('[12] Opening create modal...')
  await page.goto(BASE + '/app/cases/list/open', { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise(r => setTimeout(r, 3000))
  const createClicked = await page.evaluate(() => {
    const btns = document.querySelectorAll('button')
    for (const b of btns) {
      const text = b.textContent.trim()
      if (text.includes('Nuevo caso') || text.includes('Crear')) { b.click(); return text }
    }
    return false
  })
  if (createClicked) {
    console.log(`[13] Clicked: "${createClicked}"`)
    await new Promise(r => setTimeout(r, 1500))
    await page.screenshot({ path: '.claude/cases_create_modal.png' })
    console.log('[14] Create modal saved')
  } else {
    console.log('[13] Create button not found, listing buttons...')
    const buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean))
    console.log('    Buttons:', buttons.join(' | '))
  }

  // Report errors
  if (errors.length) {
    console.log('\n=== CONSOLE ERRORS ===')
    errors.forEach(e => console.log(e))
  } else {
    console.log('\n[OK] No console errors')
  }

  await browser.close()
  console.log('[DONE]')
}

run().catch(e => { console.error('[ERROR]', e.message); process.exit(1) })
