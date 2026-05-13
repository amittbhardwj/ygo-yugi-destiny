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
  
  // Monkey-patch the React event system to log all click handlers
  await page.evaluate(() => {
    // Find React's onClick handlers by looking at fiber
    const originalDispatch = document.dispatchEvent;
    
    // Listen for clicks on the specific card element
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    cards.forEach(c => {
      const text = c.textContent || '';
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
        // Check for React fiber
        const fiberKey = Object.keys(c).find(k => k.startsWith('__reactFiber'));
        if (fiberKey) {
          console.log('[CARD FIBER FOUND]', text.trim().slice(0,30), 'fiber:', fiberKey);
          const fiber = c[fiberKey];
          console.log('[FIBER]', JSON.stringify({
            tag: fiber.tag,
            type: fiber.elementType?.name || fiber.type,
            key: fiber.key,
            stateNode: fiber.stateNode?.constructor?.name
          }));
        }
      }
    });
  });
  
  // Get monster positions
  const monsterPositions = await page.evaluate(() => {
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    const result = [];
    cards.forEach(c => {
      const text = c.textContent || '';
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
        const rect = c.getBoundingClientRect();
        result.push({
          text: text.trim().slice(0, 40),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2)
        });
      }
    });
    return result;
  });
  
  console.log('Monster positions:', JSON.stringify(monsterPositions));
  
  if (monsterPositions.length > 0) {
    const monster = monsterPositions[0];
    
    // Try clicking with pointer events to ensure it goes through
    console.log(`\n=== Clicking with pointer events at [${monster.cx}, ${monster.cy}] ===`);
    
    await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.x, pos.y);
      if (el) {
        console.log('[ELEMENT]', el.tagName, el.className.split(' ')[0]);
        
        // Try pointer events
        const enterEvent = new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          view: window,
          pointerId: 1,
          isPrimary: true
        });
        el.dispatchEvent(enterEvent);
        
        const upEvent = new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          view: window,
          pointerId: 1,
          isPrimary: true
        });
        el.dispatchEvent(upEvent);
        
        // Finally click
        el.click();
      }
    }, { x: monster.cx, y: monster.cy });
    
    await page.waitForTimeout(2000);
    
    const state = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"]');
      return { count: selected.length };
    });
    console.log('State after pointer events:', JSON.stringify(state));
  }
  
  // Check the game state from socket events
  console.log('\n=== Checking if attack was emitted ===');
  
  // Wait and then check
  await page.waitForTimeout(1000);
  
  const gameText = await page.evaluate(() => document.body.innerText);
  const yugiLP = gameText.match(/Yugi.*?(\d+)\s+LP/);
  const bossLP = gameText.match(/BOSS.*?(\d+)\s+LP/);
  console.log('Yugi LP:', yugiLP ? yugiLP[1] : 'not found');
  console.log('Boss LP:', bossLP ? bossLP[1] : 'not found');
  
  await browser.close();
}

run().catch(console.error);