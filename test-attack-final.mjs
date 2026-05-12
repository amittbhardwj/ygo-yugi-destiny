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
await page.waitForTimeout(4000)

async function getOverlay() {
  return await page.evaluate(() => {
    const el = document.querySelector('.game-overlay')
    return el ? el.innerText.trim() : ''
  })
}
async function getField() {
  return await page.evaluate(() => ({
    playerMonsters: document.querySelectorAll('.player-field-area .card-selectable').length,
    oppMonsters: document.querySelectorAll('.opponent-field-area .card-selectable').length
  }))
}
async function getButtons() {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
}

console.log('=== SUMMON MONSTER ===')
const monsterCards = await page.locator('.player-hand-area .card-selectable').all()
let monsterCard = null
for (let i = 0; i < monsterCards.length; i++) {
  const text = await monsterCards[i].innerText()
  if (text.includes('ATK')) { monsterCard = monsterCards[i]; break }
}
if (!monsterCard) { console.log('No monster'); process.exit(1) }

await monsterCard.click(); await page.waitForTimeout(80); await monsterCard.click()
await page.waitForTimeout(300)
await page.locator('button:has-text("SUMMON")').click()
await page.waitForTimeout(500)
console.log('Field:', JSON.stringify(await getField()))

console.log('\n=== ADVANCE TO BATTLE ===')
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(500)

const ov = await getOverlay()
const field = await getField()
console.log('After EP: overlay="' + ov.substring(0, 40) + '" field=' + JSON.stringify(field))

// Now check what phase we're in
const gameInfo = await page.evaluate(() => {
  // Look for phase indicator text
  const body = document.body.innerText
  const phaseMatch = body.match(/DP.*SP.*M1.*BP.*M2.*EP/)
  const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  const epBtn = buttons.find(b => b.includes('END PHASE'))
  const etBtn = buttons.find(b => b.includes('END TURN'))
  return {
    phaseIndicator: phaseMatch ? phaseMatch[0] : '',
    epEnabled: epBtn ? !epBtn.disabled : false,
    etEnabled: etBtn ? !etBtn.disabled : false,
    bodySnippet: body.substring(0, 120)
  }
})
console.log('Game info:', JSON.stringify(gameInfo, null, 2))

// Now try direct attack (no opponent monsters)
console.log('\n=== DIRECT ATTACK ===')
if (field.playerMonsters > 0 && field.oppMonsters === 0) {
  console.log('Attempting direct attack (no opponent monsters)...')
  
  // Select player monster via double click
  const pm = await page.locator('.player-field-area .card-selectable').all()
  await pm[0].click(); await page.waitForTimeout(80); await pm[0].click()
  await page.waitForTimeout(500)
  
  const afterSelect = await getOverlay()
  console.log('After monster select: overlay="' + afterSelect + '"')
  
  // Try clicking on the "opponent field area" or any empty zone to attack
  // Or try direct-attack button
  const buttons = await getButtons()
  console.log('Buttons after select:', JSON.stringify(buttons.slice(0, 15)))
  
  // Look for direct attack option - might be in overlay or as a button
  // Click on the empty opponent field area
  const oppField = await page.locator('.opponent-field-area').first()
  const oppBox = await oppField.boundingBox()
  console.log('Opponent field box:', oppBox)
  
  if (oppBox) {
    // Click center of opponent field area
    await page.mouse.click(oppBox.x + oppBox.width/2, oppBox.y + oppBox.height/2)
    await page.waitForTimeout(500)
    
    const ov3 = await getOverlay()
    console.log('After clicking opponent field: overlay="' + ov3 + '"')
  }
  
  // Also try clicking on the "game board" or looking for an attack button
  // Try the direct-attack handler directly
  const gs = await page.evaluate(() => {
    // Get the game state from the game-board component
    const gameBoard = document.querySelector('[class*="game-board"], .game-board')
    return gameBoard ? 'found game board' : 'no game board'
  })
  console.log('Game board:', gs)
}

console.log('\n=== END TURN ===')
const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET enabled:', et)
if (et) {
  await page.locator('button:has-text("END TURN")').click()
  await page.waitForTimeout(2000)
  
  // Click END PHASE to trigger AI
  for (let i = 0; i < 10; i++) {
    const ep2 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
    const et2 = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
    const ov4 = await getOverlay()
    console.log('  [' + i + '] EP=' + ep2 + ' ET=' + et2 + ' ov="' + ov4.substring(0, 30) + '"')
    
    if (ov4.includes('YOUR TURN')) break
    
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
}

console.log('Final:', (await getOverlay()).substring(0, 50))
await page.screenshot({ path: '/tmp/ygo-attack-test.png', fullPage: true })
console.log('Screenshot: /tmp/ygo-attack-test.png')
await browser.close()
process.exit(0)