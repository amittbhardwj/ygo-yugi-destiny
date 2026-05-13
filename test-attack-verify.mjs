import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    if (msg.text().includes('handleMonsterClick') || msg.text().includes('[HGE]')) {
      console.log('[CONSOLE]', msg.text());
    }
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
  
  // Get field monster position
  const fmPos = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top >= 500 && rect.top < 750) {
        return { cx: Math.round(rect.left + rect.width/2), cy: Math.round(rect.top + rect.height/2), text: text.replace(/\s+/g,' ').trim().slice(0, 40) };
      }
    }
    return null;
  });
  
  if (fmPos) {
    console.log(`\n=== CLICKING MONSTER at [${fmPos.cx}, ${fmPos.cy}]: "${fmPos.text}" ===`);
    await page.mouse.click(fmPos.cx, fmPos.cy, { force: true });
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
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);