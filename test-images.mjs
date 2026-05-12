/**
 * Test image loading + screenshot
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

  // Monitor network requests for images
  page.on('response', async res => {
    const url = res.url()
    if (url.includes('storage.googleapis.com')) {
      const status = res.status()
      const ct = res.headers()['content-type'] || ''
      console.log(`[IMG ${status}] ${url} (${ct.substring(0, 50)})`)
    }
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(1500)
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(300)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(4000)

  // Get img elements with their dimensions
  const imgInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      offsetWidth: img.offsetWidth,
      offsetHeight: img.offsetHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      loaded: img.getAttribute('onload') !== null
    }))
  })

  console.log('\n=== IMAGE STATUS ===')
  imgInfo.forEach((img, i) => {
    console.log(`  [${i}] ${img.naturalWidth}x${img.naturalHeight} px (natural) | ${img.offsetWidth}x${img.offsetHeight} px (rendered) | complete=${img.complete} | src=${img.src}`)
  })

  // Check if images have naturalWidth > 0 (loaded successfully)
  const loadedImgs = imgInfo.filter(img => img.naturalWidth > 0)
  console.log(`\nImages with actual dimensions: ${loadedImgs.length}/${imgInfo.length}`)

  // Get page text
  const bodyText = await page.locator('body').innerText()
  const hasHand = bodyText.includes('YOUR HAND')
  console.log(`\nYOUR HAND visible: ${hasHand}`)

  // Screenshot
  await page.screenshot({ path: '/tmp/ygo-img-test.png', fullPage: true })
  console.log('Screenshot: /tmp/ygo-img-test.png')

  await browser.close()
  httpServer.close()
  process.exit(0)
}, 2000)