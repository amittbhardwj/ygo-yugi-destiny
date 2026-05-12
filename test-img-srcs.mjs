/**
 * Targeted test: get exact img src values from rendered cards
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
    if (msg.type() === 'error') process.stdout.write(`[E] ${msg.text().substring(0, 200)}\n`)
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(1500)

  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(300)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(4000)

  // Get all img src values
  const imgData = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img')
    return Array.from(imgs).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      parent: img.parentElement?.className || img.parentElement?.tagName
    }))
  })

  console.log('\n=== ALL <img> ELEMENTS ===')
  console.log(`Total: ${imgData.length}`)
  imgData.forEach((img, i) => {
    console.log(`  [${i}] src="${img.src}" complete=${img.complete} naturalW=${img.naturalWidth} parent="${img.parent}"`)
  })

  // Also get hand card text
  const handText = await page.evaluate(() => {
    const handCards = document.querySelectorAll('.hand-scroll .card')
    return Array.from(handCards).map(c => c.querySelector('.card-name')?.textContent || c.innerText?.substring(0, 50) || 'unknown')
  })
  console.log(`\nHand card names: ${handText.join(', ')}`)

  await page.screenshot({ path: '/tmp/ygo-final-test.png', fullPage: true })
  console.log('\nScreenshot: /tmp/ygo-final-test.png')

  await browser.close()
  httpServer.close()
  process.exit(0)
}, 2000)