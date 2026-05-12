/**
 * Test Railway server with fixed client (using __SOCKET_URL__ override)
 * This patches the built client to use Railway server, proving the server-side imgUrl works
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Patch the built JS to use Railway server and window.__SOCKET_URL__
let jsContent = readFileSync(join(distDir, 'assets/index-BFEq6HIn.js'), 'utf8')
// Replace const Ph=window.__SOCKET_URL__||window.location.origin with hardcoded Railway URL
jsContent = jsContent.replace(
  'const Ph=window.__SOCKET_URL__||window.location.origin',
  'const Ph="https://ygo-yugi-destiny-production.up.railway.app"'
)
// Write as a separate patched file
writeFileSync(join(distDir, 'assets/index-patched.js'), jsContent)

// Patch index.html to use patched JS and window.__SOCKET_URL__
let htmlContent = readFileSync(join(distDir, 'index.html'), 'utf8')
htmlContent = htmlContent
  .replace('index-BFEq6HIn.js', 'assets/index-patched.js')
  .replace('<head>', '<head><script>window.__SOCKET_URL__="https://ygo-yugi-destiny-production.up.railway.app"</script>')
writeFileSync(join(distDir, 'index-patched.html'), htmlContent)

// Static server on 3457
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
  page.setViewportSize({ width: 1280, height: 900 })

  page.on('console', msg => {
    if (msg.type() === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 200)}\n`)
    if (msg.type() === 'log' && msg.text().includes('Connected')) {
      process.stdout.write(`[L] ${msg.text().substring(0, 100)}\n`)
    }
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2500)

  // Play vs Yugi
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(400)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(5000)

  // Get connection status
  const bodyText = await page.locator('body').innerText()
  const connected = !bodyText.includes('Disconnected')
  console.log(`\nConnection: ${connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`)

  // Get image status
  const imgInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      w: img.naturalWidth,
      h: img.naturalHeight
    }))
  })

  console.log(`\n=== CARD IMAGES ===`)
  imgInfo.forEach((img, i) => {
    const ok = img.w > 0 ? '✅' : '❌'
    console.log(`  ${ok} [${i}] ${img.w}x${img.h} | ${img.src}`)
  })

  const loaded = imgInfo.filter(img => img.w > 0).length
  console.log(`\n${loaded}/${imgInfo.length} images loaded`)

  await page.screenshot({ path: '/tmp/ygo-railway-fixed.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-railway-fixed.png')

  await browser.close()
  httpServer.close()
  process.exit(connected ? 0 : 1)
}, 2000)