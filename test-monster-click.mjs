import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    if (msg.text().includes('handleMonsterClick') || msg.text().includes('[PB] render')) {
      console.log('[CONSOLE]', msg.text());
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(22000);
  
  // Summon via double-click
  console.log('\n=== SUMMONING ===');
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  
  const hasSummon = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
  });
  console.log('Has SUMMON button:', hasSummon);
  
  if (hasSummon) {
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Go to BP
  console.log('\n=== GOING TO BP ===');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Find player monster and click it
  console.log('\n=== CLICKING PLAYER MONSTER ===');
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
        result.push({ text: text.replace(/\s+/g,' ').trim().slice(0,40), y: Math.round(rect.top), cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2) });
      }
    }
    return result;
  });
  console.log('Player field monsters:', JSON.stringify(playerMonsters));
  
  if (playerMonsters.length > 0) {
    console.log('Clicking monster via locator...');
    const monsterText = playerMonsters[0].text.split('ATK')[0].trim();
    await page.locator('div.relative').filter({ hasText: new RegExp(monsterText) }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
      return { count: highlighted.length };
    });
    console.log('Selection state:', JSON.stringify(state));
  }
  
  await browser.close();
}

run().catch(console.error);