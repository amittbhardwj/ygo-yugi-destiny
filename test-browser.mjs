/**
 * Local test with real server + Playwright
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Static server on 3457 with SOCKET_URL pointing to 3456 (server already running)
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace('<head>', '<head><script>window.__SOCKET_URL__="http://localhost:3456"</script>')
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
console.log('Static server on 3457 | Game server on 3456')

setTimeout(async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 300)}\n`)
    if (t === 'log') {
      const text = msg.text()
      if (text.includes('room-created') || text.includes('game-state') || text.includes('[Socket]') || text.includes('Connected') || text.includes('game_state') || text.includes('imgUrl')) {
        process.stdout.write(`[L] ${text.substring(0, 300)}\n`)
      }
    }
  })

  console.log('\nLoading page...')
  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2000)

  // Click Play vs Yugi
  const yugiBtn = page.locator('button:has-text("Play vs Yugi")')
  if (await yugiBtn.count() > 0) {
    console.log('Clicking Play vs Yugi...')
    await yugiBtn.click()
    await page.waitForTimeout(500)
    await page.locator('input').fill('Amitt')
    await page.locator('button:has-text("Start Duel")').click()
    await page.waitForTimeout(4000)
  } else {
    console.log('No Play vs Yugi button')
  }

  const body = await page.locator('body').innerText()
  console.log('\n=== GAME SCREEN ===')
  console.log(body.substring(0, 800))

  const imgs = await page.locator('img').count()
  console.log(`\nTotal <img>: ${imgs}`)
  for (let i = 0; i < imgs; i++) {
    const src = await page.locator('img').nth(i).getAttribute('src').catch(() => '?')
    console.log(`  img[${i}]: ${src}`)
  }

  const handScroll = await page.locator('.hand-scroll').count()
  const handImgs = await page.locator('.hand-scroll img').count()
  console.log(`\n.hand-scroll: ${handScroll} | images in hand-scroll: ${handImgs}`)

  const connected = !body.includes('Disconnected')
  console.log(`Connected: ${connected}`)

  await page.screenshot({ path: '/tmp/ygo-local-test.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-local-test.png')

  await browser.close()
  httpServer.close()
  process.exit(0)
}, 2000)