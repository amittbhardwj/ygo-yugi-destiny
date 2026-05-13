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
    
    console.log(`\n=== DOUBLE-CLICK to summon ===`);
    const locator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
    await locator.dblclick({ timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const modal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const summonBtn = buttons.find(b => b.textContent.includes('SUMMON'));
      return {
        hasSummon: !!summonBtn,
        buttons: buttons.map(b => b.textContent.trim()).filter(t => t.length < 30)
      };
    });
    console.log('Modal:', JSON.stringify(modal));
    
    if (modal.hasSummon) {
      console.log('=== CLICKING SUMMON ===');
      await page.click('button:has-text("SUMMON")');
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
            text: text.replace(/\s+/g,' ').trim().slice(0, 40),
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
      
      const bpPhase = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const bp = btns.find(b => b.textContent.includes('BP'));
        return bp ? bp.className.includes('phase-active') : false;
      });
      console.log('In BP:', bpPhase);
      
      const fm = fieldMons[0];
      console.log(`Clicking player monster at [${fm.cx}, ${fm.cy}]: "${fm.text}"`);
      await page.mouse.click(fm.cx, fm.cy, { force: true });
      await page.waitForTimeout(1500);
      
      const attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border-yellow"]');
        return {
          count: highlighted.length,
          texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
        };
      });
      console.log('Attack state after selecting monster:', JSON.stringify(attackState));
      
      if (attackState.count > 0) {
        console.log('\n=== ATTACKING OPPONENT ===');
        // Click on opponent's field area (y < 300)
        await page.mouse.click(400, 200, { force: true });
        await page.waitForTimeout(2000);
        
        const result = await page.evaluate(() => {
          const text = document.body.innerText;
          const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
          const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
          return {
            yugiLP: yugiLP ? yugiLP[1] : 'N/A',
            bossLP: bossLP ? bossLP[1] : 'N/A',
            text: text.slice(0, 200)
          };
        });
        console.log('LP after attack:', JSON.stringify(result));
        
        if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
          console.log('\n🎉 ATTACK SUCCESSFUL! Yugi LP decreased!');
        }
      } else {
        console.log('No attack targets - need to check if monster was selected');
      }
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);