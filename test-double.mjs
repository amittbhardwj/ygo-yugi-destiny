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

console.log('=== SUMMONING (DOUBLE CLICK) ===')
const cardCount = await page.locator('.player-hand-area .card-selectable').count()
console.log('Hand cards:', cardCount)

if (cardCount > 0) {
  // DOUBLE CLICK to open summon modal
  await page.locator('.player-hand-area .card-selectable').first().dblclick()
  await page.waitForTimeout(400)
  
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
  console.log('Buttons after double-click:', JSON.stringify(buttons.slice(0, 15)))
  
  const hasSummon = buttons.some(b => b.includes('SUMMON'))
  if (hasSummon) {
    await page.locator('button:has-text("SUMMON")').click()
    await page.waitForTimeout(500)
    console.log('Summoned!')
    
    const overlay = await getOverlay()
    console.log('Overlay:', overlay.substring(0, 50))
    
    // Advance to Battle Phase
    console.log('\n=== ADVANCING TO BATTLE ===')
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(600)
    
    const bpOverlay = await getOverlay()
    const bpPhase = await page.evaluate(() => document.body.innerText.match(/DP|SP|M1|BP|M2|EP|END/)?.[0] || '')
    console.log('After M1->BP: overlay="' + bpOverlay.substring(0, 40) + '" phase="' + bpPhase + '"')
    
    // Check field
    const fieldInfo = await page.evaluate(() => ({
      playerMonsters: document.querySelectorAll('.player-field-area .card-selectable').length,
      oppMonsters: document.querySelectorAll('.opponent-field-area .card-selectable').length
    }))
    console.log('Field - player:', fieldInfo.playerMonsters, 'opp:', fieldInfo.oppMonsters)
    
    // ATTEMPT ATTACK - select player monster
    if (fieldInfo.playerMonsters > 0) {
      console.log('\n=== ATTACKING (DOUBLE CLICK) ===')
      
      // Double click player monster to select it
      await page.locator('.player-field-area .card-selectable').first().dblclick()
      await page.waitForTimeout(400)
      
      const afterSelect = await page.evaluate(() => ({
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t),
        overlay: (document.querySelector('.game-overlay') || {}).innerText || ''
      }))
      console.log('After monster select - buttons:', JSON.stringify(afterSelect.buttons.slice(0, 15)))
      console.log('Overlay:', afterSelect.overlay.substring(0, 50))
      
      // Click opponent monster as target
      if (fieldInfo.oppMonsters > 0) {
        console.log('Clicking opponent monster...')
        await page.locator('.opponent-field-area .card-selectable').first().click()
        await page.waitForTimeout(500)
        
        const afterAttack = await getOverlay()
        console.log('After attack target click:', afterAttack.substring(0, 50))
      }
    }
    
    // Now end turn and test AI
    console.log('\n=== END TURN ===')
    for (let i = 0; i < 12; i++) {
      const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
      const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
      const overlay = await getOverlay()
      console.log('  [' + i + '] EP=' + ep + ' ET=' + et + ' ov="' + overlay.substring(0, 30) + '"')
      
      if (et) {
        await page.locator('button:has-text("END TURN")').click()
        await page.waitForTimeout(2000)
      } else if (ep) {
        await page.locator('button:has-text("END PHASE")').click()
        await page.waitForTimeout(1500)
      } else {
        await page.waitForTimeout(2000)
      }
      
      if (overlay.includes('YOUR TURN')) {
        console.log('  -> AI finished, player turn!')
        break
      }
    }
    
    console.log('\nFinal overlay:', await getOverlay().substring(0, 50))
  }
}

await page.screenshot({ path: '/tmp/ygo-double.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-double.png')
await browser.close()
process.exit(0)