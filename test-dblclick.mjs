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
  
  console.log('=== TURN 1: Waiting for AI ===');
  await page.waitForTimeout(18000);
  
  // Get the exact card element position (outer div with cursor-pointer, y>=780 for hand)
  const cardPos = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      if (!text.match(/★★★★+/)) continue; // Need star rating
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 780 || rect.width < 70 || rect.height < 100) continue;
      
      // This is a hand card - check if it has the onclick
      const onclick = el.getAttribute('onclick');
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        cx: Math.round(rect.left + rect.width/2),
        cy: Math.round(rect.top + rect.height/2),
        text: text.replace(/\s+/g,' ').trim().slice(0, 40),
        onclick: onclick ? 'yes' : 'no'
      };
    }
    return null;
  });
  
  console.log('Card position:', JSON.stringify(cardPos));
  
  if (cardPos) {
    const { cx, cy } = cardPos;
    
    // DOUBLE CLICK with Playwright's native dblclick() - this is the key!
    console.log(`\n=== Using page.mouse.dblclick() at [${cx}, ${cy}] ===`);
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(800);
    
    // Check for modal
    const modal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const summonBtn = buttons.find(b => b.textContent.includes('Summon'));
      const cancelBtn = buttons.find(b => b.textContent.includes('Cancel'));
      return {
        buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate'].includes(t)),
        hasSummonBtn: !!summonBtn,
        hasOverlay: !!document.querySelector('[class*="overlay"], [class*="modal"]'),
        overlayContent: document.querySelector('[class*="overlay"], [class*="modal"]')?.textContent?.slice(0, 100)
      };
    });
    console.log('Modal after dblclick:', JSON.stringify(modal));
    
    if (modal.hasSummonBtn) {
      console.log('=== SUMMONING ===');
      await page.click('button:has-text("Summon")');
      await page.waitForTimeout(1500);
      
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
              text: text.replace(/\s+/g,' ').trim().slice(0, 50),
              cx: Math.round(rect.left + rect.width/2),
              cy: Math.round(rect.top + rect.height/2)
            });
          }
        }
        return result;
      });
      console.log('Field monsters:', JSON.stringify(fieldMons));
      
      if (fieldMons.length > 0) {
        console.log('\n=== GOING TO BP ===');
        await page.click('button:has-text("END PHASE")');
        await page.waitForTimeout(2000);
        
        const fm = fieldMons[0];
        console.log(`Clicking field monster at [${fm.cx}, ${fm.cy}]: "${fm.text}"`);
        await page.mouse.click(fm.cx, fm.cy, { force: true });
        await page.waitForTimeout(1500);
        
        const attackState = await page.evaluate(() => {
          const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border"]');
          return {
            count: highlighted.length,
            texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
          };
        });
        console.log('Attack state:', JSON.stringify(attackState));
        
        // Click on opponent field area (y < 300) to attack
        if (attackState.count > 0) {
          console.log('Clicking opponent area to attack...');
          await page.mouse.click(400, 200, { force: true });
          await page.waitForTimeout(2000);
          
          const result = await page.evaluate(() => {
            const text = document.body.innerText;
            const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
            return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', text: text.slice(0, 300) };
          });
          console.log('Result:', JSON.stringify(result));
        }
      }
    } else {
      // Try with locator-based dblclick
      console.log('\n=== Trying locator.dblclick() ===');
      const locator = page.locator('div.relative').filter({ hasText: /ATK.*DEF/ }).first();
      if (await locator.count() > 0) {
        await locator.dblclick();
        await page.waitForTimeout(800);
        
        const modal2 = await page.evaluate(() => {
          return {
            hasOverlay: !!document.querySelector('[class*="overlay"], [class*="modal"]'),
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel'].includes(t))
          };
        });
        console.log('Modal after locator dblclick:', JSON.stringify(modal2));
      }
    }
  }
  
  await browser.close();
}

run().catch(console.error);