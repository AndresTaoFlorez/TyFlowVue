/**
 * Isolated screenshot scraper for visual QA.
 * Uses Puppeteer to navigate to the calendar, handle login if needed,
 * and capture a screenshot.
 *
 * Usage: node .claude/screenshot.mjs [url] [output]
 */
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'

const TARGET_URL = process.argv[2] || 'http://localhost:8182/app/calendario'
const OUTPUT = process.argv[3] || '.claude/screenshot.png'

// Login credentials (read from env or fallback)
const LOGIN_URL = 'http://localhost:8182/'

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  })

  const page = await browser.newPage()

  try {
    // Step 1: Try navigating directly to target
    console.log(`[1] Navigating to ${TARGET_URL}`)
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 15000 })

    // Step 2: Check if we got redirected to login
    const currentUrl = page.url()
    console.log(`[2] Current URL: ${currentUrl}`)

    if (!currentUrl.includes('/app/')) {
      // We're on login page — need to authenticate
      console.log('[3] Detected login page, attempting login...')

      // Wait for login form
      await page.waitForSelector('input[type="email"], input[type="text"]', { timeout: 5000 })

      // Check localStorage for existing token
      const hasToken = await page.evaluate(() => !!localStorage.getItem('tyflow_token'))
      if (!hasToken) {
        console.log('[!] No stored token and no credentials provided.')
        console.log('[!] Please login manually first in the browser, then re-run.')
        // Take screenshot of login page anyway
        await page.screenshot({ path: OUTPUT, fullPage: false })
        console.log(`[*] Login page screenshot saved to ${OUTPUT}`)
        await browser.close()
        return
      }
    }

    // Step 3: We should be on the app — wait for calendar content to render
    console.log('[4] Waiting for calendar to render...')
    await page.waitForSelector('.cal, .day-cal, .week-cal, [class*="calendar"]', { timeout: 8000 }).catch(() => {
      console.log('[!] No calendar selector found, taking screenshot anyway')
    })

    // Give Vue time to finish rendering
    await new Promise(r => setTimeout(r, 2000))

    // Step 4: Screenshot
    await page.screenshot({ path: OUTPUT, fullPage: false })
    console.log(`[✓] Screenshot saved to ${OUTPUT}`)

  } catch (err) {
    console.error('[ERROR]', err.message)
    // Take screenshot of whatever state we're in
    await page.screenshot({ path: OUTPUT, fullPage: false }).catch(() => {})
    console.log(`[*] Error-state screenshot saved to ${OUTPUT}`)
  } finally {
    await browser.close()
  }
}

run()
