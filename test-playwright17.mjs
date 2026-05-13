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
  
  // Get monster positions and try Playwright's click
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
          cy: Math.round(rect.top + rect.height/2),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        });
      }
    });
    return result;
  });
  
  console.log('Monster positions:', JSON.stringify(monsterPositions));
  
  if (monsterPositions.length > 0) {
    const monster = monsterPositions[0];
    
    // Try Playwright's mouse.click which properly dispatches events through the DOM
    console.log(`\n=== Playwright mouse.click at [${monster.cx}, ${monster.cy}] ===`);
    await page.mouse.click(monster.cx, monster.cy);
    await page.waitForTimeout(2000);
    
    const state1 = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"]');
      return { count: selected.length, texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50)) };
    });
    console.log('State after mouse.click:', JSON.stringify(state1));
    
    // If that didn't work, try page.locator click which is even more native-like
    if (state1.count === 0) {
      console.log('\n=== Trying with page.locator ===');
      
      // Use evaluate to get the exact selector for the monster element
      const selector = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.relative.cursor-pointer');
        for (const c of cards) {
          const text = c.textContent || '';
          if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
            // Return CSS selector path
            const parts = [];
            let el = c;
            while (el && el.tagName !== 'BODY') {
              let selector = el.tagName;
              if (el.id) selector += '#' + el.id;
              if (el.className) {
                const classes = el.className.split(' ').filter(Boolean);
                if (classes.length > 0) selector += '.' + classes[0];
              }
              parts.unshift(selector);
              el = el.parentElement;
            }
            return parts.join(' > ');
          }
        }
        return null;
      });
      
      console.log('Monster selector:', selector);
      
      if (selector) {
        try {
          await page.locator(selector.split(' > ')[0]).first().click({ timeout: 5000 });
          await page.waitForTimeout(2000);
          
          const state2 = await page.evaluate(() => {
            const selected = document.querySelectorAll('[class*="selected"], [class*="ring"]');
            return { count: selected.length };
          });
          console.log('State after locator.click:', JSON.stringify(state2));
        } catch (e) {
          console.log('Locator click failed:', e.message);
        }
      }
    }
    
    // Try direct JavaScript click using React's synthetic event system
    console.log('\n=== Trying React event simulation ===');
    await page.evaluate((mon) => {
      // Find the element
      const cards = document.querySelectorAll('div.relative.cursor-pointer');
      for (const c of cards) {
        const text = c.textContent || '';
        if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
          const rect = c.getBoundingClientRect();
          if (Math.abs(rect.left - mon.x) < 5 && Math.abs(rect.top - mon.y) < 5) {
            // Simulate React's onClick using React's event delegation
            const event = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            // Try native click first
            c.dispatchEvent(event);
            
            // Also try calling the React event handler directly if available
            const reactFiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber'))];
            if (reactFiber) {
              console.log('Found React fiber');
            }
            break;
          }
        }
      }
    }, monster);
    
    await page.waitForTimeout(2000);
    
    const state3 = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"]');
      return { count: selected.length };
    });
    console.log('State after React simulation:', JSON.stringify(state3));
  }
  
  await browser.close();
}

run().catch(console.error);