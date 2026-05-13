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
  
  // Check what element is at the monster position
  const elementCheck = await page.evaluate(() => {
    // Try clicking at the field monster position
    const elements = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const rect = el.getBoundingClientRect();
      // Check if element is in the player field area (y 600-700)
      if (rect.top >= 600 && rect.top < 700 && rect.width > 60) {
        const style = window.getComputedStyle(el);
        elements.push({
          tag: el.tagName,
          class: el.className.split(' ')[0],
          text: (el.textContent || '').slice(0, 30),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          pointerEvents: style.pointerEvents,
          cursor: style.cursor
        });
      }
    }
    return elements;
  });
  console.log('Elements in field area:', JSON.stringify(elementCheck, null, 2));
  
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
    console.log(`\n=== CLICKING at [${fmPos.cx}, ${fmPos.cy}] ===`);
    
    // Check what element is at this exact point
    const elementAtPoint = await page.evaluate((pos) => {
      const el = document.elementFromPoint(pos.cx, pos.cy);
      if (!el) return { error: 'no element' };
      
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
      
      return {
        tag: el.tagName,
        class: el.className.split(' ')[0],
        text: (el.textContent || '').slice(0, 40),
        pointerEvents: window.getComputedStyle(el).pointerEvents,
        hasReactFiber: !!fiberKey,
        hasOnClick: typeof el.onclick === 'function'
      };
    }, fmPos);
    
    console.log('Element at click point:', JSON.stringify(elementAtPoint, null, 2));
    
    // Try clicking using the element directly 
    if (elementAtPoint.hasReactFiber) {
      console.log('Clicking via element.click()...');
      await page.evaluate((pos) => {
        const el = document.elementFromPoint(pos.cx, pos.cy);
        if (el) el.click();
      }, fmPos);
      await page.waitForTimeout(2000);
      
      const attackState = await page.evaluate(() => {
        const highlighted = document.querySelectorAll('[class*="selected"], [class*="ring"], [class*="target"]');
        return { count: highlighted.length };
      });
      console.log('Attack state after el.click():', JSON.stringify(attackState));
    }
  }
  
  await browser.close();
  console.log('\n=== DONE ===');
}

run().catch(console.error);