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

console.log('=== BUG 1: ATTACK (player can attack in battle phase) ===')
// Summon monster
const cards = await page.locator('.player-hand-area .card-selectable').all()
let monsterCard = null
for (const c of cards) {
  const t = await c.innerText()
  if (t.includes('ATK')) { monsterCard = c; break }
}
if (monsterCard) {
  await monsterCard.click(); await page.waitForTimeout(80); await monsterCard.click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("SUMMON")').click()
  await page.waitForTimeout(500)
}
console.log('Field after summon:', JSON.stringify(await getField()))

// Advance to Battle Phase
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(600)
console.log('Overlay in BP:', (await getOverlay()).substring(0, 40))

// Direct attack (no opponent monsters)
const field = await getField()
if (field.p > 0 && field.o === 0) {
  // Select monster via double-click
  const pm = await page.locator('.player-field-area .card-selectable').all()
  await pm[0].click(); await page.waitForTimeout(80); await pm[0].click()
  await page.waitForTimeout(500)
  
  const ov = await getOverlay()
  console.log('After monster select (BP), overlay:', ov.substring(0, 50))
  
  // Click on empty opponent field area to attack directly
  const oppBox = await page.locator('.opponent-field-area').boundingBox()
  if (oppBox) {
    // Emit direct-attack by clicking empty field (or use handleAttackTarget)
    // Since there's no opponent monster, we try clicking the field to trigger direct attack
    console.log('Attempting direct attack via click on opponent field area...')
    await page.mouse.click(oppBox.x + oppBox.width/2, oppBox.y + oppBox.height/2)
    await page.waitForTimeout(600)
    
    const ov2 = await getOverlay()
    console.log('After attack attempt overlay:', ov2.substring(0, 60))
    
    // Also check console for any errors
    const field2 = await getField()
    console.log('Field after attack:', JSON.stringify(field2))
  }
}

console.log('\n=== BUG 2: AI CAN END TURN (AI finishes, player turn resumes) ===')
// End turn - should cycle through phases and trigger AI
const etBtn = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET enabled:', etBtn)
if (etBtn) {
  await page.locator('button:has-text("END TURN")').click()
  console.log('Clicked ET - should cycle phases and trigger AI...')
  await page.waitForTimeout(1500)
}

// Wait for AI to complete
for (let i = 0; i < 15; i++) {
  const ov = await getOverlay()
  const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
  const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
  console.log('  [' + i + '] EP=' + ep + ' ET=' + et + ' ov="' + ov.substring(0, 35) + '"')
  
  if (ov.includes('YOUR TURN')) { console.log('  -> AI finished, player turn!'); break }
  
  if (et) {
    await page.locator('button:has-text("END TURN")').click()
    await page.waitForTimeout(2000)
  } else if (ep) {
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(1500)
  } else {
    await page.waitForTimeout(2000)
  }
}

console.log('Final overlay:', (await getOverlay()).substring(0, 60))
console.log('Final field:', JSON.stringify(await getField()))

await page.screenshot({ path: '/tmp/ygo-verify.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-verify.png')
await browser.close()
process.exit(0)