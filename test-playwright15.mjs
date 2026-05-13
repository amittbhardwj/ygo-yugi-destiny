import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[CONSOLE]', msg.text()));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(15000);
  
  // Advance to BP
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(3000);
  
  // Get all monster positions first
  const monsterPositions = await page.evaluate(() => {
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    return Array.from(cards)
      .filter(c => {
        const text = c.textContent || '';
        return text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80;
      })
      .map(c => {
        const rect = c.getBoundingClientRect();
        return {
          text: c.textContent.replace(/\s+/g,' ').trim().slice(0,40),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        };
      });
  });
  
  console.log('Monster positions:', JSON.stringify(monsterPositions));
  
  if (monsterPositions.length > 0) {
    const monster = monsterPositions[0];
    console.log(`\n=== Using page.click() at [${monster.cx}, ${monster.cy}] ===`);
    
    // Use page.click with exact position - this is Playwright's native click
    await page.click(`div.relative.cursor-pointer:has-text("ATK")`, {
      position: { x: Math.round(monster.cx - monster.cx + 40), y: Math.round(monster.cy - monster.cy + 56) },
      timeout: 5000
    });
    
    await page.waitForTimeout(2000);
    
    // Check state
    const state = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"], [class*="pulse"]');
      return {
        count: selected.length,
        texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('Selected state:', JSON.stringify(state));
    
    // Try with direct selector on exact element
    console.log('\n=== Trying page.click on selector ===');
    
    // Find all divs that contain monster text
    const selector = `div:text-matches("/^\\s*[*]*\\s*ATK\\s*\\d+\\s*DEF\\s*\\d+\\s*$/")`;
    const count = await page.locator(`div.relative.cursor-pointer`).filter({ hasText: /ATK \d+ DEF \d+/ }).count();
    console.log('Monster divs found via locator:', count);
    
    if (count > 0) {
      const firstMonster = page.locator(`div.relative.cursor-pointer`).filter({ hasText: /ATK \d+ DEF \d+/ }).first();
      const box = await firstMonster.boundingBox();
      console.log('First monster bounding box:', box);
      
      if (box) {
        console.log(`Clicking at [${box.x + box.width/2}, ${box.y + box.height/2}]`);
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { force: true });
        await page.waitForTimeout(2000);
        
        const state2 = await page.evaluate(() => {
          const selected = document.querySelectorAll('[class*="selected"], [class*="ring"]');
          return {
            count: selected.length,
            texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
          };
        });
        console.log('State after force click:', JSON.stringify(state2));
      }
    }
  }
  
  await browser.close();
}

run().catch(console.error);