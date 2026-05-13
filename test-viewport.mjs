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
  
  // Get hand card positions with larger viewport
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
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      });
    }
    return result;
  });
  
  console.log('Hand cards:', JSON.stringify(handCards));
  
  // Check if elementFromPoint works at card center
  if (handCards.length > 0) {
    const card = handCards[0];
    
    const elementInfo = await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.cx, pos.cy);
      if (!el) return { error: 'No element found at point', cx: pos.cx, cy: pos.cy };
      
      return {
        tag: el.tagName,
        class: el.className.split(' ')[0],
        text: el.textContent.slice(0, 50),
        pointerEvents: window.getComputedStyle(el).pointerEvents
      };
    }, card);
    
    console.log('Element at card center:', JSON.stringify(elementInfo));
    
    // Try clicking
    console.log(`\n=== Clicking at [${card.cx}, ${card.cy}] ===`);
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(100);
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(500);
    
    const modal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate'].includes(t)),
        hasSummonBtn: !!buttons.find(b => b.textContent.includes('Summon'))
      };
    });
    console.log('Modal:', JSON.stringify(modal));
    
    if (!modal.hasSummonBtn) {
      // Try dblclick directly  
      console.log('\n=== Trying page.mouse.dblclick ===');
      await page.mouse.dblclick(card.cx, card.cy);
      await page.waitForTimeout(500);
      
      const modal2 = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return {
          hasSummonBtn: !!buttons.find(b => b.textContent.includes('Summon'))
        };
      });
      console.log('Modal after dblclick:', JSON.stringify(modal2));
    }
    
    if (!modal.hasSummonBtn) {
      // Check what element is at that point
      const elAtPoint = await page.evaluate((pos) => {
        const el = document.elementFromPoint(pos.cx, pos.cy);
        return el ? { tag: el.tagName, class: el.className.split(' ')[0] } : null;
      }, card);
      console.log('Element at point:', JSON.stringify(elAtPoint));
    }
  }
  
  await browser.close();
}

run().catch(console.error);