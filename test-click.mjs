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

// Intercept socket messages to see what's being received
await page.evaluate(() => {
  window.__socketEvents = []
  const origEmit = window.io?.prototype?.emit
  // Can't easily intercept, but we can check the useSocket hook's state
})

// Get all visible text and interactive elements
async function getGameInfo() {
  return await page.evaluate(() => {
    const body = document.body.innerText
    // Find the hand area
    const handArea = document.querySelector('.hand-area')
    const handText = handArea ? handArea.innerText : 'no hand area'
    // Count all elements with role or interactivity
    const allDivs = document.querySelectorAll('div')
    const cardLike = Array.from(allDivs).filter(el => {
      const rect = el.getBoundingClientRect()
      return rect.width > 40 && rect.height > 40 && el.innerText.length > 0
    }).map(el => ({
      text: el.innerText.substring(0, 30),
      class: el.className.substring(0, 40),
      rect: { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }
    })).slice(0, 20)
    // Check what's inside the hand area
    const handHTML = handArea ? handArea.innerHTML.substring(0, 500) : ''
    return { body, handText, handHTML, cardLike }
  })
}

const info = await getGameInfo()
console.log('Body:', info.body.substring(0, 150))
console.log('Hand text:', info.handText.substring(0, 80))
console.log('Hand HTML:', info.handHTML.substring(0, 200))
console.log('Card-like elements:', JSON.stringify(info.cardLike.slice(0, 10), null, 2))

// Try to click on what appears to be a card
console.log('\n=== TRYING TO INTERACT ===')
const allClickable = await page.locator('.hand-area > *, .hand-area [class*="card"], [class*="card-wrapper"]').all()
console.log('Hand area children:', allClickable.length)

// Try clicking at position where hand cards should be
const handBox = await page.evaluate(() => {
  const hand = document.querySelector('.hand-area')
  if (!hand) return null
  const rect = hand.getBoundingClientRect()
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
})
console.log('Hand area box:', handBox)

// Try clicking multiple positions within hand area
if (handBox && handBox.w > 0) {
  const positions = [0.2, 0.4, 0.6, 0.8]
  for (const pos of positions) {
    const x = handBox.x + handBox.w * pos
    const y = handBox.y + handBox.h / 2
    await page.mouse.click(x, y)
    await page.waitForTimeout(300)
    
    const overlay = await page.evaluate(() => {
      const el = document.querySelector('.game-overlay')
      return el ? el.innerText.trim() : ''
    })
    const modalVisible = await page.evaluate(() => {
      const modal = document.querySelector('.modal, [class*="modal"], [role="dialog"]')
      return modal ? modal.innerText.substring(0, 100) : ''
    })
    console.log('Click at x=' + Math.round(x) + ', y=' + Math.round(y) + ' -> overlay="' + overlay.substring(0, 30) + '" modal="' + modalVisible.substring(0, 50) + '"')
    
    // If modal opened, break
    if (modalVisible) break
  }
}

await page.waitForTimeout(1000)
const afterClicks = await getGameInfo()
console.log('\nAfter clicks - hand text:', afterClicks.handText.substring(0, 80))
console.log('Overlay:', await page.evaluate(() => { const el = document.querySelector('.game-overlay'); return el ? el.innerText.trim() : '' }))

console.log('\n=== CONSOLE LOGS ===')
consoleLogs.forEach(l => console.log('  [' + (l.t - (consoleLogs[0]?.t || 0)) + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-click-test.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-click-test.png')
await browser.close()
process.exit(0)