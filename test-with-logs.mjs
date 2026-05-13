import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => {
    if (msg.text().includes('handleMonsterClick') || msg.text().includes('[HGE]') || msg.text().includes('[PB]')) {
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
  
  // Click player field monster
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
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);