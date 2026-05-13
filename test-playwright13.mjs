import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HGE]') || text.includes('[handle') || text.includes('attack') || text.includes('phase')) {
      console.log('[CONSOLE]', text);
    }
  });

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
  
  // Deep inspection: what does the game state actually say about player field?
  const gameState = await page.evaluate(() => {
    // Access the React state via window or through evaluating script
    // But we can't access internal React state directly
    
    // Instead, check: is there actually a monster card DIV with the card data in it?
    // In the player field, we should see cards like:
    // <div class="card..." data-card-id="123">...ATK 1400...DEF 800...</div>
    
    const allDivs = Array.from(document.querySelectorAll('div'));
    const playerFieldDivs = allDivs.filter(d => {
      const rect = d.getBoundingClientRect();
      return rect.top >= 500 && rect.top < 750;
    });
    
    // Check for specific text in these divs
    const divTexts = playerFieldDivs.map(d => ({
      class: d.className.split(' ').slice(0,3).join(' '),
      text: (d.textContent || '').replace(/\s+/g,' ').trim().slice(0,40),
      rect: {
        x: Math.round(d.getBoundingClientRect().left),
        y: Math.round(d.getBoundingClientRect().top),
        w: Math.round(d.getBoundingClientRect().width),
        h: Math.round(d.getBoundingClientRect().height)
      }
    }));
    
    return {
      playerFieldDivCount: playerFieldDivs.length,
      sampleDivs: divTexts.slice(0, 15)
    };
  });
  
  console.log('Player field div count:', gameState.playerFieldDivCount);
  console.log('Sample divs:', JSON.stringify(gameState.sampleDivs, null, 2));
  
  // Check for card-clickable elements specifically
  const cardClickable = await page.evaluate(() => {
    const all = document.querySelectorAll('[class*="cursor-pointer"]');
    return Array.from(all).map(el => ({
      tag: el.tagName,
      class: el.className.split(' ').slice(0,3).join(' '),
      text: (el.textContent || '').replace(/\s+/g,' ').trim().slice(0,40),
      rect: {
        x: Math.round(el.getBoundingClientRect().left),
        y: Math.round(el.getBoundingClientRect().top),
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height)
      }
    }));
  });
  
  console.log('\nCursor-pointer elements:', JSON.stringify(cardClickable.slice(0, 20), null, 2));
  
  // Try a more targeted click: find the exact element by class pattern
  // Field monster cards have class "relative cursor-pointer transition-all duration-200 rounded-lg overflow-hidden border-2 border-[#8B5A2B]"
  const fieldMonsterClick = await page.evaluate(() => {
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    const monsters = [];
    cards.forEach(card => {
      const text = (card.textContent || '').replace(/\s+/g,' ').trim();
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
        const rect = card.getBoundingClientRect();
        monsters.push({
          text: text.slice(0,60),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        });
      }
    });
    return monsters;
  });
  
  console.log('\nField monster cards (div.relative.cursor-pointer):', JSON.stringify(fieldMonsterClick));
  
  if (fieldMonsterClick.length > 0) {
    const m = fieldMonsterClick[0];
    console.log(`\n=== CLICKING at [${m.cx}, ${m.cy}] ===`);
    await page.mouse.click(m.cx, m.cy, { force: true });
    await page.waitForTimeout(1500);
    
    // Check console for handleSelectMonster
    const logs = await page.evaluate(() => {
      return window._consoleLogs || [];
    });
    
    // Check what happened
    const state = await page.evaluate(() => {
      // Check if any dispatch happened (look for any state change)
      const body = document.body.innerText;
      return { bodySnippet: body.slice(0, 300) };
    });
    console.log('State after click:', JSON.stringify(state));
  }
  
  await browser.close();
}

run().catch(console.error);