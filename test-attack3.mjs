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

console.log('=== CLICKING CARD IN PLAYER HAND ===')
// Use correct selector: .card-selectable inside .player-hand-area
const cardCount = await page.locator('.player-hand-area .card-selectable').count()
console.log('Player hand cards:', cardCount)

if (cardCount > 0) {
  console.log('Clicking first card...')
  await page.locator('.player-hand-area .card-selectable').first().click()
  await page.waitForTimeout(500)
  
  // Check for modal
  const modalText = await page.evaluate(() => {
    const modal = document.querySelector('.modal, [role="dialog"], [class*="dialog"], .card-detail-panel')
    return modal ? modal.innerText.substring(0, 200) : 'no modal'
  })
  console.log('Modal content:', modalText)
  
  // Check all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
  })
  console.log('All buttons:', JSON.stringify(buttons.slice(0, 15)))
  
  // If modal has Summon button, click it
  const hasSummon = buttons.some(b => b.includes('Summon'))
  if (hasSummon) {
    console.log('\nClicking Summon...')
    await page.locator('button:has-text("Summon")').first().click()
    await page.waitForTimeout(500)
    
    // Check game state after summon
    const afterInfo = await page.evaluate(() => {
      const playerMonsters = document.querySelectorAll('.player-field-area .card-selectable, .player-field-area .card-wrapper')
      const overlay = document.querySelector('.game-overlay')
      const overlayText = overlay ? overlay.innerText : ''
      return {
        playerMonsters: playerMonsters.length,
        overlay: overlayText.substring(0, 50)
      }
    })
    console.log('After summon - player monsters:', afterInfo.playerMonsters, 'overlay:', afterInfo.overlay)
    
    // Advance through phases to Battle Phase
    console.log('\n=== ADVANCING TO BATTLE ===')
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(600)
    
    const bpInfo = await page.evaluate(() => {
      const overlay = document.querySelector('.game-overlay')
      return overlay ? overlay.innerText.substring(0, 60) : ''
    })
    console.log('After EP (M1->BP):', bpInfo)
    
    // Now check field and try to attack
    const attackInfo = await page.evaluate(() => {
      const playerMonsters = document.querySelectorAll('.player-field-area .card-selectable, .player-field-area .card-wrapper')
      const oppMonsters = document.querySelectorAll('.opponent-field-area .card-selectable, .opponent-field-area .card-wrapper')
      const overlay = document.querySelector('.game-overlay')
      return {
        playerMonsters: playerMonsters.length,
        oppMonsters: oppMonsters.length,
        overlay: overlay ? overlay.innerText.substring(0, 60) : ''
      }
    })
    console.log('Field - player:', attackInfo.playerMonsters, 'opp:', attackInfo.oppMonsters)
    console.log('Overlay:', attackInfo.overlay)
    
    // Try clicking player monster
    if (attackInfo.playerMonsters > 0) {
      console.log('\n=== ATTEMPTING ATTACK ===')
      await page.locator('.player-field-area .card-selectable, .player-field-area .card-wrapper').first().click()
      await page.waitForTimeout(400)
      
      const afterSelect = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)
        const overlay = document.querySelector('.game-overlay')
        return {
          buttons: buttons.slice(0, 15),
          overlay: overlay ? overlay.innerText.substring(0, 60) : ''
        }
      })
      console.log('After selecting monster - buttons:', JSON.stringify(afterSelect.buttons))
      console.log('Overlay:', afterSelect.overlay)
      
      // Try clicking opponent monster if exists
      if (attackInfo.oppMonsters > 0) {
        console.log('Clicking opponent monster as attack target...')
        await page.locator('.opponent-field-area .card-selectable, .opponent-field-area .card-wrapper').first().click()
        await page.waitForTimeout(500)
        
        const afterAttack = await page.evaluate(() => {
          const overlay = document.querySelector('.game-overlay')
          return overlay ? overlay.innerText.substring(0, 60) : ''
        })
        console.log('After attack click - overlay:', afterAttack)
      }
    }
    
    // End turn and check AI behavior
    console.log('\n=== END TURN ===')
    for (let i = 0; i < 8; i++) {
      const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
      const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
      const overlay = await page.evaluate(() => { const el = document.querySelector('.game-overlay'); return el ? el.innerText.substring(0, 40) : '' })
      console.log('  [' + i + '] EP=' + ep + ' ET=' + et + ' ov="' + overlay + '"')
      
      if (et) {
        await page.locator('button:has-text("END TURN")').click()
        await page.waitForTimeout(2000)
      } else if (ep) {
        await page.locator('button:has-text("END PHASE")').click()
        await page.waitForTimeout(1500)
      } else {
        await page.waitForTimeout(2000)
      }
      
      if (overlay.includes('YOUR TURN')) break
    }
    
    const finalInfo = await page.evaluate(() => {
      const overlay = document.querySelector('.game-overlay')
      return overlay ? overlay.innerText.substring(0, 60) : ''
    })
    console.log('\nFinal overlay:', finalInfo)
  }
}

await page.screenshot({ path: '/tmp/ygo-attack3.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-attack3.png')
await browser.close()
process.exit(0)