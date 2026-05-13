import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[HGE]') || text.includes('[handle') || text.includes('[PB]') || text.includes('BP')) {
      logs.push(text);
    }
  });

  // Capture network requests to see socket events
  const socketEvents = [];
  page.on('websocket', ws => {
    ws.on('framesent', frame => {
      try {
        const data = JSON.parse(frame);
        socketEvents.push(`SENT: ${JSON.stringify(data).slice(0,100)}`);
      } catch {}
    });
    ws.on('framereceived', frame => {
      try {
        const data = JSON.parse(frame);
        socketEvents.push(`RECV: ${JSON.stringify(data).slice(0,100)}`);
      } catch {}
    });
  });

  console.log('1. Navigating to', URL);
  await page.goto(URL, { waitUntil: 'networkidle' });
  
  console.log('2. Entering name');
  await page.fill('input[placeholder*="name"]', 'Boss');
  
  console.log('3. Clicking Play vs Yugi');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(500);
  
  console.log('4. Clicking Start Duel');
  await page.click('button:has-text("Start Duel")');
  await page.waitForTimeout(3000); // wait for game to initialize + AI to act
  
  // Check phase after initialization
  const phaseAfterInit = await page.evaluate(() => {
    const bpBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BP'));
    return bpBtn ? bpBtn.disabled : 'not found';
  });
  console.log('BP button disabled after init:', phaseAfterInit);
  
  // Get current phase from UI
  const phaseInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const phaseBtns = btns.filter(b => ['DP','SP','M1','BP','M2','EP'].some(p => b.textContent.trim().includes(p)));
    return phaseBtns.map(b => b.textContent.trim() + ' disabled=' + b.disabled).join(' | ');
  });
  console.log('Phase buttons:', phaseInfo);
  
  // Check if it's our turn
  const endPhaseActive = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ep = btns.find(b => b.textContent.includes('END PHASE'));
    return ep ? ep.className.includes('active') : false;
  });
  console.log('END PHASE active:', endPhaseActive);
  
  // Wait for turn to come to us (AI finishes its turn)
  console.log('5. Waiting for AI turn to complete...');
  await page.waitForTimeout(8000);
  
  // Check state again
  const state2 = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const phaseBtns = btns.filter(b => ['DP','SP','M1','BP','M2','EP'].some(p => b.textContent.trim().includes(p)));
    return phaseBtns.map(b => b.textContent.trim() + ' disabled=' + b.disabled).join(' | ');
  });
  console.log('Phase after AI turn:', state2);
  
  // Check deck count
  const deckInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const deckMatch = text.match(/DECK\s+(\d+)/);
    return deckMatch ? deckMatch[1] : 'not found';
  });
  console.log('Player deck count:', deckInfo);
  
  // Click END PHASE to advance to BP
  console.log('6. Clicking END PHASE...');
  const epBtn = await page.$('button:has-text("END PHASE")');
  if (epBtn) {
    await epBtn.click();
    await page.waitForTimeout(1000);
  }
  
  // Check if we're in BP now
  const bpState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.includes('BP'));
    return bp ? 'BP disabled=' + bp.disabled : 'not found';
  });
  console.log('After END PHASE click:', bpState);
  
  // Now try to attack - first select a player monster
  console.log('7. Selecting player monster...');
  const playerMonsters = await page.$$('[class*="monster-zone"] [class*="card"], [class*="player-field"] [class*="card"]');
  
  // Find clickable monster cards in player field
  const playerFieldCards = await page.evaluate(() => {
    // Look for monster cards in player field area
    const allCards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    const info = [];
    allCards.forEach((c, i) => {
      const text = c.textContent || '';
      if (text.match(/ATK/) && text.length < 200) {
        info.push(i + ':' + text.slice(0,30).replace(/\s+/g,' '));
      }
    });
    return info.slice(0, 10);
  });
  console.log('Player field cards:', playerFieldCards.join(' | '));
  
  console.log('\n--- Console logs with relevant events ---');
  logs.forEach(l => console.log(l));
  
  console.log('\n--- Socket events (first 20) ---');
  socketEvents.slice(0, 20).forEach(e => console.log(e));
  
  await browser.close();
}

run().catch(console.error);