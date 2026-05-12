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

console.log('=== FINDING A MONSTER CARD IN HAND ===')
// Get all cards in hand with their text to identify monsters
const handCards = await page.evaluate(() => {
  const cards = document.querySelectorAll('.player-hand-area .card-selectable')
  return Array.from(cards).map((card, i) => {
    const text = card.innerText || ''
    const hasATK = text.includes('ATK')
    return { index: i, text: text.substring(0, 60), isMonster: hasATK }
  })
})
console.log('Hand cards:', JSON.stringify(handCards, null, 2))

// Find first monster card (has ATK text)
const monsterIndex = handCards.findIndex(c => c.isMonster)
if (monsterIndex === -1) {
  console.log('ERROR: No monster cards found in hand!')
  process.exit(1)
}
console.log('First monster at index:', monsterIndex)

console.log('\n=== STEP 1: SUMMON MONSTER (double-click) ===')
// Get all card-selectable elements in hand and click the monster one
const monsterCards = await page.locator('.player-hand-area .card-selectable').all()
console.log('Total cards in hand:', monsterCards.length)

// Filter to find monster cards by checking their text
let monsterCard = null
for (let i = 0; i < monsterCards.length; i++) {
  const text = await monsterCards[i].innerText()
  if (text.includes('ATK')) {
    monsterCard = monsterCards[i]
    console.log('Clicking monster card at index', i, 'text:', text.substring(0, 50))
    break
  }
}

if (!monsterCard) {
  console.log('ERROR: Could not find monster card')
  process.exit(1)
}

// Double click to summon
await monsterCard.click()
await page.waitForTimeout(80)
await monsterCard.click()
await page.waitForTimeout(300)

const buttons1 = await getButtons()
console.log('Buttons:', JSON.stringify(buttons1.filter(b => b.includes('SUMMON') || b.includes('SET') || b.includes('Cancel'))))

const hasSummon = buttons1.some(b => b.includes('SUMMON'))
if (hasSummon) {
  await page.locator('button:has-text("SUMMON")').click()
  await page.waitForTimeout(500)
  console.log('Summoned!')
} else if (buttons1.some(b => b.includes('SET'))) {
  console.log('No SUMMON but has SET - checking if it is a monster...')
  // Try clicking SET anyway
  const setBtn = await page.locator('button:has-text("SET")').first()
  await setBtn.click()
  await page.waitForTimeout(500)
  console.log('Set card')
} else {
  console.log('ERROR: No SUMMON or SET button found')
  process.exit(1)
}

const field1 = await getField()
console.log('Field after play:', JSON.stringify(field1))

console.log('\n=== STEP 2: ADVANCE TO BATTLE PHASE ===')
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(600)
const ov1 = await getOverlay()
const f1 = await getField()
console.log('After M1->BP: overlay="' + ov1.substring(0, 40) + '" field=' + JSON.stringify(f1))

console.log('\n=== STEP 3: ATTACK ===')
if (f1.playerMonsters > 0) {
  // Double click player monster to select it
  const playerMonsters = await page.locator('.player-field-area .card-selectable').all()
  await playerMonsters[0].click()
  await page.waitForTimeout(80)
  await playerMonsters[0].click()
  await page.waitForTimeout(400)
  
  const ov2 = await getOverlay()
  console.log('After monster select: overlay="' + ov2.substring(0, 50) + '"')
  
  // Try attacking opponent monster if exists, otherwise direct attack
  if (f1.oppMonsters > 0) {
    const oppMonsters = await page.locator('.opponent-field-area .card-selectable').all()
    await oppMonsters[0].click()
    await page.waitForTimeout(80)
    await oppMonsters[0].click()
    await page.waitForTimeout(400)
    
    const ov3 = await getOverlay()
    const f2 = await getField()
    console.log('After attack: overlay="' + ov3.substring(0, 50) + '" field=' + JSON.stringify(f2))
  } else {
    console.log('No opponent monsters - attempting direct attack')
    // Click player monster again to direct attack
    await playerMonsters[0].click()
    await page.waitForTimeout(80)
    await playerMonsters[0].click()
    await page.waitForTimeout(400)
  }
} else {
  console.log('BUG: No player monsters on field!')
}

// Check game state after attack
const afterAttack = await getField()
console.log('Field after attack attempt:', JSON.stringify(afterAttack))

console.log('\n=== STEP 4: END TURN ===')
const etEnabled = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET enabled:', etEnabled)

if (etEnabled) {
  console.log('Clicking END TURN...')
  await page.locator('button:has-text("END TURN")').click()
  await page.waitForTimeout(1500)
}

console.log('\n=== STEP 5: WAIT FOR AI TURN ===')
for (let i = 0; i < 15; i++) {
  const ov = await getOverlay()
  const buttons = await getButtons()
  console.log('  [' + i + '] ov="' + ov.substring(0, 40) + '"')
  
  if (ov.includes('YOUR TURN')) {
    console.log('  -> AI done, player turn!')
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

console.log('\nFinal overlay:', (await getOverlay()).substring(0, 60))
console.log('Final field:', JSON.stringify(await getField()))

console.log('\n=== LOGS ===')
logs.forEach(l => console.log('  [' + (l.t - (logs[0]?.t || 0)) + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-full2.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-full2.png')
await browser.close()
process.exit(0)