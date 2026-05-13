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
  
  // Now we're in M1
  console.log('Phase: M1');
  
  // Click END PHASE
  console.log('Clicking END PHASE...');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Now in BP - try to click on player monster
  console.log('Looking for player monsters to select...');
  
  // Get all elements with onclick or that are clickable in the player field
  const clickableInfo = await page.evaluate(() => {
    // Find the player field area - it should be the lower half of the screen
    // Look for elements with cursor:pointer that contain ATK text (monster cards)
    const all = document.querySelectorAll('*');
    const results = [];
    all.forEach((el, i) => {
      const style = window.getComputedStyle(el);
      const cursor = style.cursor;
      const text = el.textContent || '';
      if (cursor === 'pointer' && text.match(/ATK/) && text.length < 200) {
        const rect = el.getBoundingClientRect();
        results.push({
          tag: el.tagName,
          text: text.replace(/\s+/g,' ').slice(0,60),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          cursor
        });
      }
    });
    return results;
  });
  
  console.log('Clickable monster elements:', JSON.stringify(clickableInfo, null, 2));
  
  // Try clicking on one of the player monsters (those in lower half of screen)
  if (clickableInfo.length > 0) {
    // Sort by vertical position - lower = player side
    const sorted = clickableInfo.sort((a, b) => b.top - a.top);
    console.log('First clickable monster (bottom):', sorted[0]);
    
    // Click it
    const target = sorted[0];
    console.log(`Clicking at position (${target.left}, ${target.top})...`);
    await page.mouse.click(target.left + 40, target.top + 40); // center of element
    await page.waitForTimeout(1000);
    
    // Check if selectedMonster state changed
    const afterClick = await page.evaluate(() => {
      // Check for any selection visual feedback
      const selected = document.querySelectorAll('[class*="selected"], [class*="attack"]');
      return {
        selectedCount: selected.length,
        selectedText: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('After clicking monster:', JSON.stringify(afterClick));
    
    // Now try to click on opponent monster to attack
    const opponentMonsters = clickableInfo.filter(el => el.top < 300); // upper half
    console.log('Opponent monsters:', opponentMonsters.length);
    
    if (opponentMonsters.length > 0) {
      console.log('Clicking opponent monster to attack...');
      const opp = opponentMonsters[0];
      await page.mouse.click(opp.left + 40, opp.top + 40);
      await page.waitForTimeout(2000);
      
      // Check for error messages
      const errorText = await page.evaluate(() => {
        const errors = document.querySelectorAll('[class*="error"], [class*="Error"]');
        return Array.from(errors).map(e => e.textContent).join(' | ');
      });
      console.log('Error elements:', errorText);
    }
  }
  
  // Get current game state
  const gameState = await page.evaluate(() => {
    const text = document.body.innerText;
    // Extract LP values
    const lpMatch = text.match(/Boss.*?(\d+,?\d*)\s+LP/);
    const yugiMatch = text.match(/Yugi.*?(\d+,?\d*)\s+LP/);
    return {
      playerLP: lpMatch ? lpMatch[1] : 'not found',
      yugiLP: yugiMatch ? yugiMatch[1] : 'not found'
    };
  });
  console.log('Game state:', JSON.stringify(gameState));
  
  await browser.close();
}

run().catch(console.error);