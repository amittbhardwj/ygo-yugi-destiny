import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const consoleLogs = []
const socketEvents = []

page.on('console', msg => {
  const text = msg.text()
  if (text.includes('HGE') || text.includes('HP') || text.includes('ERR') || text.includes('HPC') || text.includes('HEP') || text.includes('HAI')) {
    consoleLogs.push({ t: Date.now(), text: text.substring(0, 120) })
  }
})

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4000)

async function getButtons() {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
}
async function getOverlay() {
  return await page.evaluate(() => {
    const el = document.querySelector('.game-overlay')
    return el ? el.innerText.trim() : ''
  })
}
async function getPhase() {
  return await page.evaluate(() => {
    const body = document.body.innerText
    // Extract phase from body text
    const match = body.match(/(Draw|Standby|Main 1|Battle|Main 2|End|DP|SP|M1|BP|M2|EP)/)
    return match ? match[1] : ''
  })
}

console.log('=== INITIAL ===')
console.log('Buttons:', JSON.stringify(await getButtons()))
console.log('Overlay:', await getOverlay())
console.log('Phase:', await getPhase())

// Check hand count
const handInfo = await page.evaluate(() => {
  const hand = document.querySelector('.hand-area')
  const cards = hand ? hand.querySelectorAll('.card-wrapper') : []
  return { count: cards.length, html: hand ? hand.innerHTML.substring(0, 300) : 'no hand' }
})
console.log('Hand:', handInfo.count, 'cards')

// Summon a monster - click first card in hand (check position of hand area)
if (handInfo.count > 0) {
  console.log('\n=== SUMMONING ===')
  // Find all clickable cards
  const allCards = await page.locator('.hand-area .card-wrapper, .card-wrapper').all()
  console.log('Found', allCards.length, 'card wrappers')
  
  if (allCards.length > 0) {
    await allCards[0].click()
    await page.waitForTimeout(400)
    
    const modal = await page.evaluate(() => {
      const m = document.querySelector('.modal, [class*="modal"], [class*="card-detail"]')
      return m ? m.innerText.substring(0, 200) : 'no modal'
    })
    console.log('After card click:', modal.substring(0, 150))
    
    // Look for buttons in modal
    const modalButtons = await page.evaluate(() => {
      const modal = document.querySelector('.modal')
      if (!modal) return []
      return Array.from(modal.querySelectorAll('button')).map(b => b.textContent.trim())
    })
    console.log('Modal buttons:', JSON.stringify(modalButtons))
    
    // Try to find and click Summon
    const summonBtn = await page.locator('button:has-text("Summon")').isEnabled().catch(() => false)
    console.log('Summon button enabled:', summonBtn)
    
    if (summonBtn) {
      await page.locator('button:has-text("Summon")').click()
      await page.waitForTimeout(500)
      
      console.log('\nAfter summon:')
      console.log('Overlay:', await getOverlay())
      console.log('Buttons:', JSON.stringify(await getButtons()))
      console.log('Phase:', await getPhase())
      
      // Now advance through phases and try to attack
      console.log('\n=== ADVANCING TO BATTLE ===')
      
      // EP to go M1 -> BP
      await page.locator('button:has-text("END PHASE")').click().catch(() => {})
      await page.waitForTimeout(600)
      
      console.log('After EP M1->BP:')
      console.log('  Overlay:', await getOverlay())
      console.log('  Phase:', await getPhase())
      console.log('  Buttons:', JSON.stringify(await getButtons()))
      
      // Check if player has monsters now
      const fieldInfo = await page.evaluate(() => {
        const playerMonsters = document.querySelectorAll('.player-field-area .card-wrapper')
        const oppMonsters = document.querySelectorAll('.opponent-field-area .card-wrapper')
        return { playerMonsters: playerMonsters.length, oppMonsters: oppMonsters.length }
      })
      console.log('Field:', JSON.stringify(fieldInfo))
      
      // If in battle phase, try to attack
      const inBattle = (await getOverlay()).includes('Battle') || (await getPhase()).includes('Battle')
      console.log('\nIn Battle?', inBattle)
      
      if (fieldInfo.playerMonsters > 0 && inBattle) {
        console.log('Attempting attack...')
        await page.locator('.player-field-area .card-wrapper').first().click()
        await page.waitForTimeout(400)
        
        const afterSelect = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
          return buttons.slice(0, 10)
        })
        console.log('After monster select, buttons:', JSON.stringify(afterSelect))
        
        // Try clicking opponent monster
        if (fieldInfo.oppMonsters > 0) {
          await page.locator('.opponent-field-area .card-wrapper').first().click()
          await page.waitForTimeout(500)
          console.log('After target click - Overlay:', await getOverlay())
        }
      }
      
      // Advance to AI turn
      console.log('\n=== END TURN ===')
      const etBtn = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
      console.log('ET enabled:', etBtn)
      
      if (etBtn) {
        await page.locator('button:has-text("END TURN")').click()
        await page.waitForTimeout(2000)
        
        // Check for EP button and click it to trigger AI
        for (let i = 0; i < 10; i++) {
          const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
          const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
          const ov = await getOverlay()
          const ph = await getPhase()
          console.log('  [' + i + '] EP=' + ep + ' ET=' + et + ' ov="' + ov.substring(0, 30) + '" phase=' + ph)
          
          if (et) {
            await page.locator('button:has-text("END TURN")').click()
            await page.waitForTimeout(2000)
          } else if (ep) {
            await page.locator('button:has-text("END PHASE")').click()
            await page.waitForTimeout(1500)
          } else {
            await page.waitForTimeout(2000)
          }
          
          // Break if player turn detected
          if (ov.includes('YOUR TURN')) {
            console.log('  -> Player turn detected!')
            break
          }
        }
      }
      
      console.log('\nFinal state:')
      console.log('  Overlay:', await getOverlay())
      console.log('  Phase:', await getPhase())
      console.log('  Buttons:', JSON.stringify(await getButtons()))
    }
  }
}

console.log('\n=== CONSOLE LOGS ===')
consoleLogs.forEach(l => console.log('  [' + ((l.t - consoleLogs[0]?.t) || 0) + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-final.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-final.png')
await browser.close()
process.exit(0)