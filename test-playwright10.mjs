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
  
  // Click on player monster card in field at [332, 852] (from earlier test data)
  console.log('Clicking player monster at [332, 852]...');
  await page.mouse.click(332, 852, { force: true });
  await page.waitForTimeout(2000);
  
  // Check what happened
  const afterSelect = await page.evaluate(() => {
    // Check for any selection state
    const bodyText = document.body.innerText;
    
    // Check if there's a message about "Select an attack target"
    const hasTargetMessage = bodyText.includes('target') || bodyText.includes('Target') || bodyText.includes('attack');
    
    // Check buttons 
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
    
    // Check if any card is highlighted
    const highlighted = document.querySelectorAll('[style*="ring"], [style*="border"]');
    
    return {
      bodySnippet: bodyText.slice(0, 400),
      buttons: buttons.slice(0, 10),
      hasTargetMessage
    };
  });
  console.log('After select:', JSON.stringify(afterSelect, null, 2));
  
  // Now try to attack - click on opponent's field (top area)
  console.log('Clicking opponent field at [400, 200]...');
  await page.mouse.click(400, 200, { force: true });
  await page.waitForTimeout(2000);
  
  // Check result - LP change?
  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.slice(0, 500);
  });
  console.log('Result:', result);
  
  // Also let me check: does the player actually HAVE monsters on the field?
  // Or are they all in hand?
  const gameStateCheck = await page.evaluate(() => {
    // Look at the field - count monster slots with content
    const fieldSlots = document.querySelectorAll('[class*="monster"]');
    const monsterContent = [];
    fieldSlots.forEach(slot => {
      const text = slot.textContent || '';
      if (text.match(/ATK/)) {
        monsterContent.push(text.replace(/\s+/g,' ').trim().slice(0,60));
      }
    });
    
    // Count player hand cards
    const handMatch = document.body.innerText.match(/YOUR HAND \((\d+)\)/);
    
    // Count opponent hand cards (hidden as ?)
    const oppHandMatch = document.body.innerText.match(/OPPONENT'S HAND.*?(\d+)/);
    
    return {
      monsterContent,
      playerHand: handMatch ? handMatch[1] : 'not found',
      opponentHand: oppHandMatch ? oppHandMatch[1] : 'not found'
    };
  });
  console.log('Game state check:', JSON.stringify(gameStateCheck));
  
  await browser.close();
}

run().catch(console.error);