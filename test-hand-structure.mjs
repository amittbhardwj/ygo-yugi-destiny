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
  
  // Check the actual HTML structure of the hand area
  const handStructure = await page.evaluate(() => {
    // Find the hand area
    const handArea = document.querySelector('.player-hand-area');
    if (!handArea) return { error: 'no .player-hand-area found' };
    
    const rect = handArea.getBoundingClientRect();
    const info = {
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      text: handArea.textContent?.slice(0, 200)
    };
    
    // Get all descendants with their positions
    const descendants = [];
    const allEls = handArea.querySelectorAll('*');
    allEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 30 && r.height > 30) {
        descendants.push({
          tag: el.tagName,
          class: el.className.split(' ')[0],
          text: (el.textContent || '').replace(/\s+/g,' ').trim().slice(0,50),
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height)
        });
      }
    });
    
    return { info, descendants };
  });
  
  console.log('Hand structure:', JSON.stringify(handStructure, null, 2));
  
  // Get all elements in the entire document with cursor:pointer and ATK text
  const allClickable = await page.evaluate(() => {
    const result = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') return;
      const text = (el.textContent || '');
      if (!text.match(/ATK/)) return;
      
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 20) return;
      
      result.push({
        tag: el.tagName,
        class: el.className.split(' ')[0],
        text: text.replace(/\s+/g,' ').trim().slice(0, 60),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      });
    });
    return result;
  });
  
  console.log('\nAll clickable elements with ATK:', JSON.stringify(allClickable.slice(0, 15), null, 2));
  
  await browser.close();
}

run().catch(console.error);