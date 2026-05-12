/**
 * Test with socket.io interception to see what URL it's connecting to
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

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

setTimeout(async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', msg => {
    const t = msg.type()
    if (t === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 300)}\n`)
    if (t === 'log') process.stdout.write(`[L] ${msg.text().substring(0, 300)}\n`)
  })

  // Intercept ALL requests to 3456
  page.on('request', req => {
    const url = req.url()
    if (url.includes('3456')) {
      console.log(`[REQ→3456] ${req.method()} ${url.substring(0, 150)}`)
    }
  })
  page.on('response', res => {
    const url = res.url()
    if (url.includes('3456')) {
      console.log(`[RES←3456] ${res.status()} ${url.substring(0, 100)}`)
    }
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(1500)

  // Check what socket URL is actually being used
  const socketUrlUsed = await page.evaluate(() => window.__SOCKET_URL__)
  console.log('\nwindow.__SOCKET_URL__ =', socketUrlUsed)

  // Check if socket is connecting
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(300)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(3000)

  const body = await page.locator('body').innerText()
  console.log('\n=== SCREEN ===')
  console.log(body.substring(0, 400))

  const imgs = await page.locator('img').count()
  console.log(`\n<img>: ${imgs}`)

  await page.screenshot({ path: '/tmp/ygo-intercept-test.png', fullPage: true })
  await browser.close()
  httpServer.close()
  process.exit(0)
}, 2000)