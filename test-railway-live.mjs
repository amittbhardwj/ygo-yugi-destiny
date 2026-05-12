/**
 * Direct browser test against Railway deployment - no local patching needed
 */
import { chromium } from 'playwright'

const RAILWAY_URL = 'https://ygo-yugi-destiny-production.up.railway.app'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setViewportSize({ width: 1280, height: 900 })

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().substring(0, 200))
  })

  console.log('Loading Railway deployment...')
  await page.goto(RAILWAY_URL)
  await page.waitForTimeout(2000)

  console.log('Clicking Play vs Yugi...')
  await page.locator('button:has-text("Play vs Yugi")').click()
  await page.waitForTimeout(400)
  await page.locator('input').fill('Amitt')
  await page.locator('button:has-text("Start Duel")').click()
  await page.waitForTimeout(6000)

  const bodyText = await page.locator('body').innerText()
  const connected = !bodyText.includes('Disconnected')
  const hasHand = bodyText.includes('YOUR HAND')

  console.log(`\nConnection: ${connected ? '✅ CONNECTED' : '❌ DISCONNECTED'}`)
  console.log(`YOUR HAND visible: ${hasHand ? '✅ YES' : '❌ NO'}`)

  // Get all images
  const imgInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      w: img.naturalWidth,
      h: img.naturalHeight,
      loaded: img.complete && img.naturalWidth > 0
    }))
  })

  console.log(`\n=== IMAGES ===`)
  imgInfo.forEach((img, i) => {
    const ok = img.loaded ? '✅' : '❌'
    const shortSrc = img.src.length > 80 ? img.src.substring(0, 80) + '...' : img.src
    console.log(`  ${ok} [${i}] ${img.w}x${img.h} | ${shortSrc}`)
  })

  const loaded = imgInfo.filter(img => img.loaded).length
  console.log(`\n${loaded}/${imgInfo.length} images loaded`)

  // Get the page title for reference
  const title = await page.title()
  console.log(`\nPage title: ${title}`)

  await page.screenshot({ path: '/tmp/ygo-railway-live.png', fullPage: true })
  console.log('Screenshot: /tmp/ygo-railway-live.png')

  // Show any errors
  if (errors.length > 0) {
    console.log('\n=== ERRORS ===')
    errors.forEach(e => console.log('  ', e))
  }

  await browser.close()
  process.exit(connected && hasHand ? 0 : 1)
})()