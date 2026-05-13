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
  
  // Check what overlays or blocking elements exist
  const blockingElements = await page.evaluate(() => {
    const overlays = document.querySelectorAll('.game-overlay, [class*="overlay"], [class*="modal"]');
    const rects = Array.from(overlays).map(el => ({
      class: el.className.split(' ')[0],
      visible: el.offsetParent !== null,
      rect: el.getBoundingClientRect(),
      style: window.getComputedStyle(el)
    }));
    
    // Check if any has z-index > 50
    const blocking = rects.filter(r => 
      r.visible && 
      r.rect.width > 0 && 
      r.rect.height > 0 &&
      (parseInt(r.style.zIndex) > 50 || r.style.position === 'fixed')
    );
    
    return {
      allOverlays: rects.length,
      blocking: blocking.length,
      blockingInfo: blocking.map(b => ({
        class: b.class,
        zIndex: b.style.zIndex,
        position: b.style.position,
        rect: b.rect
      }))
    };
  });
  
  console.log('Blocking elements:', JSON.stringify(blockingElements, null, 2));
  
  // Now find the actual monster element and try clicking with JS dispatch
  const result = await page.evaluate(() => {
    // Find all elements with cursor:pointer in the player field area
    const all = document.querySelectorAll('*');
    const candidates = [];
    
    all.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') return;
      
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (!text.match(/ATK\s*\d+\s*DEF\s*\d+/) || text.length > 80) return;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 700 || rect.top > 900) return; // player field area
      
      // Check if this element is actually visible and has a click handler
      candidates.push({
        tag: el.tagName,
        class: el.className.split(' ').slice(0,3).join(' '),
        text: text.slice(0,40),
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        },
        // Check if click would hit this element or a child
        children: el.children.length,
        hasOnClick: typeof el.onclick === 'function'
      });
    });
    
    return candidates;
  });
  
  console.log('Monster candidates:', JSON.stringify(result, null, 2));
  
  if (result.length > 0) {
    // Try using dispatchEvent to simulate real click
    const target = result[0];
    console.log(`\n=== Using dispatchEvent on ${target.tag} at [${target.rect.x + target.rect.w/2}, ${target.rect.y + target.rect.h/2}] ===`);
    
    await page.evaluate((t) => {
      const el = document.elementFromPoint(t.x + t.w/2, t.y + t.h/2);
      if (el) {
        console.log('Element at point:', el.tagName, el.className.split(' ')[0]);
        // Create and dispatch a click event
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        el.dispatchEvent(event);
      }
    }, { x: target.rect.x, y: target.rect.y, w: target.rect.w, h: target.rect.h });
    
    await page.waitForTimeout(2000);
    
    // Check what happened
    const afterClick = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"]');
      return {
        selectedCount: selected.length,
        selectedTexts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('After dispatchEvent:', JSON.stringify(afterClick));
  }
  
  // Also check if canBattle is actually true
  const battleCheck = await page.evaluate(() => {
    // Look at rawPhase and isYourTurn from the UI state
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.trim() === 'BP');
    return {
      bpExists: !!bp,
      bpDisabled: bp ? bp.disabled : 'N/A',
      bpActive: bp ? bp.className.includes('phase-active') : false,
      bodyText: document.body.innerText.slice(0, 200)
    };
  });
  console.log('Battle check:', JSON.stringify(battleCheck));
  
  await browser.close();
}

run().catch(console.error);