import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    console.log('[CONSOLE]', msg.text());
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('=== TURN 1: Waiting for AI ===');
  await page.waitForTimeout(18000);
  
  // Summon
  console.log('\n=== SUMMONING ===');
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("SUMMON")');
  await page.waitForTimeout(2000);
  
  // Go to BP
  console.log('=== GOING TO BP ===');
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  console.log('\n=== Clicking player field monster using LOCATOR ===');
  
  // Use locator to find and click the player field monster (y < 750 means player field)
  const playerFieldMonsters = page.locator('div.relative').filter({ hasText: /★.*ATK/ });
  
  const count = await playerFieldMonsters.count();
  console.log('Total monster cards with ★ and ATK:', count);
  
  if (count > 0) {
    // Get all positions to find player field monsters (y < 750)
    const positions = await page.evaluate(() => {
      const result = [];
      const all = document.querySelectorAll('div.relative');
      all.forEach(el => {
        const text = el.textContent || '';
        if (!text.match(/★.*ATK.*DEF/)) return;
        const rect = el.getBoundingClientRect();
        result.push({ text: text.replace(/\s+/g,' ').trim().slice(0,30), y: Math.round(rect.top), x: Math.round(rect.left) });
      });
      return result;
    });
    console.log('All monster positions:', JSON.stringify(positions));
    
    // Filter to player field monsters (y < 750) and click the first one
    const playerMonsters = positions.filter(p => p.y < 750);
    console.log('Player field monsters:', JSON.stringify(playerMonsters));
    
    if (playerMonsters.length > 0) {
      // Click using Playwright locator - this finds the element and clicks it properly
      console.log(`\nClicking: "${playerMonsters[0].text}" at y=${playerMonsters[0].y}`);
      
      // Use locator with filter to target specific monster
      const monsterLocator = page.locator('div.relative').filter({ hasText: playerMonsters[0].text.split(' ')[0] }).first();
      await monsterLocator.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      
      const attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return {
          count: highlighted.length,
          texts: Array.from(highlighted).map(h => h.textContent.replace(/\s+/g,' ').slice(0,50))
        };
      });
      console.log('Attack state:', JSON.stringify(attackState));
      
      if (attackState.count > 0) {
        console.log('\n=== ATTACKING OPPONENT ===');
        await page.mouse.click(400, 200, { force: true });
        await page.waitForTimeout(2000);
        
        const result = await page.evaluate(() => {
          const text = document.body.innerText;
          const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
          const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
          return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', bossLP: bossLP ? bossLP[1] : 'N/A' };
        });
        console.log('LP after attack:', JSON.stringify(result));
        
        if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
          console.log('\n🎉 ATTACK SUCCESSFUL!');
        }
      }
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);