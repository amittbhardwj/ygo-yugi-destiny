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
  
  // Find hand monster and summon
  console.log('\n=== SUMMON PHASE ===');
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
      
      return {
        cx: Math.round(rect.left + rect.width/2),
        cy: Math.round(rect.top + rect.height/2),
        text: text.replace(/\s+/g,' ').trim().slice(0, 40)
      };
    }
    return null;
  });
  
  if (cardPos) {
    const locator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
    await locator.dblclick({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const modal = await page.evaluate(() => {
      return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
    });
    console.log('Has SUMMON button:', modal);
    
    if (modal) {
      await page.click('button:has-text("SUMMON")');
      await page.waitForTimeout(2000);
    }
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
        result.push({
          text: text.replace(/\s+/g,' ').trim().slice(0, 40),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2)
        });
      }
    }
    return result;
  });
  console.log('Field monsters after summon:', JSON.stringify(fieldMons));
  
  if (fieldMons.length > 0) {
    // Go to M2 first (END PHASE once)
    console.log('\n=== GOING TO M2 ===');
    await page.click('button:has-text("END PHASE")');
    await page.waitForTimeout(1500);
    
    // Go to BP (END PHASE again)
    console.log('=== GOING TO BP ===');
    await page.click('button:has-text("END PHASE")');
    await page.waitForTimeout(2000);
    
    // Now click player monster
    const fm = fieldMons[0];
    console.log(`\n=== Clicking player monster at [${fm.cx}, ${fm.cy}]: "${fm.text}" ===`);
    
    // Use locator to click the exact monster element
    const monsterLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).nth(0);
    await monsterLocator.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    
    const attackState = await page.evaluate(() => {
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border-yellow"]');
      return {
        count: highlighted.length,
        texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('Attack state after monster click:', JSON.stringify(attackState));
    
    if (attackState.count > 0) {
      console.log('\n=== ATTACKING OPPONENT ===');
      // Click on opponent field area (y < 300)
      await page.mouse.click(400, 200, { force: true });
      await page.waitForTimeout(2000);
      
      const result = await page.evaluate(() => {
        const text = document.body.innerText;
        const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
        const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
        return {
          yugiLP: yugiLP ? yugiLP[1] : 'N/A',
          bossLP: bossLP ? bossLP[1] : 'N/A'
        };
      });
      console.log('LP after attack:', JSON.stringify(result));
      
      if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
        console.log('\n🎉 ATTACK SUCCESSFUL!');
      }
    } else {
      // Try direct evaluate to call the click handler
      console.log('\n=== Trying direct evaluate click ===');
      await page.evaluate((fmPos) => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.cursor !== 'pointer') continue;
          const text = el.textContent || '';
          if (!text.match(/ATK.*DEF/)) continue;
          
          const rect = el.getBoundingClientRect();
          if (rect.top >= 500 && rect.top < 750) {
            if (Math.abs(rect.left + rect.width/2 - fmPos.cx) < 10) {
              console.log('[CLICK] Found monster element, clicking...');
              el.click();
              return;
            }
          }
        }
      }, fm);
      await page.waitForTimeout(1500);
      
      const state2 = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return {
          count: highlighted.length,
          texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
        };
      });
      console.log('State after evaluate click:', JSON.stringify(state2));
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);