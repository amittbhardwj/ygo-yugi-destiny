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
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(20000);
  
  // Go to M1
  console.log('In SP, waiting...');
  await page.waitForTimeout(3000);
  
  // Summon a monster via double-click
  console.log('Double-clicking to summon...');
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  
  // Check if modal appeared
  const hasSummon = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
  });
  console.log('Has SUMMON button:', hasSummon);
  
  if (hasSummon) {
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Go to BP
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Check phase
  const inBP = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.trim() === 'BP');
    return bp ? !bp.disabled : false;
  });
  console.log('In BP:', inBP);
  
  // Now try to click player field monster - use Playwright's click which goes through proper event routing
  console.log('\nTrying to select monster for attack...');
  
  // Find player monster (should be on field now, y < 750)
  const playerMonsters = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 750 && rect.top > 500) {
        result.push({ text: text.replace(/\s+/g,' ').trim().slice(0,40), y: Math.round(rect.top) });
      }
    }
    return result;
  });
  console.log('Player field monsters:', JSON.stringify(playerMonsters));
  
  if (playerMonsters.length > 0) {
    console.log('Clicking monster via Playwright...');
    // Use locator to click with full event handling
    const monsterText = playerMonsters[0].text.split('ATK')[0].trim();
    await page.locator('div.relative').filter({ hasText: new RegExp(monsterText) }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
      return { count: highlighted.length };
    });
    console.log('Selection state:', JSON.stringify(state));
  }
  
  // Check LP
  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
    return { yugiLP: yugiLP ? yugiLP[1] : 'N/A' };
  });
  console.log('Yugi LP:', result.yugiLP);
  
  await browser.close();
}

run().catch(console.error);