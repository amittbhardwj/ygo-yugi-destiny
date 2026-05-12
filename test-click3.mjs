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

console.log('=== INVESTIGATING CLICK BEHAVIOR ===')
const cardCount = await page.locator('.player-hand-area .card-selectable').count()
console.log('Hand cards:', cardCount)

if (cardCount > 0) {
  // Test 1: Single click, then check card detail panel
  console.log('\n--- Test 1: Single click ---')
  await page.locator('.player-hand-area .card-selectable').first().click()
  await page.waitForTimeout(300)
  
  const panelInfo = await page.evaluate(() => {
    const panel = document.querySelector('.card-detail-panel')
    return panel ? panel.innerText.substring(0, 100) : 'no panel'
  })
  console.log('Card detail panel:', panelInfo.substring(0, 80))
  
  // Test 2: Try native dispatch of dblclick
  console.log('\n--- Test 2: Native dblclick event ---')
  await page.evaluate(() => {
    const card = document.querySelector('.player-hand-area .card-selectable')
    if (card) {
      const rect = card.getBoundingClientRect()
      // Create and dispatch a real dblclick event
      const evt = new MouseEvent('dblclick', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: rect.x + rect.width/2,
        clientY: rect.y + rect.height/2
      })
      card.dispatchEvent(evt)
      console.log('[TEST] Dispatched dblclick on card')
    }
  })
  await page.waitForTimeout(500)
  
  const buttons2 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
  console.log('Buttons after native dblclick:', JSON.stringify(buttons2.slice(0, 15)))
  
  const modal2 = await page.evaluate(() => {
    const modal = document.querySelector('.modal, [class*="modal"]')
    return modal ? modal.innerText.substring(0, 100) : 'no modal'
  })
  console.log('Modal after native dblclick:', modal2.substring(0, 60))
  
  // Test 3: Check the GameBoard's canPlayCard state by looking at the DOM
  console.log('\n--- Test 3: Check game state ---')
  const gameState = await page.evaluate(() => {
    // Try to read React state or DOM state
    const buttons = Array.from(document.querySelectorAll('button'))
    const phaseButtons = buttons.filter(b => ['DP','SP','M1','BP','M2','EP'].includes(b.textContent.trim()))
    const epEnabled = buttons.find(b => b.textContent.includes('END PHASE'))
    const etEnabled = buttons.find(b => b.textContent.includes('END TURN'))
    
    // Check overlay text
    const overlay = document.querySelector('.game-overlay')
    const body = document.body.innerText
    
    return {
      phaseButtons: phaseButtons.map(b => b.textContent.trim()),
      epEnabled: epEnabled ? !epEnabled.disabled : false,
      etEnabled: etEnabled ? !etEnabled.disabled : false,
      overlay: overlay ? overlay.innerText.trim() : '',
      bodySnippet: body.substring(0, 100)
    }
  })
  console.log('Game state:', JSON.stringify(gameState, null, 2))
  
  // Test 4: Directly trigger PlayCardModal via React state inspection
  console.log('\n--- Test 4: Try setTimeout delay ---')
  await page.waitForTimeout(500)
  // Try clicking first card then second click within 300ms
  await page.locator('.player-hand-area .card-selectable').first().click()
  await page.waitForTimeout(100)
  await page.locator('.player-hand-area .card-selectable').first().click()
  await page.waitForTimeout(400)
  
  const buttons4 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
  console.log('Buttons after 2 rapid clicks:', JSON.stringify(buttons4.slice(0, 15)))
  
  const modal4 = await page.evaluate(() => {
    const modal = document.querySelector('.modal, [class*="modal"]')
    return modal ? modal.innerText.substring(0, 100) : 'no modal'
  })
  console.log('Modal after rapid clicks:', modal4.substring(0, 60))
}

await page.screenshot({ path: '/tmp/ygo-click-test.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-click-test.png')
await browser.close()
process.exit(0)