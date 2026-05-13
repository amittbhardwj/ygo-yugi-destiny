import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => console.log('[CONSOLE]', msg.text()));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('=== TURN 1: Waiting for AI ===');
  await page.waitForTimeout(18000);
  
  // Step 1: Summon monster from hand
  console.log('\n=== STEP 1: SUMMON ===');
  const cardPos = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 780 || rect.width < 70 || rect.height < 100) continue;
      if (!text.match(/★+/)) continue;
      
      return { cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2), text: text.replace(/\s+/g,' ').trim().slice(0, 40) };
    }
    return null;
  });
  
  if (cardPos) {
    const locator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
    await locator.dblclick({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Check field monsters
  const fieldMons = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top >= 500 && rect.top < 750) {
        result.push({ text: text.replace(/\s+/g,' ').trim().slice(0, 40), cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2) });
      }
    }
    return result;
  });
  console.log('Field monsters:', JSON.stringify(fieldMons));
  
  if (fieldMons.length > 0) {
    // Step 2: Go to Battle Phase (END PHASE once from M1)
    console.log('\n=== STEP 2: GO TO BP ===');
    await page.click('button:has-text("END PHASE")');
    await page.waitForTimeout(2000);
    
    const phase = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bp = btns.find(b => b.textContent.trim() === 'BP');
      return bp ? bp.className.includes('phase-active') : false;
    });
    console.log('In BP:', phase);
    
    // Step 3: Select player monster for attack
    console.log('\n=== STEP 3: SELECT MONSTER FOR ATTACK ===');
    const fm = fieldMons[0];
    console.log(`Clicking monster at [${fm.cx}, ${fm.cy}]: "${fm.text}"`);
    
    // Use locator click which properly dispatches events through React
    const monsterLocator = page.locator('div.relative').filter({ hasText: /★.*ATK.*DEF/ }).first();
    await monsterLocator.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    
    const attackState = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
      return { count: highlighted.length, texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50)) };
    });
    console.log('Attack state:', JSON.stringify(attackState));
    
    if (attackState.count > 0) {
      // Step 4: Attack opponent monster (click on opponent field area)
      console.log('\n=== STEP 4: ATTACK ===');
      await page.mouse.click(400, 200, { force: true });
      await page.waitForTimeout(2000);
      
      const result = await page.evaluate(() => {
        const text = document.body.innerText;
        const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
        const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
        return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', bossLP: bossLP ? bossLP[1] : 'N/A' };
      });
      console.log('LP after attack:', JSON.stringify(result));
      
      if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
        console.log('\n🎉 ATTACK SUCCESSFUL! LP reduced!');
      }
    } else {
      console.log('Monster not selected - checking if in correct phase...');
      
      // Check current phase from socket events
      const stateCheck = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const activeBtns = btns.filter(b => b.className.includes('phase-active'));
        return activeBtns.map(b => b.textContent.trim());
      });
      console.log('Active phase buttons:', JSON.stringify(stateCheck));
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);