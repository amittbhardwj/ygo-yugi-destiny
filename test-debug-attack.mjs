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
  
  // Summon a monster
  console.log('\n=== SUMMONING ===');
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("SUMMON")');
  await page.waitForTimeout(2000);
  
  // Go to BP
  console.log('=== GOING TO BP ===');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Get field monster positions
  const fieldMonsters = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top >= 500 && rect.top < 750) {
        result.push({ text: text.replace(/\s+/g,' ').trim().slice(0, 40), cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2), x: rect.left, y: rect.top });
      }
    }
    return result;
  });
  console.log('Field monsters:', JSON.stringify(fieldMonsters));
  
  if (fieldMonsters.length > 0) {
    const fm = fieldMonsters[0];
    console.log(`\n=== IN BP, CLICKING MONSTER at [${fm.cx}, ${fm.cy}] ===`);
    
    // First try: mouse.click with force
    console.log('Method 1: page.mouse.click with force');
    await page.mouse.click(fm.cx, fm.cy, { force: true });
    await page.waitForTimeout(1500);
    
    let attackState = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border-yellow"]');
      return { count: highlighted.length };
    });
    console.log('State:', JSON.stringify(attackState));
    
    if (attackState.count === 0) {
      // Method 2: locator.click
      console.log('\nMethod 2: locator.click');
      const monsterLocator = page.locator('div.relative').filter({ hasText: /★.*ATK.*DEF/ }).first();
      await monsterLocator.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      
      attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border-yellow"]');
        return { count: highlighted.length };
      });
      console.log('State:', JSON.stringify(attackState));
    }
    
    if (attackState.count === 0) {
      // Method 3: Find React fiber and call onClick directly
      console.log('\nMethod 3: React fiber onClick');
      await page.evaluate((fmPos) => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.cursor !== 'pointer') continue;
          const text = el.textContent || '';
          if (!text.match(/ATK.*DEF/)) continue;
          
          const rect = el.getBoundingClientRect();
          if (rect.top >= 500 && rect.top < 750) {
            if (Math.abs(rect.left - fmPos.x) < 5) {
              // Found the element - try calling its React onClick
              const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
              if (fiberKey) {
                console.log('[METHOD 3] Found React fiber, calling onClick');
                el.click();
              }
              return;
            }
          }
        }
      }, fm);
      await page.waitForTimeout(1500);
      
      attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return { count: highlighted.length };
      });
      console.log('State after method 3:', JSON.stringify(attackState));
    }
    
    if (attackState.count === 0) {
      // Method 4: Simulate the correct sequence of events
      console.log('\nMethod 4: Simulate pointer events');
      await page.evaluate((fmPos) => {
        const el = document.elementFromPoint(fmPos.cx, fmPos.cy);
        if (!el) return;
        
        // Create proper pointer events
        const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true });
        const pointerUp = new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, pointerId: 1, isPrimary: true });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        
        el.dispatchEvent(pointerDown);
        el.dispatchEvent(pointerUp);
        el.dispatchEvent(click);
        
        console.log('[METHOD 4] Events dispatched to element from point');
      }, fm);
      await page.waitForTimeout(1500);
      
      attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return { count: highlighted.length };
      });
      console.log('State after method 4:', JSON.stringify(attackState));
    }
    
    if (attackState.count === 0) {
      // Method 5: Check what canBattle actually is by reading React state
      console.log('\nMethod 5: Debug canBattle');
      const debugInfo = await page.evaluate(() => {
        // Try to find the React root
        const root = document.getElementById('root');
        const reactKey = Object.keys(root).find(k => k.startsWith('_reactRoot'));
        
        return {
          inBattle: document.body.innerText.includes('BP'),
          phaseActive: document.querySelector('button.bg-ygo-red, button.phase-active')?.textContent
        };
      });
      console.log('Debug info:', JSON.stringify(debugInfo));
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);