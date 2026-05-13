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
  
  // Get hand card positions
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
    
    // Simulate double-click by firing two click events with proper timing
    console.log(`\n=== Simulating double-click at [${card.cx}, ${card.cy}] ===`);
    
    // Get the actual element at this position
    const elementInfo = await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.cx, pos.cy);
      if (!el) return null;
      
      // Check React fiber
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      
      return {
        tag: el.tagName,
        class: el.className.split(' ')[0],
        hasFiber: !!fiberKey,
        fiberKey: fiberKey,
        text: el.textContent.slice(0, 50)
      };
    }, card);
    
    console.log('Element at click position:', JSON.stringify(elementInfo));
    
    // Now do the actual click sequence - first click, wait, second click
    console.log('First click...');
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(50); // Very short gap to simulate dblclick timing
    
    console.log('Second click...');
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(500);
    
    // Check modal
    const modal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate', 'BP'].includes(t)),
        hasSummonBtn: !!buttons.find(b => b.textContent.includes('Summon')),
        hasOverlay: !!document.querySelector('[class*="overlay"], [class*="modal"]')
      };
    });
    console.log('Modal after 2-clicks:', JSON.stringify(modal));
    
    if (!modal.hasSummonBtn) {
      // Try with 100ms gap  
      console.log('\nTrying with 100ms gap...');
      await page.mouse.click(card.cx, card.cy);
      await page.waitForTimeout(100);
      await page.mouse.click(card.cx, card.cy);
      await page.waitForTimeout(500);
      
      const modal2 = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return {
          buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate'].includes(t)),
          hasSummonBtn: !!buttons.find(b => b.textContent.includes('Summon'))
        };
      });
      console.log('Modal after 100ms-gap 2-clicks:', JSON.stringify(modal2));
    }
    
    if (!modal.hasSummonBtn) {
      // Try native dblclick event
      console.log('\nTrying native dblclick event...');
      await page.evaluate((pos) => {
        const el = document.elementFromPoint(pos.cx, pos.cy);
        if (el) {
          const event = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          el.dispatchEvent(event);
        }
      }, card);
      await page.waitForTimeout(500);
      
      const modal3 = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return {
          hasSummonBtn: !!buttons.find(b => b.textContent.includes('Summon'))
        };
      });
      console.log('Modal after native dblclick:', JSON.stringify(modal3));
    }
  }
  
  await browser.close();
}

run().catch(console.error);