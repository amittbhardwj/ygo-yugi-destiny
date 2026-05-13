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
  await page.waitForTimeout(3000);
  
  // Inject click tracking before clicking
  await page.evaluate(() => {
    window._clickLog = [];
    
    // Add listeners to the specific divs we care about
    const playerMonsters = document.querySelectorAll('div.relative.cursor-pointer');
    playerMonsters.forEach(div => {
      const text = div.textContent || '';
      if (text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80) {
        div.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[MONSTER CLICK]', text.trim().slice(0,40), 'at', e.clientX, e.clientY);
          window._clickLog.push({text: text.trim().slice(0,40), x: e.clientX, y: e.clientY});
        }, true);
      }
    });
    
    // Also check what element is actually at the click coordinates
    document.addEventListener('click', (e) => {
      console.log('[DOC CLICK]', e.target.tagName, e.target.className.split(' ')[0], 'at', e.clientX, e.clientY);
    }, true);
  });
  
  // Find player monster positions
  const monsterPositions = await page.evaluate(() => {
    const cards = document.querySelectorAll('div.relative.cursor-pointer');
    return Array.from(cards)
      .filter(c => {
        const text = c.textContent || '';
        return text.match(/ATK\s*\d+\s*DEF\s*\d+/) && text.length < 80;
      })
      .map(c => ({
        text: c.textContent.replace(/\s+/g,' ').trim().slice(0,40),
        cx: Math.round(c.getBoundingClientRect().left + c.getBoundingClientRect().width/2),
        cy: Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height/2)
      }));
  });
  
  console.log('Monster positions:', JSON.stringify(monsterPositions));
  
  if (monsterPositions.length > 0) {
    const monster = monsterPositions[0];
    console.log(`\n=== CLICKING monster at [${monster.cx}, ${monster.cy}]: "${monster.text}" ===`);
    
    // Click with dispatchEvent to ensure it goes through
    await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.x, pos.y);
      if (el) {
        console.log('Element at click point:', el.tagName, el.className.split(' ')[0]);
        el.click();
      }
    }, { x: monster.cx, y: monster.cy });
    
    await page.waitForTimeout(2000);
    
    // Check click log
    const clickLog = await page.evaluate(() => window._clickLog || []);
    console.log('Click log:', JSON.stringify(clickLog));
    
    // Check state
    const state = await page.evaluate(() => {
      const selected = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="border-yellow"]');
      return {
        count: selected.length,
        texts: Array.from(selected).map(s => s.textContent.replace(/\s+/g,' ').slice(0,50))
      };
    });
    console.log('Selected state:', JSON.stringify(state));
  }
  
  await browser.close();
}

run().catch(console.error);