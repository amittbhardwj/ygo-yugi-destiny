import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture ALL console messages
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Capture socket.io frames via websocket
  const socketFrames = [];
  page.on('websocket', ws => {
    ws.on('framesent', frame => {
      try { socketFrames.push('SENT:' + JSON.parse(frame).join ? JSON.parse(frame).join('') : frame); } catch { socketFrames.push('SENT:' + frame.toString().slice(0,200)); }
    });
    ws.on('framereceived', frame => {
      try { socketFrames.push('RECV:' + JSON.parse(frame).join ? JSON.parse(frame).join('') : frame); } catch { socketFrames.push('RECV:' + frame.toString().slice(0,200)); }
    });
  });

  console.log('Opening game...');
  await page.goto(URL, { waitUntil: 'networkidle' });
  
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  // Wait for AI to complete its turn (up to 15s)
  console.log('Waiting for AI turn to complete...');
  await page.waitForTimeout(12000);
  
  // Now we're in our turn - check phase
  const phaseState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const phaseBtns = btns.filter(b => ['DP','SP','M1','BP','M2','EP'].some(p => b.textContent.trim() === p));
    const active = phaseBtns.find(b => b.className.includes('phase-active'));
    return {
      buttons: phaseBtns.map(b => b.textContent.trim() + ' disabled=' + b.disabled).join(' | '),
      activePhase: active ? active.textContent.trim() : 'none'
    };
  });
  console.log('Phase state after AI turn:', JSON.stringify(phaseState));
  
  // Click END PHASE to go to BP
  console.log('Clicking END PHASE...');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(1500);
  
  const bpState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bp = btns.find(b => b.textContent.trim() === 'BP');
    return bp ? 'BP disabled=' + bp.disabled : 'not found';
  });
  console.log('After END PHASE:', bpState);
  
  // Get all event lines from logs
  const eventLogs = logs.filter(l => l.includes('[HGE]') || l.includes('[PB]') || l.includes('[HP]') || l.includes('turn_start') || l.includes('game_state'));
  console.log('\n=== EVENT LOGS ===');
  eventLogs.forEach(l => console.log(l));
  
  console.log('\n=== SOCKET FRAMES ===');
  socketFrames.forEach(f => console.log(f));
  
  // Check deck count
  const deckCount = await page.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/YOUR HAND.*?(\d+)\s+DECK/);
    return m ? m[1] : 'not found';
  });
  console.log('\nPlayer deck count:', deckCount);
  
  // Try to find player monster cards  
  const playerMonsters = await page.evaluate(() => {
    // Find all elements that look like monster cards in the player field area
    const allElements = document.querySelectorAll('*');
    const monsters = [];
    allElements.forEach(el => {
      const text = el.textContent || '';
      if (text.match(/ATK\s*\d+/) && text.match(/DEF\s*\d+/) && text.length < 300 && text.length > 20) {
        // Check if this is in the player field area
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {top: 0};
        if (rect.top > 300) { // Lower part of screen = player field
          monsters.push(text.replace(/\s+/g,' ').slice(0,80));
        }
      }
    });
    return monsters.slice(0, 5);
  });
  console.log('Player monsters found:', playerMonsters);
  
  await browser.close();
}

run().catch(console.error);