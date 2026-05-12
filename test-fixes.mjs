import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4500)

async function getOverlay() {
  return await page.evaluate(() => {
    const el = document.querySelector('.game-overlay')
    return el ? el.innerText.trim() : ''
  })
}
async function getButtons() {
  return await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t))
}
async function getField() {
  return await page.evaluate(() => ({
    p: document.querySelectorAll('.player-field-area .card-selectable').length,
    o: document.querySelectorAll('.opponent-field-area .card-selectable').length
  }))
}

console.log('=== VERIFY FIXES ===')

// Summon a monster
const cards = await page.locator('.player-hand-area .card-selectable').all()
let mc = null
for (const c of cards) { const t = await c.innerText(); if (t.includes('ATK')) { mc = c; break } }
if (mc) {
  await mc.click(); await page.waitForTimeout(80); await mc.click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("SUMMON")').click()
  await page.waitForTimeout(500)
}
console.log('Summoned. Field:', JSON.stringify(await getField()))

// Advance to BP
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(500)
console.log('In BP. Overlay:', (await getOverlay()).substring(0, 40))

// Advance to M2, then EP, then END TURN
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(400)
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(400)

// Now click END TURN - this should cycle M2->EP, then EP->DRAW(AI), and AI should complete
console.log('\n=== CLICKING END TURN (should cycle phases + trigger AI) ===')
const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET enabled:', et)
if (et) {
  await page.locator('button:has-text("END TURN")').click()
  console.log('Clicked - watching for AI...')
  await page.waitForTimeout(1000)
}

for (let i = 0; i < 15; i++) {
  const ov = await getOverlay()
  const et2 = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
  const ep2 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
  const f = await getField()
  console.log('  [' + i + '] EP=' + ep2 + ' ET=' + et2 + ' ov="' + ov.substring(0, 35) + '" field=' + JSON.stringify(f))
  
  if (ov.includes('YOUR TURN')) { console.log('  *** AI FINISHED - PLAYER TURN RESUMED ***'); break }
  
  if (et2) {
    await page.locator('button:has-text("END TURN")').click()
    await page.waitForTimeout(2000)
  } else if (ep2) {
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(1500)
  } else {
    await page.waitForTimeout(2000)
  }
}

console.log('Final overlay:', (await getOverlay()).substring(0, 60))
await page.screenshot({ path: '/tmp/ygo-fix-check.png', fullPage: true })
console.log('Screenshot: /tmp/ygo-fix-check.png')
await browser.close()
process.exit(0)