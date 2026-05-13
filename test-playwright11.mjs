import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HGE]') || text.includes('[handle') || text.includes('[HP]') || text.includes('attack')) {
      console.log('[CONSOLE]', text);
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('=== TURN 1: AI plays ===');
  await page.waitForTimeout(15000);
  
  // Check if player has monsters on field
  const fieldState = await page.evaluate(() => {
    const text = document.body.innerText;
    // Count M slots in player field (should have 5)
    const mMatches = text.match(/M\nM\nM\nM\nM/);
    const playerFieldHasMonsters = mMatches !== null;
    
    // Check if there are actual monster cards (with ATK/DEF) in the player field area
    // Player field is at the bottom of the screen (y > 500)
    const monsterCards = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 500 && rect.width >= 70) {
          monsterCards.push({text, x: Math.round(rect.left), y: Math.round(rect.top)});
        }
      }
    });
    
    return {
      playerFieldHasMonsters,
      monsterCards,
      bodySnippet: text.slice(text.indexOf('BOSS'), text.indexOf('BOSS') + 200)
    };
  });
  
  console.log('Player field state:', JSON.stringify(fieldState));
  
  if (fieldState.monsterCards.length === 0) {
    console.log('\n=== NO MONSTERS ON FIELD - Need to summon first! ===');
    console.log('In M1, need to:');
    console.log('1. Click on a monster card in hand to select it for summon');
    console.log('2. Click on an empty M slot to summon it');
    console.log('3. Then go to BP and attack');
    
    // Try to click on hand card to select for summon
    const handCards = await page.evaluate(() => {
      // Find hand cards (large cards at bottom of screen)
      const all = document.querySelectorAll('*');
      const cards = [];
      all.forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length > 50 && text.length < 100) {
          const rect = el.getBoundingClientRect();
          if (rect.top >= 750 && rect.height >= 100) {
            cards.push({
              text: text.slice(0, 60),
              cx: Math.round(rect.left + rect.width/2),
              cy: Math.round(rect.top + rect.height/2)
            });
          }
        }
      });
      return cards;
    });
    
    console.log('Hand cards found:', JSON.stringify(handCards));
    
    if (handCards.length > 0) {
      // Click on first hand card to try to summon
      const card = handCards[0];
      console.log(`\nClicking hand card at [${card.cx}, ${card.cy}]: "${card.text}"`);
      await page.mouse.click(card.cx, card.cy, { force: true });
      await page.waitForTimeout(1500);
      
      // Check if a modal appeared (summon/set selection)
      const hasModal = await page.evaluate(() => {
        const modals = document.querySelectorAll('[class*="modal"], [class*="Modal"]');
        return modals.length > 0;
      });
      console.log('Modal appeared:', hasModal);
    }
  }
  
  // Click END PHASE to go to BP
  console.log('\n=== Going to Battle Phase ===');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Now try to select a monster for attack
  console.log('Selecting monster for attack...');
  
  const bpState = await page.evaluate(() => {
    // Find player field monsters (in the middle row, not hand)
    const all = document.querySelectorAll('*');
    const monsters = [];
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      // Looking for exactly sized cards in field area (y between 500-750)
      if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 500 && rect.top < 750 && rect.width >= 75 && rect.width <= 82 && rect.height >= 108 && rect.height <= 115) {
          monsters.push({
            text,
            cx: Math.round(rect.left + rect.width/2),
            cy: Math.round(rect.top + rect.height/2),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          });
        }
      }
    });
    
    // Check phase buttons
    const btns = Array.from(document.querySelectorAll('button'));
    const bpEnabled = btns.find(b => b.textContent.trim() === 'BP')?.disabled === false;
    
    return { monsters, bpEnabled };
  });
  
  console.log('BP enabled:', bpState.bpEnabled);
  console.log('Field monsters:', JSON.stringify(bpState.monsters));
  
  if (bpState.monsters.length > 0) {
    const monster = bpState.monsters[0];
    console.log(`\nClicking monster at [${monster.cx}, ${monster.cy}]: "${monster.text}"`);
    await page.mouse.click(monster.cx, monster.cy, { force: true });
    await page.waitForTimeout(1500);
    
    // Check if selected
    const afterSelect = await page.evaluate(() => {
      // Look for any selected/highlighted monster
      const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"]');
      return {
        count: highlighted.length,
        texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0, 50))
      };
    });
    console.log('After select:', JSON.stringify(afterSelect));
  }
  
  // If we got this far without monsters, let's check what IS in the field
  if (bpState.monsters.length === 0) {
    const fieldContents = await page.evaluate(() => {
      // Get everything in the player field area (500-750 y range)
      const all = document.querySelectorAll('*');
      const items = [];
      all.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 500 && rect.top < 750 && rect.width > 20 && rect.height > 20) {
          const text = (el.textContent || '').replace(/\s+/g,' ').trim();
          if (text.length > 0 && text.length < 200) {
            items.push({
              tag: el.tagName,
              class: el.className.split(' ')[0],
              text: text.slice(0, 60),
              x: Math.round(rect.left),
              y: Math.round(rect.top),
              w: Math.round(rect.width),
              h: Math.round(rect.height)
            });
          }
        }
      });
      return items;
    });
    console.log('\nField contents (500-750 y):', JSON.stringify(fieldContents.slice(0, 20)));
  }
  
  await browser.close();
}

run().catch(console.error);