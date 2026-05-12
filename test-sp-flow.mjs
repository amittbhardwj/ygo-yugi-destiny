import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

await page.goto('https://ygo-yugi-destiny-production.up.railway.app')
await page.waitForTimeout(1000)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(400)
await page.locator('input').fill('Test')
await page.locator('button:has-text("Start Duel")').click()

for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(1500)
  const body = await page.locator('body').innerText()
  const phaseEl = await page.locator('.phase-display, .phase-title, [class*=phase]').first().innerText().catch(() => '')
  const overlay = await page.locator('[class*=overlay]').first().innerText().catch(() => '')
  const isOurTurn = body.includes('YOUR TURN')
  const isOppTurn = body.includes("OPPONENT'S TURN")
  const endPhaseEnabled = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
  const endTurnEnabled = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
  
  console.log(`[${(i*1.5).toFixed(1)}s] phase="${phaseEl.trim()}" | OUR=${isOurTurn} | OPP=${isOppTurn} | EP=${endPhaseEnabled} | ET=${endTurnEnabled} | overlay="${overlay.trim().substring(0,40)}"`)
  
  // Auto-click End Phase if available and we're past Draw
  if (endPhaseEnabled && (phaseEl.trim() === 'Standby' || phaseEl.trim() === 'Main 1' || phaseEl.trim() === 'Main 2' || phaseEl.trim() === 'Battle')) {
    console.log('  -> clicking END PHASE')
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(300)
  }
  
  if (phaseEl.trim() === 'End' && endTurnEnabled) {
    console.log('  -> clicking END TURN')
    await page.locator('button:has-text("END TURN")').click()
  }
  
  // Stop after End Phase (player's turn should come)
  if (phaseEl.trim() === 'End' && isOurTurn) {
    console.log('  -> Player turn reached after End Phase!')
    break
  }
}

await browser.close()
process.exit(0)