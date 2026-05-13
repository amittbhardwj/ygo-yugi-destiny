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
  
  // Inject more detailed click tracking
  await page.evaluate(() => {
    window._clickLog = [];
    
    // Track at document level with phase info
    document.addEventListener('click', (e) => {
      const info = {
        target_tag: e.target.tagName,
        target_class: e.target.className.split(' ').slice(0, 5).join(' '),
        target_text: (e.target.textContent || '').replace(/\s+/g,' ').trim().slice(0,50),
        clientX: e.clientX,
        clientY: e.clientY,
        offsetX: e.offsetX,
        offsetY: e.offsetY,
        path: e.composedPath().slice(0, 5).map(el => `${el.tagName}.${el.className.split(' ')[0]}`).join(' > ')
      };
      window._clickLog.push(info);
      console.log('[CLICK]', JSON.stringify(info));
    }, true);
    
    // Also log mouse movements to understand screen
    document.addEventListener('mousemove', (e) => {
      // Check what's under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el.textContent?.match(/ATK/)) {
        console.log('[HOVER]', el.tagName, el.className.split(' ')[0], el.textContent.replace(/\s+/g,' ').slice(0,40));
      }
    });
  });
  
  // Get all monster card positions precisely
  const cardPositions = await page.evaluate(() => {
    // Find monster cards by looking for elements with ATK/DEF that are in the player field
    const all = document.querySelectorAll('*');
    const cards = [];
    
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      // Looking for "ATK 1400" style text
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 100) {
        const rect = el.getBoundingClientRect();
        // Only player field cards (bottom half, > 500px from top)
        if (rect.top >= 500 && rect.width >= 70 && rect.height >= 100) {
          cards.push({
            text,
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(rect.left + rect.width/2),
            centerY: Math.round(rect.top + rect.height/2)
          });
        }
      }
    });
    
    return cards;
  });
  
  console.log('\nMonster cards in player field:');
  cardPositions.forEach((c, i) => {
    console.log(`${i}: [${c.left},${c.top}] ${c.width}x${c.height} center=[${c.centerX},${c.centerY}] "${c.text}"`);
  });
  
  if (cardPositions.length > 0) {
    const card = cardPositions[0];
    console.log(`\n=== CLICKING at [${card.centerX}, ${card.centerY}] ===`);
    
    // Force click at exact position
    await page.mouse.click(card.centerX, card.centerY, { force: true });
    await page.waitForTimeout(2000);
    
    // Check click log
    const clicks = await page.evaluate(() => window._clickLog || []);
    console.log('\nClick log:');
    clicks.forEach(c => console.log(JSON.stringify(c)));
    
    // Check game state
    const state = await page.evaluate(() => {
      // Look for selected monster indicator
      const cards = document.querySelectorAll('[class*="ring"], [class*="selected"], [class*="border-yellow"]');
      return {
        selectedCount: cards.length,
        selectedText: Array.from(cards).map(c => c.textContent.replace(/\s+/g,' ').slice(0,50)),
        // Also check attack targets
        attackTargets: document.querySelectorAll('[class*="target"]').length
      };
    });
    console.log('\nState after click:', JSON.stringify(state));
    
    // If monster was selected, try to attack with it
    if (state.selectedCount > 0) {
      console.log('Monster selected! Trying to attack...');
      
      // Get opponent's monster positions (top half of screen)
      const oppCards = await page.evaluate(() => {
        const all = document.querySelectorAll('*');
        const cards = [];
        all.forEach(el => {
          const text = (el.textContent || '').replace(/\s+/g,' ').trim();
          if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 100) {
            const rect = el.getBoundingClientRect();
            if (rect.top >= 100 && rect.top < 500 && rect.width >= 70 && rect.height >= 100) {
              cards.push({
                text,
                centerX: Math.round(rect.left + rect.width/2),
                centerY: Math.round(rect.top + rect.height/2)
              });
            }
          }
        });
        return cards;
      });
      
      console.log('Opponent monster cards:', JSON.stringify(oppCards));
      
      if (oppCards.length > 0) {
        const opp = oppCards[0];
        console.log(`Attacking opponent monster at [${opp.centerX}, ${opp.centerY}]...`);
        await page.mouse.click(opp.centerX, opp.centerY, { force: true });
        await page.waitForTimeout(2000);
      } else {
        // No opponent monsters - try direct attack on opponent
        console.log('No opponent monsters - checking for direct attack option...');
        // Try clicking on opponent's field area (top half)
        await page.mouse.click(400, 150, { force: true });
        await page.waitForTimeout(1000);
      }
      
      // Check result
      const result = await page.evaluate(() => {
        return document.body.innerText.slice(0, 500);
      });
      console.log('\nResult after attack:', result);
    }
  }
  
  await browser.close();
}

run().catch(console.error);