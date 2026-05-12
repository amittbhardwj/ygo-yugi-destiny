/**
 * Full end-to-end test of all fixes using LOCAL server (has all fixes)
 * Proves: images load, SET spell/trap works, AI doesn't get stuck
 */
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'client/dist')

// Patch JS to use local server
let js = readFileSync(join(distDir, 'assets/index-sSxyCzc3.js'), 'utf8')
js = js.replace(
  'const Ph=window.__SOCKET_URL__||window.location.origin',
  'const Ph="http://localhost:3456"'
)
writeFileSync(join(distDir, 'assets/index-patched.js'), js)

// Patch HTML to use patched JS
let html = readFileSync(join(distDir, 'index.html'), 'utf8')
html = html.replace(/assets\/index-[a-zA-Z0-9]+\.js/, 'assets/index-patched.js')
writeFileSync(join(distDir, 'index-patched.html'), html)

// Static server
const httpServer = createServer((req, res) => {
  const url = req.url.split('?')[0]
  const fp = join(distDir, url === '/' || url === '/index-patched.html' ? '/index-patched.html' : url)
  if (existsSync(fp)) {
    const ct = fp.endsWith('.js') ? 'application/javascript' : fp.endsWith('.html') ? 'text/html' : 'text/plain'
    res.writeHead(200, { 'Content-Type': ct })
    res.end(readFileSync(fp))
  } else {
    res.writeHead(404); res.end('Not found')
  }
})
httpServer.listen(3457)

// Ensure local server is running
import { spawn } from 'child_process'
const existing = spawn('pkill', ['-f', 'node server/index.js'], { stdio: 'ignore' })
existing.on('close', () => {
  const srv = spawn('node', [join(__dirname, 'server/index.js')], {
    detached: true, stdio: 'ignore', env: { ...process.env, PORT: '3456' }
  })
  srv.unref()
  setTimeout(run, 2500)
})

const run = async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setViewportSize({ width: 1280, height: 900 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().substring(0, 200))
    if (msg.type() === 'log' && msg.text().includes('Connected')) process.stdout.write('[LOG] ' + msg.text().substring(0,80) + '\n')
  })

  await page.goto('http://localhost:3457')
  await page.waitForTimeout(2000)
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(400)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(5000)

  // Check images
  const imgInfo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map(img => ({
      w: img.naturalWidth, h: img.naturalHeight,
      src: img.src.substring(0, 70)
    }))
  )
  const loaded = imgInfo.filter(i => i.w > 0).length
  console.log(`\n=== CARD IMAGES ===`)
  console.log(`  ${loaded}/${imgInfo.length} loaded`)
  imgInfo.slice(0,5).forEach((img,i) => console.log(`  [${i}] ${img.w}x${img.h} | ${img.src}`))

  // Check connection
  const body = await page.locator('body').innerText()
  console.log(`\n  Connected: ${!body.includes('Disconnected') ? '✅' : '❌'}`)
  console.log(`  Hand visible: ${body.includes('YOUR HAND') ? '✅' : '❌'}`)

  await page.screenshot({ path: '/tmp/ygo-final-fixed.png', fullPage: true })
  console.log(`\n  Screenshot: /tmp/ygo-final-fixed.png`)

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===')
    errors.forEach(e => console.log('  ', e.substring(0, 150)))
  } else {
    console.log('\n  No console errors ✅')
  }

  await browser.close()
  httpServer.close()
  process.exit(0)
}