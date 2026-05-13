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
  
  console.log('=== TURN 1: Waiting for AI to play ===');
  await page.waitForTimeout(15000);
  
  console.log('=== TURN 2: Player in M1 ===');
  
  // Verify in M1
  const inM1 = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const m1 = btns.find(b => b.textContent.trim() === 'M1');
    return m1 ? !m1.disabled : false;
  });
  console.log('In M1:', inM1);
  
  // Get hand cards
  const handCards = await page.evaluate(() => {
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    const result = [];
    cards.forEach(c => {
      const text = c.textContent || '';
      // Hand cards are in the bottom area (y >= 750)
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length > 50) {
        const rect = c.getBoundingClientRect();
        if (rect.top >= 750) {
          result.push({
            text: text.replace(/\s+/g,' ').trim().slice(0, 60),
            cx: Math.round(rect.left + rect.width/2),
            cy: Math.round(rect.top + rect.height/2),
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          });
        }
      }
    });
    return result;
  });
  
  console.log('Hand cards:', JSON.stringify(handCards.map(c => ({text: c.text.slice(0,30), cx: c.cx, cy: c.cy}))));
  
  if (handCards.length > 0) {
    const card = handCards[0];
    
    // DOUBLE-CLICK to summon
    console.log(`\n=== DOUBLE-CLICK at [${card.cx}, ${card.cy}] to summon ===`);
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(150);
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(1000);
    
    // Check if summon modal appeared
    const modalState = await page.evaluate(() => {
      // Look for buttons with "Summon" text
      const buttons = Array.from(document.querySelectorAll('button'));
      const summonBtn = buttons.find(b => b.textContent.includes('Summon'));
      const setBtn = buttons.find(b => b.textContent.includes('Set'));
      return {
        buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel', 'Activate'].includes(t)),
        hasSummonBtn: !!summonBtn,
        hasSetBtn: !!setBtn
      };
    });
    console.log('Modal state:', JSON.stringify(modalState));
    
    if (modalState.hasSummonBtn) {
      // Click Summon
      console.log('Clicking Summon button...');
      await page.click('button:has-text("Summon")', { timeout: 3000 }).catch(e => console.log('Summon click failed:', e.message));
      await page.waitForTimeout(1500);
      
      // Now check if monster is on the field
      const fieldMonsters = await page.evaluate(() => {
        const cards = document.querySelectorAll('div.relative.cursor-pointer');
        const result = [];
        cards.forEach(c => {
          const text = c.textContent || '';
          if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
            const rect = c.getBoundingClientRect();
            // Field monsters: in the middle area y 500-750
            if (rect.top >= 500 && rect.top < 750) {
              result.push({
                text: text.trim().slice(0, 40),
                cx: Math.round(rect.left + rect.width/2),
                cy: Math.round(rect.top + rect.height/2)
              });
            }
          }
        });
        return result;
      });
      console.log('Field monsters after summon:', JSON.stringify(fieldMonsters));
      
      // If monster is on field, now go to BP and attack
      if (fieldMonsters.length > 0) {
        console.log('\n=== Going to Battle Phase ===');
        await page.click('button:has-text("END PHASE")');
        await page.waitForTimeout(2000);
        
        // Try to select monster for attack
        const monster = fieldMonsters[0];
        console.log(`Selecting monster at [${monster.cx}, ${monster.cy}]: "${monster.text}"`);
        await page.mouse.click(monster.cx, monster.cy, { force: true });
        await page.waitForTimeout(1500);
        
        // Check if attack targets appeared
        const attackState = await page.evaluate(() => {
          const highlighted = document.querySelectorAll('[class*="target"], [class*="ring"], [class*="selected"]');
          return {
            count: highlighted.length,
            texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
          };
        });
        console.log('Attack state:', JSON.stringify(attackState));
        
        // Try to attack - click on opponent's field area
        console.log('Attempting attack on opponent...');
        await page.mouse.click(400, 200, { force: true });
        await page.waitForTimeout(2000);
        
        // Check result
        const result = await page.evaluate(() => {
          const text = document.body.innerText;
          const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
          return {
            yugiLP: yugiLP ? yugiLP[1] : 'not found',
            gameText: text.slice(0, 400)
          };
        });
        console.log('Result:', JSON.stringify(result));
      }
    }
  }
  
  await browser.close();
}

run().catch(console.error);