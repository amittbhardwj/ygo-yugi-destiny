/**
 * Proof: Test Railway deployment card images with screenshot
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Static server on 3457
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace('const SOCKET_URL = window.location.origin', 'const SOCKET_URL = "https://ygo-yugi-destiny-production.up.railway.app"')
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
  page.setViewportSize({ width: 1280, height: 800 })

  page.on('console', msg => {
    if (msg.type() === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 200)}\n`)
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2000)
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(400)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(5000)

  const imgInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      w: img.naturalWidth,
      h: img.naturalHeight
    }))
  })

  console.log('\n=== CARD IMAGES ON RAILWAY ===')
  imgInfo.forEach((img, i) => {
    const ok = img.w > 0 ? '✅' : '❌'
    console.log(`  ${ok} [${i}] ${img.w}x${img.h} | ${img.src}`)
  })

  const loaded = imgInfo.filter(img => img.w > 0).length
  console.log(`\n${loaded}/${imgInfo.length} images loaded successfully`)

  await page.screenshot({ path: '/tmp/ygo-proof.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-proof.png')

  await browser.close()
  httpServer.close()
  process.exit(loaded > 0 ? 0 : 1)
}, 2000)