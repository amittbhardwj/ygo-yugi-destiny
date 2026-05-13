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
  
  // Get all hand card positions 
  const handCards = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 780 || rect.width < 70 || rect.height < 100) continue;
      
      result.push({
        text: text.replace(/\s+/g,' ').trim().slice(0, 50),
        cx: Math.round(rect.left + rect.width/2),
        cy: Math.round(rect.top + rect.height/2),
        x: Math.round(rect.left),
        y: Math.round(rect.top)
      });
    }
    return result;
  });
  
  console.log('Hand cards:', JSON.stringify(handCards));
  
  if (handCards.length > 0) {
    const card = handCards[0];
    const { cx, cy } = card;
    
    // DOUBLE CLICK with mouse.dblclick
    console.log(`\n=== page.mouse.dblclick at [${cx}, ${cy}] ===`);
    await page.mouse.dblclick(cx, cy);
    await page.waitForTimeout(800);
    
    // Check for modal
    const modal = await page.evaluate(() => {
      return {
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate'].includes(t)),
        hasSummonBtn: !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Summon')),
        hasOverlay: !!document.querySelector('[class*="overlay"], [class*="modal"]')
      };
    });
    console.log('Modal:', JSON.stringify(modal));
    
    if (modal.hasSummonBtn) {
      await page.click('button:has-text("Summon")');
      await page.waitForTimeout(1500);
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
      console.log(`Clicking field monster at [${fm.cx}, ${fm.cy}]`);
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
    }
  }
  
  await browser.close();
}

run().catch(console.error);