import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    const text = msg.text();
    console.log('[LOG]', text);
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('Waiting for AI turn...');
  await page.waitForTimeout(25000);
  
  // Summon
  const cardLocator = page.locator('div.relative').filter({ hasText: /★.*ATK/ }).first();
  await cardLocator.dblclick({ timeout: 5000 });
  await page.waitForTimeout(1000);
  
  const hasSummon = await page.evaluate(() => {
    return !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUMMON'));
  });
  if (hasSummon) {
    await page.click('button:has-text("SUMMON")');
    await page.waitForTimeout(2000);
  }
  
  // Go to BP
  await page.click('button:has-text("END PHASE")');
  await page.waitForTimeout(2000);
  
  console.log('\n=== IN BP ===');
  
  // Get player monster position
  const playerMonster = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/★+.*ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top > 500 && rect.top < 750) {
        return {
          text: text.replace(/\s+/g,' ').trim().slice(0, 40),
          cx: Math.round(rect.left + rect.width/2),
          cy: Math.round(rect.top + rect.height/2),
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        };
      }
    }
    return null;
  });
  
  console.log('Player monster:', JSON.stringify(playerMonster));
  
  if (playerMonster) {
    const pm = playerMonster;
    console.log(`Clicking player monster at [${pm.cx}, ${pm.cy}]...`);
    await page.mouse.click(pm.cx, pm.cy, { force: true });
    await page.waitForTimeout(3000);
    
    const oppMonster = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') continue;
        const text = el.textContent || '';
        if (!text.match(/★+.*ATK.*DEF/)) continue;
        
        const rect = el.getBoundingClientRect();
        if (rect.top < 400 && rect.top > 250) {
          return {
            cx: Math.round(rect.left + rect.width/2),
            cy: Math.round(rect.top + rect.height/2),
            text: text.replace(/\s+/g,' ').trim().slice(0, 30)
          };
        }
      }
      return null;
    });
    
    if (oppMonster) {
      console.log(`\nClicking opponent monster at [${oppMonster.cx}, ${oppMonster.cy}]: "${oppMonster.text}"...`);
      await page.mouse.click(oppMonster.cx, oppMonster.cy, { force: true });
      await page.waitForTimeout(2000);
    }
    
    // Check LP
    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      const yugiLP = text.match(/Yugi.*?(\d+)\s+LP/);
      const bossLP = text.match(/BOSS.*?(\d+)\s+LP/);
      return { yugiLP: yugiLP ? yugiLP[1] : 'N/A', bossLP: bossLP ? bossLP[1] : 'N/A' };
    });
    console.log('LP:', JSON.stringify(result));
    
    if (result.yugiLP !== 'N/A' && parseInt(result.yugiLP) < 4000) {
      console.log('\n🎉 ATTACK WORKED! Yugi LP:', result.yugiLP);
    }
  }
  
  await browser.close();
}

run().catch(console.error);