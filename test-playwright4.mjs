import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HGE]') || text.includes('[handle') || text.includes('attack')) {
      console.log('[CONSOLE]', text);
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  // Wait for AI to complete its turn  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(12000);
  
  // Now in M1 - click END PHASE
  console.log('Clicking END PHASE...');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Now in BP - get all clickable elements in the game
  const allInfo = await page.evaluate(() => {
    // Get ALL clickable elements with their position and text
    const all = document.querySelectorAll('*');
    const results = [];
    all.forEach((el, i) => {
      const style = window.getComputedStyle(el);
      const cursor = style.cursor;
      if (cursor === 'pointer' && el.textContent.trim().length > 0) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) { // filter tiny elements
          results.push({
            tag: el.tagName,
            classes: el.className,
            text: el.textContent.replace(/\s+/g,' ').trim().slice(0,80),
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      }
    });
    return results;
  });
  
  // Categorize by vertical position
  const topHalf = allInfo.filter(e => e.top < 500);
  const bottomHalf = allInfo.filter(e => e.top >= 500);
  
  console.log('\n=== TOP HALF (Opponent side) ===');
  topHalf.forEach(e => console.log(`${e.tag} [${e.top},${e.left}] "${e.text}"`));
  
  console.log('\n=== BOTTOM HALF (Player side) ===');
  bottomHalf.forEach(e => console.log(`${e.tag} [${e.top},${e.left}] "${e.text}"`));
  
  // Try clicking on a player monster card in the bottom half
  // Look for element with ATK text in bottom half
  const playerMonsterCards = bottomHalf.filter(e => e.text.includes('ATK') && e.height > 80 && e.width > 60);
  console.log('\nPlayer monster cards:', playerMonsterCards.length);
  
  if (playerMonsterCards.length > 0) {
    // Click on the first one to select it
    const target = playerMonsterCards[0];
    console.log(`\nClicking player monster: "${target.text.slice(0,50)}" at [${target.top}, ${target.left}]`);
    
    await page.mouse.click(target.left + target.width/2, target.top + target.height/2);
    await page.waitForTimeout(1500);
    
    // Check for attack targets (opponent monsters should now be clickable)
    const targetsInfo = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      const targets = [];
      all.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.cursor === 'pointer') {
          const text = el.textContent;
          if (text.match(/ATK.*DEF/) && text.length < 200 && text.length > 20) {
            const rect = el.getBoundingClientRect();
            targets.push({
              text: text.replace(/\s+/g,' ').slice(0,60),
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              w: Math.round(rect.width),
              h: Math.round(rect.height)
            });
          }
        }
      });
      return targets;
    });
    
    console.log('\nAttack targets found:', targetsInfo.length);
    targetsInfo.forEach(t => console.log(`  [${t.top}] "${t.text}"`));
    
    if (targetsInfo.length > 0) {
      // Try to attack the first target
      const target = targetsInfo.find(t => t.top < 500) || targetsInfo[0];
      console.log(`\nClicking attack target: "${target.text}" at [${target.top}, ${target.left}]`);
      await page.mouse.click(target.left + target.w/2, target.top + target.h/2);
      await page.waitForTimeout(2000);
    }
  }
  
  // Check LP to see if damage was dealt
  const gameState = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  const lpMatch = gameState.match(/Yugi.*?(\d+,?\d*)\s*LP/);
  console.log('\nYugi LP:', lpMatch ? lpMatch[1] : 'not found');
  
  await browser.close();
}

run().catch(console.error);