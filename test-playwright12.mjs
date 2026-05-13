import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HGE]') || text.includes('[handle') || text.includes('[HP]') || text.includes('attack') || text.includes('modal')) {
      console.log('[CONSOLE]', text);
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('=== TURN 1: AI plays, waiting... ===');
  await page.waitForTimeout(15000);
  
  console.log('=== TURN 2: Player Main Phase 1 ===');
  
  // Check we are in M1
  const m1Enabled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const m1 = btns.find(b => b.textContent.trim() === 'M1');
    return m1 ? !m1.disabled : false;
  });
  console.log('M1 enabled:', m1Enabled);
  
  // Find hand cards to summon (double-click to summon)
  const handCards = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const cards = [];
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      // Hand cards: large area at bottom, have both ATK and DEF
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length > 50 && text.length < 150) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 750 && rect.height >= 100 && rect.width >= 70) {
          cards.push({
            text: text.slice(0, 80),
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
    return cards;
  });
  
  console.log('Hand cards found:', JSON.stringify(handCards.map(c => ({text: c.text.slice(0,40), cx: c.cx, cy: c.cy}))));
  
  if (handCards.length > 0) {
    // DOUBLE-CLICK on first hand card to summon
    const card = handCards[0];
    console.log(`\n=== DOUBLE-CLICK summon at [${card.cx}, ${card.cy}]: "${card.text.slice(0,40)}" ===`);
    
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(100);
    await page.mouse.click(card.cx, card.cy);
    await page.waitForTimeout(1000);
    
    // Check if modal appeared
    const modalState = await page.evaluate(() => {
      const modals = document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="overlay"]');
      const overlayText = document.querySelector('.overlay-title, .overlay-sub, [class*="overlay"]');
      return {
        modalCount: modals.length,
        overlayText: overlayText ? overlayText.textContent : 'none'
      };
    });
    console.log('Modal state:', JSON.stringify(modalState));
    
    // Check if a summon modal appeared with "Summon" and "Set" options
    const summonModal = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => b.textContent.trim());
    });
    console.log('All buttons after double-click:', JSON.stringify(summonModal));
    
    // If there's a "Summon" button in the modal, click it
    const summonBtn = await page.$('button:has-text("Summon")');
    if (summonBtn) {
      console.log('Clicking Summon button...');
      await summonBtn.click();
      await page.waitForTimeout(1500);
    }
    
    // Check if monster appeared on field
    const fieldState = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const monsters = [];
      all.forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g,' ').trim();
        // Field monster: exact 80x112 size, in field area (y 500-750)
        if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
          const rect = el.getBoundingClientRect();
          if (rect.top >= 500 && rect.top < 750 && rect.width >= 75 && rect.width <= 82 && rect.height >= 108 && rect.height <= 115) {
            monsters.push({
              text,
              cx: Math.round(rect.left + rect.width/2),
              cy: Math.round(rect.top + rect.height/2)
            });
          }
        }
      });
      return monsters;
    });
    
    console.log('Field monsters after summon:', JSON.stringify(fieldState));
    
    // Now try to summon another monster
    if (fieldState.length > 0) {
      const secondCard = handCards.find(c => c.cy !== card.cy) || handCards[1];
      if (secondCard) {
        console.log(`\n=== DOUBLE-CLICK second card at [${secondCard.cx}, ${secondCard.cy}] ===`);
        await page.mouse.click(secondCard.cx, secondCard.cy);
        await page.waitForTimeout(100);
        await page.mouse.click(secondCard.cx, secondCard.cy);
        await page.waitForTimeout(1000);
        
        const summonBtn2 = await page.$('button:has-text("Summon")');
        if (summonBtn2) {
          console.log('Clicking Summon for second monster...');
          await summonBtn2.click();
          await page.waitForTimeout(1500);
        }
        
        const fieldState2 = await page.evaluate(() => {
          const all = document.querySelectorAll('*');
          const monsters = [];
          all.forEach(el => {
            const text = (el.textContent || '').replace(/\s+/g,' ').trim();
            if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
              const rect = el.getBoundingClientRect();
              if (rect.top >= 500 && rect.top < 750 && rect.width >= 75 && rect.width <= 82 && rect.height >= 108 && rect.height <= 115) {
                monsters.push({text, cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2)});
              }
            }
          });
          return monsters;
        });
        console.log('Field monsters after second summon:', JSON.stringify(fieldState2));
      }
    }
  }
  
  // Go to Battle Phase
  console.log('\n=== Going to Battle Phase ===');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Check BP state
  const bpState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.trim() === 'BP');
    return {
      bpEnabled: bp ? !bp.disabled : false,
      canBattle: document.querySelectorAll('[class*="selectable"]').length
    };
  });
  console.log('BP state:', JSON.stringify(bpState));
  
  // Try to attack with a monster
  const fieldMonsters = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const monsters = [];
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 500 && rect.top < 750 && rect.width >= 75 && rect.width <= 82 && rect.height >= 108 && rect.height <= 115) {
          monsters.push({text, cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2)});
        }
      }
    });
    return monsters;
  });
  
  console.log('Field monsters in BP:', JSON.stringify(fieldMonsters));
  
  if (fieldMonsters.length > 0) {
    // Click monster to select for attack
    const monster = fieldMonsters[0];
    console.log(`\n=== SELECTING monster at [${monster.cx}, ${monster.cy}]: "${monster.text}" ===`);
    await page.mouse.click(monster.cx, monster.cy, { force: true });
    await page.waitForTimeout(1500);
    
    // Check if selected
    const afterSelect = await page.evaluate(() => {
      // Check for any selected state (yellow border, ring, etc)
      const selected = document.querySelectorAll('[class*="selected"], [class*="border-yellow"], [class*="ring"]');
      return {
        count: selected.length,
        texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('After select:', JSON.stringify(afterSelect));
    
    // Check if attack targets are highlighted
    const targetsInfo = await page.evaluate(() => {
      const targets = document.querySelectorAll('[class*="target"], [class*="attack-target"]');
      return {
        count: targets.length,
        texts: Array.from(targets).map(t => t.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('Attack targets:', JSON.stringify(targetsInfo));
  }
  
  // Now try to attack
  console.log('\n=== Attempting attack ===');
  
  // Try clicking on opponent's field area  
  await page.mouse.click(400, 200, { force: true });
  await page.waitForTimeout(2000);
  
  // Check result
  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
    return {
      yugiLP: yugiLP ? yugiLP[1] : 'not found',
      text: text.slice(0, 500)
    };
  });
  console.log('Result:', JSON.stringify(result));
  
  await browser.close();
}

run().catch(console.error);