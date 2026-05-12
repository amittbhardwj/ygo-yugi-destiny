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

// Get the actual DOM structure
async function inspectGame() {
  return await page.evaluate(() => {
    // Get hand area
    const handArea = document.querySelector('.hand-area')
    const handHTML = handArea ? handArea.innerHTML.substring(0, 500) : 'no hand area'
    
    // Get all buttons
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
    
    // Get all elements with 'card' in class
    const cardEls = Array.from(document.querySelectorAll('[class*="card"]')).slice(0, 15).map(el => ({
      class: el.className.substring(0, 60),
      tag: el.tagName,
      text: el.innerText.substring(0, 40)
    }))
    
    return { handHTML, buttons, cardEls }
  })
}

const info = await inspectGame()
console.log('Buttons:', JSON.stringify(info.buttons.slice(0, 15)))
console.log('\nCard elements:', JSON.stringify(info.cardEls.slice(0, 10), null, 2))
console.log('\nHand area snippet:', info.handHTML.substring(0, 200))

await page.screenshot({ path: '/tmp/ygo-inspect.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-inspect.png')
await browser.close()
process.exit(0)