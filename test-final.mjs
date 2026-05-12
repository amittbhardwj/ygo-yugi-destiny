/**
 * Clean end-to-end test with real server
 */
import { spawn } from 'child_process'
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Start game server on 3456
const gameServer = spawn('node', [join(__dirname, 'server/index.js')], {
  detached: true,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3456' }
})
gameServer.unref()

// Static server on 3457
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace('const SOCKET_URL = window.location.origin', 'const SOCKET_URL = "http://localhost:3456"')
writeFileSync(join(distDir, 'index-patched.html'), localHTML)

const httpServer = createServer((req, res) => {
  const url = req.url.split('?')[0]
  const fp = join(distDir, url === '/' || url === '/index-patched.html' ? '/index-patched.html' : url)
  if (existsSync(fp)) {
    const ct = fp.endsWith('.js') ? 'application/javascript' : fp.endsWith('.css') ? 'text/css' : fp.endsWith('.html') ? 'text/html' : 'text/plain'
    res.writeHead(200, { 'Content-Type': ct })
    res.end(readFileSync(fp))
  } else {
    res.writeHead(404); res.end('Not found')
  }
})
httpServer.listen(3457)

setTimeout(async () => {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 200)}\n`)
    if (t === 'log') process.stdout.write(`[L] ${msg.text().substring(0, 200)}\n`)
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2000)

  // Click Play vs Yugi
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(500)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(4000)

  const body = await page.locator('body').innerText()
  console.log('\n=== GAME SCREEN ===')
  console.log(body.substring(0, 600))

  const imgs = await page.locator('img').count()
  console.log(`\nTotal <img>: ${imgs}`)
  for (let i = 0; i < imgs; i++) {
    const src = await page.locator('img').nth(i).getAttribute('src').catch(() => '?')
    console.log(`  img[${i}]: ${src}`)
  }

  const handScroll = await page.locator('.hand-scroll').count()
  console.log(`\n.hand-scroll count: ${handScroll}`)

  await page.screenshot({ path: '/tmp/ygo-final-test.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-final-test.png')

  await browser.close()
  process.exit(0)
}, 3000)