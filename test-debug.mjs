import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []

page.on('console', msg => {
  if (msg.type() === 'error') logs.push('[ERR] ' + msg.text().substring(0, 150))
  if (msg.type() === 'log' && msg.text().includes('HGE')) logs.push('[LOG] ' + msg.text().substring(0, 120))
})

await page.goto(URL)
await page.waitForTimeout(800)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(300)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4000)

async function getState() {
  return await page.evaluate(() => {
    const body = document.body.innerText
    const overlayEl = document.querySelector('.game-overlay')
    const overlayText = overlayEl ? overlayEl.innerText : ''
    const buttons = Array.from(document.querySelectorAll('button'))
    const epBtn = buttons.find(b => b.textContent.includes('END PHASE'))
    const etBtn = buttons.find(b => b.textContent.includes('END TURN'))
    return {
      body: body.substring(0, 200),
      overlayText,
      epEnabled: epBtn ? !epBtn.disabled : false,
      etEnabled: etBtn ? !etBtn.disabled : false,
    }
  })
}

console.log('=== INITIAL STATE ===')
let state = await getState()
console.log('  body:', state.body.substring(0, 100))
console.log('  overlay:', state.overlayText.substring(0, 60))
console.log('  EP enabled:', state.epEnabled, '| ET enabled:', state.etEnabled)

// Advance: M1 -> BP
console.log('\n=== M1 -> BP ===')
const ep1 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
console.log('EP enabled:', ep1)
if (ep1) {
  await page.locator('button:has-text("END PHASE")').click()
  await page.waitForTimeout(500)
}
state = await getState()
console.log('  overlay:', state.overlayText.substring(0, 60))
console.log('  EP:', state.epEnabled, 'ET:', state.etEnabled)

// Check attack targets in BP
console.log('\n=== BATTLE PHASE ATTACK ===')
const battle = state.overlayText.includes('Battle') || state.body.includes('Battle')
console.log('In Battle phase:', battle)

// Check if monsters on field are clickable
const playerMonsterCount = await page.locator('.player-field-area .card-wrapper').count()
const oppMonsterCount = await page.locator('.opponent-field-area .card-wrapper').count()
console.log('Player monsters:', playerMonsterCount, '| Opp monsters:', oppMonsterCount)

// Try to select a player monster
if (playerMonsterCount > 0) {
  console.log('  -> clicking player monster')
  await page.locator('.player-field-area .card-wrapper').first().click()
  await page.waitForTimeout(300)
  state = await getState()
  console.log('  after monster click - overlay:', state.overlayText.substring(0, 60))
  console.log('  EP:', state.epEnabled, 'ET:', state.etEnabled)
}

// Advance to M2 -> EP -> End Turn
console.log('\n=== ADVANCING TO END TURN ===')
const ep2 = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
console.log('EP enabled (M2 or BP):', ep2)
if (ep2) {
  await page.locator('button:has-text("END PHASE")').click()
  await page.waitForTimeout(500)
}

const et1 = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
console.log('ET enabled:', et1)
if (et1) {
  console.log('  -> clicking END TURN')
  await page.locator('button:has-text("END TURN")').click()
  await page.waitForTimeout(6000)
}

state = await getState()
console.log('\n=== AFTER END TURN ===')
console.log('  overlay:', state.overlayText.substring(0, 60))
console.log('  EP:', state.epEnabled, 'ET:', state.etEnabled)
console.log('  body:', state.body.substring(0, 80))

// Try cycling End Turn button
console.log('\n=== CYCLING END TURN ===')
for (let i = 0; i < 8; i++) {
  const et = await page.locator('button:has-text("END TURN")').isEnabled().catch(() => false)
  const ep = await page.locator('button:has-text("END PHASE")').isEnabled().catch(() => false)
  state = await getState()
  console.log('  [' + i + '] overlay="' + state.overlayText.trim().substring(0, 40) + '" EP=' + ep + ' ET=' + et)
  if (et) {
    await page.locator('button:has-text("END TURN")').click()
    await page.waitForTimeout(2000)
  } else if (ep) {
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(1000)
  } else {
    await page.waitForTimeout(2000)
  }
}

console.log('\n=== LOGS ===')
logs.forEach(l => console.log(' ', l))
await page.screenshot({ path: '/tmp/ygo-debug.png', fullPage: true })
console.log('  Screenshot: /tmp/ygo-debug.png')
await browser.close()
process.exit(0)
