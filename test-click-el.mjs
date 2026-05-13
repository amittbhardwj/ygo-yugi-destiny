import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
    if (msg.text().includes('handleMonsterClick')) {
      console.log('[HMC]', msg.text());
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
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  
  const hasSummon = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
  });
  console.log('Has SUMMON:', hasSummon);
  
  if (hasSummon) {
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Go to BP
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Get field monster positions - find the OUTER div with cursor-pointer
  const monsterElements = await page.evaluate(() => {
    const result = [];
    // Find the player field area - it has player monsters
    const all = document.querySelectorAll('.player-field-area, [class*="player-field"]');
    const fieldArea = all[0];
    
    if (fieldArea) {
      const cards = fieldArea.querySelectorAll('div.relative');
      cards.forEach((el, i) => {
        const text = el.textContent || '';
        if (text.match(/ATK.*DEF/) && text.match(/★+/)) {
          const rect = el.getBoundingClientRect();
          result.push({
            index: i,
            text: text.replace(/\s+/g,' ').trim().slice(0, 40),
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          });
        }
      });
    }
    return result;
  });
  console.log('Monster elements in player field:', JSON.stringify(monsterElements));
  
  // Try clicking directly on the element
  if (monsterElements.length > 0) {
    const el = monsterElements[0];
    console.log(`\nClicking at [${el.x + el.w/2}, ${el.y + el.h/2}] using page.mouse.click with force`);
    
    // Use page.mouse.click with force to bypass interception checks
    await page.mouse.click(el.x + el.w/2, el.y + el.h/2, { force: true });
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
      return { count: highlighted.length };
    });
    console.log('Selection state:', JSON.stringify(state));
    
    // If no selection, try calling click() on the element directly via evaluate
    if (state.count === 0) {
      console.log('\nTrying element.click() via evaluate...');
      await page.evaluate((elData) => {
        // Find the exact element
        const all = document.querySelectorAll('div.relative');
        for (const el of all) {
          const text = el.textContent || '';
          if (text.match(/★+.*ATK.*DEF/) && text.match(elData.text.slice(0, 10))) {
            const rect = el.getBoundingClientRect();
            if (Math.abs(rect.left - elData.x) < 5 && Math.abs(rect.top - elData.y) < 5) {
              console.log('[EVAL] Found element, calling click()');
              el.click();
              return;
            }
          }
        }
      }, el);
      await page.waitForTimeout(2000);
      
      const state2 = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return { count: highlighted.length };
      });
      console.log('State after element.click():', JSON.stringify(state2));
    }
  }
  
  // Check console for handleMonsterClick logs
  console.log('\n=== handleMonsterClick logs ===');
  logs.filter(l => l.includes('handleMonsterClick')).forEach(l => console.log(l));
  
  await browser.close();
}

run().catch(console.error);