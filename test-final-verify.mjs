import { chromium } from 'playwright'
const URL = 'https://ygo-yugi-destiny-production.up.railway.app'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const logs = []
let startTime = Date.now()

page.on('console', msg => {
  const t = Date.now() - startTime
  const text = msg.text()
  if (text.includes('HGE') || text.includes('ERR') || text.includes('HET') || text.includes('HEP')) {
    logs.push({ t, text: text.substring(0, 100) })
  }
})

await page.goto(URL)
await page.waitForTimeout(600)
await page.locator('button:has-text("Play vs Yugi")').click()
await page.waitForTimeout(200)
await page.locator('input').fill('Boss')
await page.locator('button:has-text("Start Duel")').click()
await page.waitForTimeout(4500)

async function ov() { return await page.evaluate(() => { const e = document.querySelector('.game-overlay'); return e ? e.innerText.trim() : '' }) }
async function btns() { return await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t)) }
async function field() { return await page.evaluate(() => ({ p: document.querySelectorAll('.player-field-area .card-selectable').length, o: document.querySelectorAll('.opponent-field-area .card-selectable').length, hand: document.querySelectorAll('.player-hand-area .card-selectable').length })) }
async function canAct() {
  return await page.evaluate(() => {
    const et = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('END TURN'))
    const ep = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('END PHASE'))
    return { et: et ? !et.disabled : false, ep: ep ? !ep.disabled : false }
  })
}

console.log('=== TEST: COMPLETE TURN FLOW ===')
const f0 = await field()
console.log('Initial: field=' + JSON.stringify(f0))

// Summon monster
const mcards = await page.locator('.player-hand-area .card-selectable').all()
let mc = null
for (const c of mcards) { const t = await c.innerText(); if (t.includes('ATK')) { mc = c; break } }
if (mc) {
  await mc.click(); await page.waitForTimeout(80); await mc.click()
  await page.waitForTimeout(300)
  await page.locator('button:has-text("SUMMON")').click()
  await page.waitForTimeout(600)
}
console.log('After summon:', JSON.stringify(await field()))

// Advance M1->BP
await page.locator('button:has-text("END PHASE")').click()
await page.waitForTimeout(600)
console.log('In BP:', (await ov()).substring(0, 40))

// Advance BP->M2->EP (don't end turn yet, just advance phases)
await page.locator('button:has-text("END PHASE")').click(); await page.waitForTimeout(400)
await page.locator('button:has-text("END PHASE")').click(); await page.waitForTimeout(400)

// Now END TURN - should cycle EP and trigger AI
console.log('\n=== CLICKING END TURN (Bug 2 & 3 test) ===')
const ca = await canAct()
console.log('Before ET: canAct=', JSON.stringify(ca))
await page.locator('button:has-text("END TURN")').click()
console.log('ET clicked - waiting for AI...')
await page.waitForTimeout(1000)

// Watch AI turn unfold
for (let i = 0; i < 20; i++) {
  const o = await ov()
  const act = await canAct()
  const f = await field()
  console.log('  [' + i + '] ov="' + o.substring(0, 35) + '" canAct=' + JSON.stringify(act) + ' field=' + JSON.stringify(f))
  
  if (o.includes('YOUR TURN')) {
    console.log('  *** PLAYER TURN RESUMED (Bug 2 FIXED) ***')
    break
  }
  
  if (act.et) {
    await page.locator('button:has-text("END TURN")').click()
    await page.waitForTimeout(2000)
  } else if (act.ep) {
    await page.locator('button:has-text("END PHASE")').click()
    await page.waitForTimeout(1500)
  } else {
    await page.waitForTimeout(2000)
  }
}

const finalOv = await ov()
const finalF = await field()
console.log('\nFinal overlay:', finalOv.substring(0, 60))
console.log('Final field:', JSON.stringify(finalF))
console.log('Final canAct:', JSON.stringify(await canAct()))

// Summon a new monster on new turn (Bug 1 test)
console.log('\n=== BUG 1: ATTACK IN BATTLE PHASE ===')
const newHand = await field()
console.log('Hand count:', newHand.hand)
if (newHand.hand > 0 && finalOv.includes('YOUR TURN')) {
  // Summon
  const nc = await page.locator('.player-hand-area .card-selectable').all()
  let nmc = null
  for (const c of nc) { const t = await c.innerText(); if (t.includes('ATK')) { nmc = c; break } }
  if (nmc) {
    await nmc.click(); await page.waitForTimeout(80); await nmc.click()
    await page.waitForTimeout(300)
    const sumBtn = await page.locator('button:has-text("SUMMON")').isEnabled().catch(() => false)
    if (sumBtn) {
      await page.locator('button:has-text("SUMMON")').click()
      await page.waitForTimeout(600)
      console.log('Summoned on new turn. Field:', JSON.stringify(await field()))
    }
  }
  
  // Advance to BP
  await page.locator('button:has-text("END PHASE")').click(); await page.waitForTimeout(500)
  console.log('In BP. Overlay:', (await ov()).substring(0, 50))
  
  const fBattle = await field()
  console.log('Battle Phase field:', JSON.stringify(fBattle))
  
  // Try to attack
  if (fBattle.p > 0) {
    console.log('Attempting attack...')
    const pm = await page.locator('.player-field-area .card-selectable').all()
    await pm[0].click(); await page.waitForTimeout(80); await pm[0].click()
    await page.waitForTimeout(500)
    
    const attackOv = await ov()
    console.log('After monster select: ov="' + attackOv.substring(0, 60) + '"')
    
    // Try clicking opponent field to attack directly
    if (fBattle.o === 0) {
      const oppBox = await page.locator('.opponent-field-area').boundingBox()
      if (oppBox) {
        console.log('No opp monsters - clicking opponent field for direct attack')
        await page.mouse.click(oppBox.x + oppBox.width/2, oppBox.y + oppBox.height/2)
        await page.waitForTimeout(600)
        const afterOv = await ov()
        console.log('After direct attack click: ov="' + afterOv.substring(0, 60) + '"')
      }
    }
  }
}

console.log('\n=== LOGS ===')
logs.forEach(l => console.log('  [' + l.t + 'ms]', l.text))

await page.screenshot({ path: '/tmp/ygo-final-verify.png', fullPage: true })
console.log('\nScreenshot: /tmp/ygo-final-verify.png')
await browser.close()
process.exit(0)