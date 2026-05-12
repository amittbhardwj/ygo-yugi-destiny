/**
 * Full end-to-end test: real server + playwright browser
 * Tests whether imgUrl from server actually renders as <img> in the browser
 */
import { fork } from 'child_process'
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Patch index.html to use localhost:3457 for socket
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace('const SOCKET_URL = window.location.origin', 'const SOCKET_URL = "http://localhost:3457"')
writeFileSync(join(distDir, 'index-patched.html'), localHTML)

// Static file server on 3457
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

// Start actual game server on 3456
const gameServer = fork(join(__dirname, 'server/index.js'), [], {
  stdio: 'pipe',
  env: { ...process.env, PORT: '3456' }
})
let serverReady = false
gameServer.stdout.on('data', d => {
  process.stdout.write('[S] ' + d)
  if (String(d).includes('server running')) serverReady = true
})

setTimeout(async () => {
  const { chromium } = await import('playwright')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
    if (msg.type() === 'log') console.log('[browser]', msg.text())
  })
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message))

  console.log('Loading page...')
  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2000)

  // Click "Play vs Yugi (AI)"
  const yugiBtn = page.locator('button:has-text("Play vs Yugi")').first()
  if (await yugiBtn.count() > 0) {
    console.log('Clicking "Play vs Yugi (AI)"...')
    await yugiBtn.click()
    await page.waitForTimeout(500)
  } else {
    console.log('No "Play vs Yugi" button found!')
  }

  // Fill name and start
  const nameInput = page.locator('input').first()
  if (await nameInput.count() > 0) {
    await nameInput.fill('Amitt')
    console.log('Filled player name')
  }

  const startBtn = page.locator('button:has-text("Start Duel")').first()
  if (await startBtn.count() > 0) {
    console.log('Clicking "Start Duel!"...')
    await startBtn.click()
    await page.waitForTimeout(4000)
  } else {
    console.log('No "Start Duel" button found!')
  }

  // Analyze page
  const bodyText = await page.locator('body').innerText().catch(() => 'FAILED')
  console.log('\n=== GAME SCREEN TEXT (first 600) ===')
  console.log(bodyText.substring(0, 600))

  // Check for images in hand
  const allImgs = await page.locator('img').count()
  console.log(`\nTotal <img> tags: ${allImgs}`)

  // Get ALL img src attributes
  for (let i = 0; i < allImgs; i++) {
    const src = await page.locator('img').nth(i).getAttribute('src').catch(() => 'ERR')
    const loaded = await page.locator('img').nth(i).evaluate(el => el.complete && el.naturalWidth > 0).catch(() => false)
    console.log(`  img[${i}]: src="${src}" loaded=${loaded}`)
  }

  // Check hand-scroll specifically
  const handImgs = await page.locator('.hand-scroll img').count()
  console.log(`\nImages in .hand-scroll: ${handImgs}`)

  // Check card-detail-image
  const detailImgs = await page.locator('.card-detail-image').count()
  console.log(`Images in .card-detail-image: ${detailImgs}`)
  for (let i = 0; i < detailImgs; i++) {
    const src = await page.locator('.card-detail-image').nth(i).getAttribute('src').catch(() => '?')
    console.log(`  detail img[${i}]: ${src}`)
  }

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===')
    errors.forEach(e => console.log('  ', e))
  }

  await page.screenshot({ path: '/tmp/ygo-game-test.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-game-test.png')

  await browser.close()
  gameServer.kill()
  httpServer.close()
  process.exit(0)
}, 2500)