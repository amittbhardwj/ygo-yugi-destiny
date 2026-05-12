import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []

page.on('console', msg => {
  if (msg.type() === 'error') logs.push({ t: Date.now(), msg: msg.text().substring(0, 100) })
})

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4500)

// Get initial state
async function getPhase() {
  return await page.evaluate(() => {
    const overlay = document.querySelector('.game-overlay')
    const phaseEl = document.querySelector('[class*="phase"]')
    const body = document.body.innerText
    // Find the phase indicator in the DOM
    const phaseMatch = body.match(/(DP|SP|M1|BP|M2|EP|END)/)
    return {
      overlay: overlay ? overlay.innerText : '',
      phaseEl: phaseEl ? phaseEl.innerText : '',
      body: body.substring(0, 150)
    }
  })
}

async function getCards() {
  return await page.evaluate(() => {
    // Count field cards
    const playerMonsters = document.querySelectorAll('.player-field-area .card-wrapper')
    const playerSpells = document.querySelectorAll('.player-spells-area .card-wrapper')
    const oppMonsters = document.querySelectorAll('.opponent-field-area .card-wrapper')
    const oppSpells = document.querySelectorAll('.opponent-spells-area .card-wrapper')
    // Get hand cards
    const handCards = document.querySelectorAll('.hand-area .card-wrapper')
    return {
      playerMonsters: playerMonsters.length,
      playerSpells: playerSpells.length,
      oppMonsters: oppMonsters.length,
      oppSpells: oppSpells.length,
      hand: handCards.length
    }
  })
}

console.log('=== START ===')
let phase = await getPhase()
let cards = await getCards()
console.log('phase:', phase.overlay.substring(0, 50))
console.log('cards:', JSON.stringify(cards))

// Summon a monster (play from hand)
console.log('\n=== SUMMONING MONSTER ===')
if (cards.hand > 0) {
  // Click first card in hand
  await page.locator('.hand-area .card-wrapper').first().click()
  await page.waitForTimeout(300)
  
  // Look for summon button in modal
  const summonBtn = Array.from(await page.locator('.modal button').all()).find(b => b.textContent.includes('Summon'))
  if (summonBtn) {
    console.log('Found summon button - clicking')
    await summonBtn.click()
    await page.waitForTimeout(500)
    
    // Now advance through phases
    console.log('\n=== ADVANCING TO BATTLE PHASE ===')
    const ep1 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
    console.log('Can click EP:', ep1)
    
    if (ep1) {
      await page.locator('button:has-text("END PHASE")').click()
      await page.waitForTimeout(600)
    }
    
    phase = await getPhase()
    cards = await getCards()
    console.log('\nAfter M1->BP:')
    console.log('  overlay:', phase.overlay.substring(0, 50))
    console.log('  cards:', JSON.stringify(cards))
    console.log('  body:', phase.body.substring(0, 80))
    
    // Check if in battle phase - try to attack
    const inBattle = phase.overlay.includes('Battle') || phase.body.includes('BP')
    console.log('\n=== ATTEMPTING ATTACK ===')
    console.log('In Battle Phase:', inBattle)
    
    if (cards.playerMonsters > 0) {
      console.log('Player has monsters:', cards.playerMonsters)
      
      // Try clicking a player monster
      await page.locator('.player-field-area .card-wrapper').first().click()
      await page.waitForTimeout(500)
      
      phase = await getPhase()
      console.log('After monster click - overlay:', phase.overlay.substring(0, 50))
      
      // Look for attack button or modal
      const allButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
      })
      console.log('Buttons visible:', allButtons.slice(0, 10))
      
      // Try clicking opponent monster to attack
      if (cards.oppMonsters > 0) {
        console.log('Clicking opponent monster...')
        await page.locator('.opponent-field-area .card-wrapper').first().click()
        await page.waitForTimeout(500)
        
        phase = await getPhase()
        console.log('After opp monster click - overlay:', phase.overlay.substring(0, 50))
      }
    }
    
    // Advance to AI turn
    console.log('\n=== END TURN ===')
    const ep2 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
    if (ep2) {
      await page.locator('button:has-text("END PHASE")').click()
      await page.waitForTimeout(400)
    }
    const ep3 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
    if (ep3) {
      await page.locator('button:has-text("END PHASE")').click()
      await page.waitForTimeout(400)
    }
    const et1 = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
    console.log('ET enabled:', et1)
    if (et1) {
      await page.locator('button:has-text("END TURN")').click()
      await page.waitForTimeout(8000)
    }
    
    phase = await getPhase()
    cards = await getCards()
    console.log('\nAfter AI turn:')
    console.log('  overlay:', phase.overlay.substring(0, 50))
    console.log('  cards:', JSON.stringify(cards))
    console.log('  body:', phase.body.substring(0, 80))
  } else {
    console.log('No summon button found')
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('.modal')
      return modal ? modal.innerText : 'no modal'
    })
    console.log('Modal:', modalText.substring(0, 100))
  }
}

console.log('\n=== ERRORS ===')
logs.forEach(l => console.log(' ', l.msg))

await page.screenshot({ path: '/tmp/ygo-attack-test.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-attack-test.png')
await browser.close()
process.exit(0)