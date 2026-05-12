/**
 * Fresh screenshot test with local server (not Railway)
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Load image map
const IMAGE_MAP = JSON.parse(readFileSync(join(__dirname, 'server/cardImageMap.json'), 'utf8'))
function getCardImageUrl(cardId) {
  if (!cardId) return null
  const base = cardId.replace(/_[0-9]+$/, '')
  return IMAGE_MAP[base] || null
}

// Patch the built JS to use localhost:3456 for socket
let jsContent = readFileSync(join(distDir, 'assets/index-BFEq6HIn.js'), 'utf8')
jsContent = jsContent.replace(
  'const Ph=window.__SOCKET_URL__||window.location.origin',
  'const Ph="http://localhost:3456"'
)
writeFileSync(join(distDir, 'assets/index-patched.js'), jsContent)

// Patch HTML to use patched JS
let htmlContent = readFileSync(join(distDir, 'index.html'), 'utf8')
htmlContent = htmlContent.replace('index-BFEq6HIn.js', 'assets/index-patched.js')
writeFileSync(join(distDir, 'index-patched.html'), htmlContent)

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

// Server already running on 3456 from previous step
setTimeout(async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setViewportSize({ width: 1280, height: 900 })

  page.on('console', msg => {
    if (msg.type() === 'log' && msg.text().includes('Connected')) {
      process.stdout.write(`[L] ${msg.text().substring(0, 100)}\n`)
    }
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

  console.log(`\n=== CARD IMAGES (Local Server Test) ===`)
  imgInfo.forEach((img, i) => {
    const ok = img.w > 0 ? '✅ LOADED' : '❌ FAILED'
    console.log(`  ${ok} [${i}] ${img.w}x${img.h} | ${img.src}`)
  })

  const loaded = imgInfo.filter(img => img.w > 0).length
  console.log(`\n${loaded}/${imgInfo.length} images loaded`)

  await page.screenshot({ path: '/tmp/ygo-screenshot-final.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-screenshot-final.png')

  await browser.close()
  httpServer.close()
  process.exit(loaded > 0 ? 0 : 1)
}, 2500)