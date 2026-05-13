import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    if (msg.text().includes('handleMonsterClick') || msg.text().includes('handleAttackTarget') || msg.text().includes('handleSelectMonster')) {
      console.log('[LOG]', msg.text());
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(22000);
  
  // Summon
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  
  const hasSummon = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
  });
  if (hasSummon) {
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Go to BP
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  console.log('\n=== IN BP ===');
  
  // Find player and opponent monster positions
  const positions = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const playerMons = [];
    const oppMons = [];
    
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/★+.*ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 400 && rect.top > 250) {
        // Opponent field (upper area)
        oppMons.push({
          text: text.replace(/\s+/g,' ').trim().slice(0, 30),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2)
        });
      } else if (rect.top > 500 && rect.top < 750) {
        // Player field (lower area)
        playerMons.push({
          text: text.replace(/\s+/g,' ').trim().slice(0, 30),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2)
        });
      }
    }
    return { playerMons, oppMons };
  });
  
  console.log('Player monsters:', JSON.stringify(positions.playerMons));
  console.log('Opponent monsters:', JSON.stringify(positions.oppMons));
  
  if (positions.playerMons.length > 0 && positions.oppMons.length > 0) {
    // Click player monster to select it
    console.log('\n=== STEP 1: SELECT PLAYER MONSTER ===');
    const pm = positions.playerMons[0];
    await page.mouse.click(pm.cx, pm.cy, { force: true });
    await page.waitForTimeout(1500);
    
    let state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"]');
      return { count: highlighted.length };
    });
    console.log('After selecting player monster:', JSON.stringify(state));
    
    // Now click opponent monster to attack
    console.log('\n=== STEP 2: ATTACK OPPONENT MONSTER ===');
    const om = positions.oppMons[0];
    await page.mouse.click(om.cx, om.cy, { force: true });
    await page.waitForTimeout(2000);
    
    state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
      return { count: highlighted.length };
    });
    console.log('After clicking opponent monster:', JSON.stringify(state));
    
    // Check LP
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
      const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
      return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', bossLP: bossLP ? bossLP[1] : 'N/A' };
    });
    console.log('LP:', JSON.stringify(result));
    
    if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
      console.log('\n🎉 ATTACK WORKED! Yugi LP decreased from 4000 to', result.yugiLP);
    }
  } else {
    console.log('Could not find both player and opponent monsters');
  }
  
  await browser.close();
}

run().catch(console.error);