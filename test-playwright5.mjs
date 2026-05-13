import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('[CONSOLE]', msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  // Wait for AI turn
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(15000);
  
  // Check if game is still accessible
  const canContinue = await page.evaluate(() => {
    return document.querySelectorAll('button').length > 5;
  });
  console.log('Game still accessible:', canContinue);
  
  if (!canContinue) {
    console.log('Game ended or error occurred');
    await browser.close();
    return;
  }
  
  // Advance to BP
  console.log('Clicking END PHASE...');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  // Verify we're in BP
  const bpEnabled = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.trim() === 'BP');
    return bp ? !bp.disabled : false;
  });
  console.log('In Battle Phase:', bpEnabled);
  
  if (!bpEnabled) {
    console.log('Could not enter BP, trying to find different approach...');
    
    // Check current phase from turn_start events
    const turnStartEvents = await page.evaluate(() => {
      return window.__turnEvents || [];
    });
    console.log('Turn events:', JSON.stringify(turnStartEvents.slice(-3)));
    
    await browser.close();
    return;
  }
  
  // Inject debug into socket to see attack events
  await page.evaluate(() => {
    // Monkey-patch socket to log outgoing events
    const origEmit = window.socket?.emit;
    if (window.socket) {
      window.socket.emit = function(event, data) {
        console.log('[SOCKET EMIT]', event, JSON.stringify(data).slice(0,200));
        return origEmit.call(this, event, data);
      };
    }
    
    // Also log click events on cards
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[class*="card"], [class*="Card"]');
      if (el) {
        console.log('[CLICK] on card element:', el.className, el.textContent.replace(/\s+/g,' ').slice(0,60));
      }
    }, true);
  });
  
  // Now try to click player monster - use data attributes if available
  const clickResult = await page.evaluate(() => {
    // Find monster cards in player field by looking for elements with card data
    // These are usually rendered by Field.jsx → Card.jsx
    const allCards = document.querySelectorAll('[class*="card"]');
    let playerMonster = null;
    let opponentMonster = null;
    
    allCards.forEach(card => {
      const text = card.textContent || '';
      if (text.match(/ATK/) && !text.includes('YOUR HAND')) {
        // Determine which field based on position
        const rect = card.getBoundingClientRect();
        if (rect.top > 500 && !playerMonster) {
          playerMonster = card;
        } else if (rect.top < 300 && !opponentMonster) {
          opponentMonster = card;
        }
      }
    });
    
    if (playerMonster) {
      playerMonster.click();
      return {
        clicked: playerMonster.textContent.replace(/\s+/g,' ').slice(0,80),
        rect: playerMonster.getBoundingClientRect()
      };
    }
    return null;
  });
  
  console.log('Click result:', JSON.stringify(clickResult));
  await page.waitForTimeout(2000);
  
  // Now try to attack - find opponent monster
  const attackResult = await page.evaluate(() => {
    // Look for opponent monster to click as attack target
    const allCards = document.querySelectorAll('[class*="card"]');
    let opponentMonster = null;
    
    allCards.forEach(card => {
      const text = card.textContent || '';
      if (text.match(/ATK/) && !text.includes('YOUR HAND')) {
        const rect = card.getBoundingClientRect();
        if (rect.top < 300 && rect.top > 100) {
          opponentMonster = card;
        }
      }
    });
    
    if (opponentMonster) {
      // Check if we're in attack mode (should see highlight)
      const highlighted = document.querySelectorAll('[class*="target"], [class*="attackable"], [class*="selected"]');
      console.log('[ATTACK MODE] highlighted elements:', highlighted.length);
      
      opponentMonster.click();
      return {
        attacked: opponentMonster.textContent.replace(/\s+/g,' ').slice(0,80),
        rect: opponentMonster.getBoundingClientRect()
      };
    }
    
    // If no opponent monster, try direct attack
    // Look for opponent's field area
    const opponentField = document.querySelector('[class*="opponent"], [class*="enemy"]');
    return { noTarget: true, opponentField: opponentField ? 'found' : 'not found' };
  });
  
  console.log('Attack result:', JSON.stringify(attackResult));
  await page.waitForTimeout(2000);
  
  // Check game state
  const finalState = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  // Extract LP values
  const lpMatch = finalState.match(/Yugi.*?LP.*?(\d+)/);
  const playerLP = finalState.match(/Boss.*?LP.*?(\d+)/);
  
  console.log('Yugi LP:', lpMatch ? lpMatch[1] : 'not found');
  console.log('Player LP:', playerLP ? playerLP[1] : 'not found');
  
  // Check if game continued or ended
  const hasEndButton = finalState.includes('END PHASE') || finalState.includes('END TURN');
  console.log('Has phase buttons:', hasEndButton);
  
  await browser.close();
}

run().catch(console.error);