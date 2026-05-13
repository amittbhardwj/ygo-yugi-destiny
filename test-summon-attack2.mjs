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
  
  console.log('=== TURN 1: Waiting for AI to finish ===');
  await page.waitForTimeout(18000);
  
  // Should now be in player's M1
  console.log('=== TURN 2: Player in M1 ===');
  
  // Get all hand monster positions (with ATK text, y >= 780)
  const handMonsters = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') return;
      const text = (el.textContent || '');
      if (!text.match(/ATK.*DEF/)) return;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 780) return; // Hand area
      if (rect.width < 70 || rect.height < 100) return;
      
      result.push({
        text: text.replace(/\s+/g,' ').trim().slice(0, 60),
        cx: Math.round(rect.left + rect.width/2),
        cy: Math.round(rect.top + rect.height/2),
        x: Math.round(rect.left),
        y: Math.round(rect.top)
      });
    });
    return result;
  });
  
  console.log('Hand monsters:', JSON.stringify(handMonsters, null, 2));
  
  if (handMonsters.length > 0) {
    const monster = handMonsters[0];
    
    // Double-click to summon (check for double-tap detection in code)
    console.log(`\n=== DOUBLE-CLICK to summon at [${monster.cx}, ${monster.cy}]: "${monster.text}" ===`);
    
    // First click - should show card detail (single click behavior)
    await page.mouse.click(monster.cx, monster.cy);
    await page.waitForTimeout(300);
    
    // Second click - should trigger double-tap/summon modal
    await page.mouse.click(monster.cx, monster.cy);
    await page.waitForTimeout(500);
    
    // Check if a modal appeared
    const modalState = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const summonBtn = buttons.find(b => b.textContent.includes('Summon'));
      const cancelBtn = buttons.find(b => b.textContent.includes('Cancel'));
      const overlay = document.querySelector('[class*="overlay"], [class*="modal"]');
      
      return {
        buttons: buttons.map(b => b.textContent.trim()).filter(t => t.length < 20),
        hasOverlay: !!overlay,
        overlayText: overlay?.textContent?.slice(0, 100)
      };
    });
    console.log('After double-click modal state:', JSON.stringify(modalState));
    
    if (modalState.hasOverlay && modalState.buttons.length > 0) {
      // Click Summon
      const summonBtn = await page.$('button:has-text("Summon")');
      if (summonBtn) {
        console.log('Clicking Summon...');
        await summonBtn.click();
        await page.waitForTimeout(1500);
      }
    } else {
      // Try a faster double click
      console.log('Trying faster double-click...');
      await page.mouse.click(monster.cx, monster.cy);
      await page.waitForTimeout(100);
      await page.mouse.click(monster.cx, monster.cy);
      await page.waitForTimeout(500);
      
      const modal2 = await page.evaluate(() => {
        const overlay = document.querySelector('[class*="overlay"], [class*="modal"]');
        return {
          hasOverlay: !!overlay,
          overlayText: overlay?.textContent?.slice(0, 100),
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length < 20)
        };
      });
      console.log('After fast double-click:', JSON.stringify(modal2));
      
      if (modal2.hasOverlay) {
        const summonBtn = await page.$('button:has-text("Summon")');
        if (summonBtn) {
          await summonBtn.click();
          await page.waitForTimeout(1500);
        }
      }
    }
    
    // Check if monster appeared on field
    const fieldMonsters = await page.evaluate(() => {
      const result = [];
      const all = document.querySelectorAll('*');
      all.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') return;
        const text = (el.textContent || '');
        if (!text.match(/ATK.*DEF/)) return;
        
        const rect = el.getBoundingClientRect();
        // Field area: y between 500 and 750
        if (rect.top >= 500 && rect.top < 750) {
          result.push({
            text: text.replace(/\s+/g,' ').trim().slice(0, 50),
            cx: Math.round(rect.left + rect.width/2),
            cy: Math.round(rect.top + rect.height/2)
          });
        }
      });
      return result;
    });
    
    console.log('\nField monsters after summon attempt:', JSON.stringify(fieldMonsters));
    
    if (fieldMonsters.length > 0) {
      console.log('\n=== GOING TO BATTLE PHASE ===');
      await page.click('button:has-text("END PHASE")');
      await page.waitForTimeout(2000);
      
      const monster = fieldMonsters[0];
      console.log(`Clicking player field monster at [${monster.cx}, ${monster.cy}]: "${monster.text}"`);
      
      // Try multiple click approaches
      await page.mouse.click(monster.cx, monster.cy, { force: true });
      await page.waitForTimeout(1500);
      
      const attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"], [class*="border-yellow"], [class*="border-blue"], [class*="pulse"]');
        return {
          count: highlighted.length,
          texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
        };
      });
      console.log('Attack state after clicking monster:', JSON.stringify(attackState));
      
      if (attackState.count === 0) {
        // Try clicking on opponent monster area directly
        console.log('No selection yet. Clicking at opponent field position [400, 200]...');
        await page.mouse.click(400, 200, { force: true });
        await page.waitForTimeout(1500);
        
        const state2 = await page.evaluate(() => {
          const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
          return {
            count: highlighted.length,
            texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
          };
        });
        console.log('State after clicking opponent area:', JSON.stringify(state2));
      }
      
      // Check LP changes
      await page.waitForTimeout(1000);
      const lpState = await page.evaluate(() => {
        const text = document.body.innerText;
        const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
        const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
        return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', bossLP: bossLP ? bossLP[1] : 'N/A' };
      });
      console.log('LP after attack:', JSON.stringify(lpState));
    }
  }
  
  await browser.close();
  console.log('\n=== TEST COMPLETE ===');
}

run().catch(console.error);