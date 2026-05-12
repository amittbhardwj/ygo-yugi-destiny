import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []

page.on('console', msg => {
  const text = msg.text()
  if (text.includes('HGE') || text.includes('ERR')) logs.push({ t: Date.now(), text: text.substring(0, 100) })
})

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4000)

async function getOverlay() {
  return await page.evaluate(() => {
    const el = document.querySelector('.game-overlay')
    return el ? el.innerText.trim() : ''
  })
}
async function getButtons() {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
}
async function getField() {
  return await page.evaluate(() => ({
    playerMonsters: document.querySelectorAll('.player-field-area .card-selectable').length,
    oppMonsters: document.querySelectorAll('.opponent-field-area .card-selectable').length
  }))
}

console.log('=== STEP 1: SUMMON MONSTER (double-click) ===')
await page.locator('.player-hand-area .card-selectable').first().click()
await page.waitForTimeout(80)
await page.locator('.player-hand-area .card-selectable').first().click()
await page.waitForTimeout(300)

const buttons1 = await getButtons()
console.log('Buttons:', JSON.stringify(buttons1.filter(b => b.includes('SUMMON') || b.includes('SET') || b.includes('Cancel'))))
const hasSummon = buttons1.some(b => b.includes('SUMMON'))
if (hasSummon) {
  await page.locator('button:has-text("SUMMON")').click()
  await page.waitForTimeout(500)
  console.log('Summoned!')
} else {
  console.log('ERROR: No SUMMON button found')
  process.exit(1)
}

const field1 = await getField()
console.log('Field after summon:', JSON.stringify(field1))

console.log('\n=== STEP 2: ADVANCE TO BATTLE PHASE ===')
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(500)
const ov1 = await getOverlay()
const f1 = await getField()
console.log('After M1->BP: overlay="' + ov1.substring(0, 40) + '" field=' + JSON.stringify(f1))

console.log('\n=== STEP 3: ATTACK ===')
if (f1.playerMonsters > 0) {
  // Select player monster
  await page.locator('.player-field-area .card-selectable').first().click()
  await page.waitForTimeout(200)
  await page.locator('.player-field-area .card-selectable').first().click() // rapid 2nd click
  await page.waitForTimeout(300)
  
  const ov2 = await getOverlay()
  console.log('After monster select: overlay="' + ov2.substring(0, 50) + '"')
  
  // Check if in "select attack target" mode - should show attack button or be able to click opponent monster
  if (f1.oppMonsters > 0) {
    // Click opponent monster to attack
    await page.locator('.opponent-field-area .card-selectable').first().click()
    await page.waitForTimeout(300)
    await page.locator('.opponent-field-area .card-selectable').first().click() // rapid 2nd
    await page.waitForTimeout(300)
    
    const ov3 = await getOverlay()
    const f2 = await getField()
    console.log('After attack target: overlay="' + ov3.substring(0, 50) + '" field=' + JSON.stringify(f2))
  } else {
    console.log('No opponent monsters - can direct attack')
    // Try direct attack
    await page.locator('.player-field-area .card-selectable').first().click()
    await page.waitForTimeout(200)
    await page.locator('.player-field-area .card-selectable').first().click()
    await page.waitForTimeout(300)
  }
} else {
  console.log('BUG: No player monsters on field after summon!')
}

// Check buttons to see if attack was registered
const buttonsAttack = await getButtons()
console.log('Buttons after attack:', JSON.stringify(buttonsAttack.filter(b => b.includes('END') || b.includes('SUMMON')).slice(0, 8)))

console.log('\n=== STEP 4: END TURN (cycle through phases) ===')
// End Turn should cycle through all remaining phases automatically
const etEnabled = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET button enabled:', etEnabled)

if (etEnabled) {
  console.log('Clicking END TURN to cycle through remaining phases...')
  await page.locator('button:has-text("END TURN")').click()
  await page.waitForTimeout(1500)
  
  // AI should now take its turn (phases cycling automatically)
  // Wait for AI to finish and player turn to come back
  for (let i = 0; i < 15; i++) {
    const ov = await getOverlay()
    const buttons = await getButtons()
    console.log('  [' + i + '] ov="' + ov.substring(0, 40) + '" EP=' + buttons.some(b => b.includes('END PHASE') && !b.includes('END')) + ' ET=' + buttons.some(b => b.includes('END TURN')))
    
    if (ov.includes('YOUR TURN')) {
      console.log('  -> AI finished! Player turn resumed.')
      break
    }
    
    const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
    const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
    
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
  
  const finalOv = await getOverlay()
  console.log('\nFinal overlay:', finalOv.substring(0, 60))
} else {
  console.log('BUG: END TURN button not enabled!')
}

console.log('\n=== LOGS ===')
logs.forEach(l => console.log('  [' + (l.t - (logs[0]?.t || 0)) + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-full-test.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-full-test.png')
await browser.close()
process.exit(0)