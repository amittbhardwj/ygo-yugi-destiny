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
  
  // Find hand monster position
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
  
  console.log('Card:', JSON.stringify(cardPos));
  
  if (cardPos) {
    const { cx, cy } = cardPos;
    
    console.log(`\n=== locator.dblclick at [${cx}, ${cy}] ===`);
    const locator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
    await locator.dblclick({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const modal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        hasSummon: !!buttons.find(b => b.textContent.includes('Summon')),
        buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel'].includes(t)),
        overlayText: document.querySelector('[class*="fixed inset-0"]')?.textContent?.slice(0, 100)
      };
    });
    console.log('Modal:', JSON.stringify(modal));
    
    if (modal.hasSummon) {
      console.log('=== SUMMONING ===');
      await page.click('button:has-text("Summon")');
      await page.waitForTimeout(2000);
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
            text: text.replace(/\s+/g,' ').trim().slice(0, 40)
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
      
      // Click player field monster
      const fmPos = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.cursor !== 'pointer') continue;
          const text = el.textContent || '';
          if (!text.match(/ATK.*DEF/)) continue;
          
          const rect = el.getBoundingClientRect();
          if (rect.top >= 500 && rect.top < 750) {
            return {
              cx: Math.round(rect.left + rect.width/2),
              cy: Math.round(rect.top + rect.height/2),
              text: text.replace(/\s+/g,' ').trim().slice(0, 40)
            };
          }
        }
        return null;
      });
      
      if (fmPos) {
        console.log(`Clicking field monster at [${fmPos.cx}, ${fmPos.cy}]: "${fmPos.text}"`);
        await page.mouse.click(fmPos.cx, fmPos.cy, { force: true });
        await page.waitForTimeout(1500);
        
        const attackState = await page.evaluate(() => {
          const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
          return {
            count: highlighted.length,
            texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
          };
        });
        console.log('Attack state:', JSON.stringify(attackState));
      }
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);