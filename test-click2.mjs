import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const consoleLogs = []

page.on('console', msg => {
  const text = msg.text()
  if (text.includes('HGE') || text.includes('ERR') || text.includes('game_state')) {
    consoleLogs.push({ t: Date.now(), text: text.substring(0, 150) })
  }
})

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4000)

async function getGameInfo() {
  return await page.evaluate(() => {
    const body = document.body.innerText
    // Use correct class: player-hand-area (not hand-area)
    const handArea = document.querySelector('.player-hand-area')
    const handText = handArea ? handArea.innerText : 'no player hand area'
    const handHTML = handArea ? handArea.innerHTML.substring(0, 500) : ''
    // Check the full hand card details
    const handCards = handArea ? handArea.querySelectorAll('.card-wrapper, [class*="card"]') : []
    const cardDetails = Array.from(handCards).map(el => ({
      text: el.innerText.substring(0, 30),
      class: el.className.substring(0, 60)
    }))
    return { body, handText, handHTML, cardDetails, handCardCount: handCards.length }
  })
}

const info = await getGameInfo()
console.log('Hand text:', info.handText.substring(0, 100))
console.log('Hand card count:', info.handCardCount)
console.log('Cards:', JSON.stringify(info.cardDetails.slice(0, 5)))
console.log('Hand HTML:', info.handHTML.substring(0, 300))

// Get bounding box of player hand area
const handBox = await page.evaluate(() => {
  const hand = document.querySelector('.player-hand-area')
  if (!hand) return null
  const rect = hand.getBoundingClientRect()
  return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
})
console.log('\nPlayer hand box:', handBox)

// Try clicking on the player hand area
if (handBox && handBox.w > 0) {
  console.log('\n=== CLICKING PLAYER HAND ===')
  
  // Click at different positions
  const positions = [0.15, 0.35, 0.55, 0.75, 0.9]
  for (const pos of positions) {
    const x = handBox.x + handBox.w * pos
    const y = handBox.y + handBox.h / 2
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
    
    const overlay = await page.evaluate(() => {
      const el = document.querySelector('.game-overlay')
      return el ? el.innerText.trim() : ''
    })
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('.modal, [role="dialog"], [class*="dialog"]')
      return modal ? modal.innerText.substring(0, 100) : ''
    })
    console.log('  click x=' + Math.round(x - handBox.x) + '/' + handBox.w + ' -> ov="' + overlay.substring(0, 20) + '" modal="' + modalText.substring(0, 40) + '"')
    
    if (modalText) break
  }
}

// Check the card-wrapper inside player hand
const cardWrapperInfo = await page.evaluate(() => {
  const wrappers = document.querySelectorAll('.player-hand-area .card-wrapper')
  if (wrappers.length === 0) return 'no card wrappers'
  const first = wrappers[0]
  return 'found ' + wrappers.length + ' wrappers, first rect: ' + JSON.stringify({
    x: Math.round(first.getBoundingClientRect().x),
    y: Math.round(first.getBoundingClientRect().y),
    w: Math.round(first.getBoundingClientRect().width),
    h: Math.round(first.getBoundingClientRect().height)
  })
})
console.log('\nCard wrappers:', cardWrapperInfo)

// Try clicking a card wrapper directly
if (cardWrapperInfo.includes('found')) {
  const wrappers = await page.locator('.player-hand-area .card-wrapper').all()
  console.log('Clicking card wrapper 0...')
  await wrappers[0].click()
  await page.waitForTimeout(400)
  
  const modalText = await page.evaluate(() => {
    const modal = document.querySelector('.modal, [role="dialog"], [class*="dialog"]')
    return modal ? modal.innerText.substring(0, 150) : ''
  })
  console.log('Modal after wrapper click:', modalText)
  
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
  console.log('All buttons:', JSON.stringify(buttons.slice(0, 15)))
  
  // Try clicking Summon
  const summonBtn = await page.locator('button:has-text("Summon")').first()
  const canSummon = await summonBtn.isEnabled().catch(() => false)
  console.log('Can click Summon:', canSummon)
  
  if (canSummon) {
    await summonBtn.click()
    await page.waitForTimeout(500)
    
    const info2 = await getGameInfo()
    console.log('\nAfter summon:')
    console.log('  Hand count:', info2.handCardCount)
    console.log('  Cards:', JSON.stringify(info2.cardDetails.slice(0, 5)))
    
    // Now try to advance phase
    console.log('\n=== ADVANCING TO BATTLE ===')
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(500)
    
    const overlay = await page.evaluate(() => {
      const el = document.querySelector('.game-overlay')
      return el ? el.innerText.trim() : ''
    })
    console.log('  Overlay:', overlay.substring(0, 50))
    
    // Check field monsters
    const fieldInfo = await page.evaluate(() => {
      const playerMonsters = document.querySelectorAll('.player-field-area .card-wrapper')
      const oppMonsters = document.querySelectorAll('.opponent-field-area .card-wrapper')
      return { player: playerMonsters.length, opp: oppMonsters.length }
    })
    console.log('  Field monsters - player:', fieldInfo.player, 'opp:', fieldInfo.opp)
  }
}

console.log('\n=== CONSOLE LOGS ===')
consoleLogs.forEach(l => console.log('  [' + (l.t - (consoleLogs[0]?.t || 0)) + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-click2.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-click2.png')
await browser.close()
process.exit(0)