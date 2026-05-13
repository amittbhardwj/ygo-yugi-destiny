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
  await page.waitForTimeout(2000);
  
  // Intercept all clicks at document level to see what's happening
  await page.evaluate(() => {
    window._clickLog = [];
    document.addEventListener('click', (e) => {
      const target = e.target;
      const info = {
        tag: target.tagName,
        class: target.className,
        id: target.id,
        text: target.textContent.replace(/\s+/g,' ').trim().slice(0,50),
        clientX: e.clientX,
        clientY: e.clientY
      };
      window._clickLog.push(info);
      console.log('[CLICK INTERCEPT]', JSON.stringify(info));
    }, true);
  });
  
  // Try clicking on one of the monster cards in player field
  // The cards are at [796, 380] approx 80x112
  // Try clicking the OUTER wrapper div at position [796+40, 380+56] = [836, 436]
  console.log('Trying click at [836, 436] (center of monster card at [796,380])...');
  await page.mouse.click(836, 436);
  await page.waitForTimeout(1500);
  
  // Check what was clicked
  const clickLog = await page.evaluate(() => window._clickLog || []);
  console.log('Click log:', JSON.stringify(clickLog, null, 2));
  
  // Check if monster was selected
  const selectedCheck = await page.evaluate(() => {
    // Look for any indication of selected monster
    const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border"]');
    return {
      selectedClassCount: selected.length,
      selectedText: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,60))
    };
  });
  console.log('Selected check:', JSON.stringify(selectedCheck));
  
  // Now try clicking using page.click on a selector - find the card div by text content
  const clickResult = await page.evaluate(() => {
    // Find all elements that look like monster cards (have ATK and DEF stats)
    const allEls = document.querySelectorAll('div, span');
    const cardEls = [];
    
    allEls.forEach(el => {
      const text = el.textContent || '';
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 150 && text.length > 30) {
        // Get the position
        const rect = el.getBoundingClientRect();
        if (rect.top >= 500 && rect.width > 50 && rect.height > 50) {
          cardEls.push({
            tag: el.tagName,
            class: el.className,
            text: text.replace(/\s+/g,' ').trim().slice(0,60),
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      }
    });
    
    return cardEls;
  });
  
  console.log('Card elements found:', JSON.stringify(clickResult, null, 2));
  
  if (clickResult.length > 0) {
    // Try clicking using page.click with a text selector approach
    // Use the position of the largest card element
    const targetCard = clickResult.reduce((prev, curr) => 
      (curr.width * curr.height) > (prev.width * prev.height) ? curr : prev
    );
    
    const centerX = targetCard.left + targetCard.width/2;
    const centerY = targetCard.top + targetCard.height/2;
    
    console.log(`\nTrying page.mouse.click at [${centerX}, ${centerY}] for card: ${targetCard.text}`);
    await page.mouse.click(centerX, centerY, { force: true });
    await page.waitForTimeout(2000);
    
    // Check again
    const check2 = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"]');
      return {
        count: selected.length,
        texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,60))
      };
    });
    console.log('After force click:', JSON.stringify(check2));
    
    // Check for attack targets
    const attackTargets = await page.evaluate(() => {
      // Check if attack targets are highlighted
      const highlighted = document.querySelectorAll('[class*="target"], [class*="enemy"], [class*="can-attack"]');
      return {
        count: highlighted.length,
        texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,60))
      };
    });
    console.log('Attack targets:', JSON.stringify(attackTargets));
  }
  
  await browser.close();
}

run().catch(console.error);