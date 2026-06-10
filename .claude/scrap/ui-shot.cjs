/**
 * ui-shot.cjs — Harness reutilizable de capturas de UI (scrap).
 * ============================================================================
 * Inicia sesión por API, inyecta el token, abre la app en Puppeteer y captura
 * pantallas en los temas/vistas pedidos. Salida ORGANIZADA por fecha en
 * .claude/scrap/shots/<YYYY-MM-DD>/.
 *
 * Uso:
 *   node .claude/scrap/ui-shot.cjs [opciones]
 *
 * Opciones (todas con default):
 *   --url <path>        Ruta a capturar.            (def: /app/calendar)
 *   --tag <name>        Prefijo del archivo.        (def: derivado de --url)
 *   --themes <list>     light,dark | light | dark.  (def: light,dark)
 *   --views <list>      Botones de vista a clicar por texto, separados por
 *                       coma (p.ej. Día,Semana,Mes). Vacío = sin clic.
 *                                                   (def: Semana,Día,Mes)
 *   --viewport <WxH>    Tamaño de ventana.          (def: 1600x1000)
 *   --wait <ms>         Espera tras cada navegación.(def: 2500)
 *   --full              Captura página completa (no solo viewport).
 *   --selector <css>    Espera a que exista este selector antes de capturar.
 *
 * Requisitos: app en BASE (8182) y API en API (8181) corriendo; Puppeteer
 * disponible. Credenciales por env TYFLOW_EMAIL / TYFLOW_PASSWORD o defaults.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

let puppeteer
try { puppeteer = require('puppeteer') }
catch { puppeteer = require('C:/nvm4w/nodejs/node_modules/puppeteer') }

// ---- Config ----
const EMAIL = process.env.TYFLOW_EMAIL || 'andrestao577@gmail.com'
const PASSWORD = process.env.TYFLOW_PASSWORD || 'pepita2026*'
const BASE = process.env.TYFLOW_BASE || 'http://localhost:8182'
const API = process.env.TYFLOW_API || 'http://localhost:8181'

// ---- CLI args ----
function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  if (i === -1) return def
  const v = process.argv[i + 1]
  return (v && !v.startsWith('--')) ? v : true
}
const URL_PATH = arg('url', '/app/calendar')
const TAG = arg('tag', URL_PATH.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page')
const THEMES = String(arg('themes', 'light,dark')).split(',').map(s => s.trim()).filter(Boolean)
const VIEWS = arg('views', 'Semana,Día,Mes')
const VIEW_LIST = VIEWS === true ? [] : String(VIEWS).split(',').map(s => s.trim()).filter(Boolean)
const [VW, VH] = String(arg('viewport', '1600x1000')).split('x').map(Number)
const WAIT = Number(arg('wait', 2500))
const FULL = arg('full', false) === true
const SELECTOR = arg('selector', null)

// ---- Output dir: by date ----
const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
const OUT_DIR = path.join(__dirname, 'shots', today)
fs.mkdirSync(OUT_DIR, { recursive: true })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function apiLogin() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email: EMAIL, password: PASSWORD })
    const url = new URL(API + '/auth/login')
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { const j = JSON.parse(data); j.access_token ? resolve(j) : reject(new Error(data)) }
        catch { reject(new Error(data)) }
      })
    })
    req.on('error', reject); req.write(body); req.end()
  })
}

async function clickByText(page, text) {
  return page.evaluate((t) => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.trim() === t) { b.click(); return true }
    }
    return false
  }, text)
}

async function run() {
  const auth = await apiLogin()
  console.log('[login] OK')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', `--window-size=${VW},${VH}`],
    defaultViewport: { width: VW, height: VH },
  })
  const page = await browser.newPage()
  const saved = []

  for (const theme of THEMES) {
    // Seed auth + theme into localStorage before the app boots.
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.evaluate((t, r, th) => {
      localStorage.clear()
      localStorage.setItem('tyflow_token', t)
      if (r) localStorage.setItem('tyflow_refresh_token', r)
      localStorage.setItem('tyflow_preferences_v2', JSON.stringify({ theme: th }))
    }, auth.access_token, auth.refresh_token, theme)

    await page.goto(BASE + URL_PATH, { waitUntil: 'networkidle2', timeout: 30000 })
    if (SELECTOR) { try { await page.waitForSelector(SELECTOR, { timeout: 15000 }) } catch {} }
    await sleep(WAIT)

    const shots = VIEW_LIST.length ? VIEW_LIST : [null]
    for (const view of shots) {
      if (view) { await clickByText(page, view); await sleep(WAIT) }
      const name = `${TAG}__${theme}${view ? '__' + view.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase() : ''}.png`
      const file = path.join(OUT_DIR, name)
      await page.screenshot({ path: file, fullPage: FULL })
      saved.push(path.relative(process.cwd(), file))
      console.log('[shot]', name)
    }
  }

  await browser.close()
  console.log('\n[done] ' + saved.length + ' capturas en ' + path.relative(process.cwd(), OUT_DIR))
  saved.forEach(f => console.log('  ' + f))
}

run().catch(e => { console.error('[error]', e.message); process.exit(1) })
