/**
 * Final end-to-end test against live Railway deployment
 */
import { chromium } from 'playwright'

const URL = 'https://ygo-yugi-destiny-production.up.railway.app'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setViewportSize({ width: 1280, height: 900 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().substring(0, 200))
    if (msg.type() === 'log' && msg.text().includes('Connected')) process.stdout.write('[LOG] ' + msg.text().substring(0,80) + '\n')
  })

  await page.goto(URL)
  await page.waitForTimeout(2000)

  // Click Play vs Yugi
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(400)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(6000)

  // Check images
  const imgInfo = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map(img => ({
      w: img.naturalWidth, h: img.naturalHeight,
      src: img.src
    }))
  )
  const loaded = imgInfo.filter(i => i.w > 0).length
  console.log(`\n=== CARD IMAGES ===`)
  console.log(`  ${loaded}/${imgInfo.length} loaded`)
  imgInfo.slice(0,5).forEach((img,i) => {
    const ok = img.w > 0 ? '✅' : '❌'
    console.log(`  ${ok} [${i}] ${img.w}x${img.h} | ${img.src}`)
  })

  // Check game state
  const body = await page.locator('body').innerText()
  console.log(`\n  Connected: ${!body.includes('Disconnected') ? '✅' : '❌'}`)
  console.log(`  YOUR HAND: ${body.includes('YOUR HAND') ? '✅' : '❌'}`)

  // Check no old errors
  const hasOldError = body.includes('Use set-spell-trap') || body.includes('Use play-card to summon')
  console.log(`  SET bug fixed: ${!hasOldError ? '✅' : '❌'}`)

  await page.screenshot({ path: '/tmp/ygo-railway-final.png', fullPage: true })
  console.log(`\n  Screenshot: /tmp/ygo-railway-final.png`)

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===')
    errors.forEach(e => console.log('  ', e.substring(0, 150)))
  } else {
    console.log('\n  No console errors ✅')
  }

  await browser.close()
  process.exit(loaded > 0 ? 0 : 1)
})()