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
  
  // Deep inspect - find ALL clickable monster cards with their details
  const allMonsterCards = await page.evaluate(() => {
    const results = {
      playerMonsters: [],
      opponentMonsters: [],
      allClickableWithAtk: []
    };
    
    // Method: Find every element that could be a card
    // Cards have: cursor:pointer, contain ATK text, have reasonable size
    const all = document.querySelectorAll('*');
    
    all.forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') return;
        
        const text = el.textContent || '';
        if (!text.match(/ATK\s*\d/)) return;
        
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return;
        
        const info = {
          tag: el.tagName,
          class: el.className,
          id: el.id,
          text: text.replace(/\s+/g,' ').trim().slice(0,80),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          pointerEvents: style.pointerEvents
        };
        
        if (rect.top >= 500) {
          results.playerMonsters.push(info);
        } else if (rect.top >= 100) {
          results.opponentMonsters.push(info);
        }
        
        results.allClickableWithAtk.push(info);
      } catch(e) {}
    });
    
    return results;
  });
  
  console.log('\n=== PLAYER MONSTERS (bottom half) ===');
  allMonsterCards.playerMonsters.forEach((m, i) => {
    console.log(`${i}: [${m.top},${m.left}] ${m.tag} ${m.class} | "${m.text}" | ${m.width}x${m.height}`);
  });
  
  console.log('\n=== OPPONENT MONSTERS (middle area) ===');
  allMonsterCards.opponentMonsters.forEach((m, i) => {
    console.log(`${i}: [${m.top},${m.left}] ${m.tag} ${m.class} | "${m.text}" | ${m.width}x${m.height}`);
  });
  
  console.log('\n=== ALL WITH ATK (sorted by top) ===');
  allMonsterCards.allClickableWithAtk.slice(0, 10).forEach((m, i) => {
    console.log(`${i}: [${m.top},${m.left}] "${m.text.slice(0,50)}"`);
  });
  
  // Try clicking using a more targeted approach - look for card elements with large clickable area
  if (allMonsterCards.playerMonsters.length > 0) {
    // Sort by size to find the biggest element (likely the card wrapper)
    const sorted = [...allMonsterCards.playerMonsters].sort((a, b) => 
      (b.width * b.height) - (a.width * a.height)
    );
    
    console.log('\n=== TRYING CLICK ON LARGEST PLAYER MONSTER ===');
    const target = sorted[0];
    console.log(`Clicking: [${target.top},${target.left}] ${target.width}x${target.height} "${target.text}"`);
    
    // Click using mouse
    await page.mouse.click(target.left + target.width/2, target.top + target.height/2);
    await page.waitForTimeout(2000);
    
    // Check if any event happened
    const afterState = await page.evaluate(() => {
      return {
        bodyText: document.body.innerText.slice(0, 300),
        hasSelected: document.querySelectorAll('[class*="selected"]').length
      };
    });
    console.log('After click state:', JSON.stringify(afterState));
    
    // Now try to attack - look for opponent monsters as targets
    if (allMonsterCards.opponentMonsters.length > 0) {
      const oppTarget = allMonsterCards.opponentMonsters[0];
      console.log(`\nClicking opponent monster to attack: [${oppTarget.top}] "${oppTarget.text}"`);
      
      await page.mouse.click(oppTarget.left + oppTarget.width/2, oppTarget.top + oppTarget.height/2);
      await page.waitForTimeout(2000);
      
      // Check LP after attack
      const lpText = await page.evaluate(() => document.body.innerText);
      console.log('\nGame text after attack:', lpText.slice(0, 400));
    }
  }
  
  await browser.close();
}

run().catch(console.error);