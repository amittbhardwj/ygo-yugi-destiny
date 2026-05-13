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
  
  // Get ONLY field monster positions (not hand)
  const fieldMonsters = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const monsters = [];
    
    all.forEach(el => {
      const text = (el.textContent || '').replace(/\s+/g,' ').trim();
      // Find elements that have exactly "ATK XXXXDEF YYYY" pattern (single card)
      if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
        const rect = el.getBoundingClientRect();
        // Field monster zones: exactly 80x112 in size, in player area (top >= 700)
        if (rect.width >= 78 && rect.width <= 82 && rect.height >= 110 && rect.height <= 115) {
          monsters.push({
            text,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            cx: Math.round(rect.left + rect.width/2),
            cy: Math.round(rect.top + rect.height/2)
          });
        }
      }
    });
    
    return monsters;
  });
  
  console.log('\nField monster positions (exact 80x112):');
  fieldMonsters.forEach((m, i) => {
    console.log(`${i}: [${m.x}, ${m.y}] ${m.w}x${m.h} center=[${m.cx},${m.cy}] "${m.text.trim()}"`);
  });
  
  if (fieldMonsters.length > 0) {
    // Click on first field monster
    const monster = fieldMonsters[0];
    console.log(`\n=== CLICKING on field monster at [${monster.cx}, ${monster.cy}] ===`);
    console.log(`Monster: "${monster.text.trim()}"`);
    
    await page.mouse.click(monster.cx, monster.cy, { force: true });
    await page.waitForTimeout(2000);
    
    // Check for selection
    const state = await page.evaluate(() => {
      // Check for attack targets or selection highlight
      const highlights = document.querySelectorAll('[class*="ring"], [class*="border"], [class*="selected"]');
      return {
        highlightCount: highlights.length,
        highlightTexts: highlights.map(h => (h.textContent || '').replace(/\s+/g,' ').trim().slice(0,50))
      };
    });
    console.log('State after monster click:', JSON.stringify(state));
    
    // Check if there are opponent monsters to attack
    const oppMonsters = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const monsters = [];
      all.forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g,' ').trim();
        if (text.match(/^\s*[*]*\s*ATK\s*\d+\s*DEF\s*\d+\s*$/) && text.length < 50) {
          const rect = el.getBoundingClientRect();
          // Opponent field zone: top < 300, exactly 80x112
          if (rect.top >= 90 && rect.top <= 250 && rect.width >= 78 && rect.width <= 82) {
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
    
    console.log('Opponent monsters:', JSON.stringify(oppMonsters));
    
    if (oppMonsters.length > 0) {
      // Attack the first opponent monster
      const opp = oppMonsters[0];
      console.log(`\n=== ATTACKING opponent monster at [${opp.cx}, ${opp.cy}] ===`);
      await page.mouse.click(opp.cx, opp.cy, { force: true });
      await page.waitForTimeout(2000);
      
      // Check LP
      const text = await page.evaluate(() => document.body.innerText);
      const yugiLP = text.match(/Yugi.*?(\d+)\s*LP/);
      const playerLP = text.match(/Boss.*?(\d+)\s*LP/);
      console.log('Yugi LP:', yugiLP ? yugiLP[1] : 'not found');
      console.log('Player LP:', playerLP ? playerLP[1] : 'not found');
    } else {
      // No opponent monsters - try direct attack on Yugi
      console.log('No opponent monsters - trying direct attack at [400, 150]...');
      await page.mouse.click(400, 150, { force: true });
      await page.waitForTimeout(2000);
      
      const text = await page.evaluate(() => document.body.innerText);
      console.log('After direct attack:', text.slice(0, 300));
    }
  }
  
  await browser.close();
}

run().catch(console.error);