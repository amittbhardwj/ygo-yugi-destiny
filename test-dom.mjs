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

// Get detailed DOM structure of player hand
const handDOM = await page.evaluate(() => {
  const handArea = document.querySelector('.player-hand-area')
  if (!handArea) return 'no player hand area'
  
  // Get all children with their classes and bounding rects
  const children = Array.from(handArea.children).map(child => ({
    tag: child.tagName,
    class: child.className.substring(0, 80),
    text: child.innerText.substring(0, 50),
    rect: (() => {
      const r = child.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })(),
    children: Array.from(child.children).slice(0, 3).map(gc => ({
      tag: gc.tagName,
      class: gc.className.substring(0, 60),
      text: gc.innerText.substring(0, 30)
    }))
  }))
  
  return { html: handArea.innerHTML.substring(0, 800), children }
})

console.log('Hand area HTML:', handDOM.html)
console.log('\nChildren:')
handDOM.children.forEach((c, i) => {
  console.log('  [' + i + ']', c.tag, 'class="' + c.class + '"', 'text="' + c.text + '"', 'rect=', JSON.stringify(c.rect))
  c.children.forEach((gc, j) => {
    console.log('    [' + j + ']', gc.tag, 'class="' + gc.class + '"', 'text="' + gc.text + '"')
  })
})

await page.screenshot({ path: '/tmp/ygo-dom.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-dom.png')
await browser.close()
process.exit(0)