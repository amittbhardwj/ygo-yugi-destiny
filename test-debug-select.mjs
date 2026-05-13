import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('handleMonsterClick') || text.includes('handleSelectMonster') || text.includes('handleAttackTarget') || text.includes('SELECT_MONSTER') || text.includes('SET_ATTACK')) {
      console.log('[LOG]', text);
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(25000);
  
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
  
  console.log('\n=== IN BP, CLICKING PLAYER MONSTER ===');
  
  // Get positions
  const positions = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const playerMons = [];
    
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/★+.*ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top > 500 && rect.top < 750) {
        playerMons.push({
          text: text.replace(/\s+/g,' ').trim().slice(0, 30),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2)
        });
      }
    }
    return playerMons;
  });
  
  console.log('Player monsters:', JSON.stringify(positions));
  
  if (positions.length > 0) {
    const pm = positions[0];
    console.log(`Clicking at [${pm.cx}, ${pm.cy}]: "${pm.text}"`);
    await page.mouse.click(pm.cx, pm.cy, { force: true });
    await page.waitForTimeout(3000);
    
    const state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"]');
      return { count: highlighted.length };
    });
    console.log('Selection state:', JSON.stringify(state));
  }
  
  await browser.close();
}

run().catch(console.error);