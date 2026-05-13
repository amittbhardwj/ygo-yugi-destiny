import { chromium } from 'playwright';

const URL = 'https://ygo-yugi-destiny-production.up.railway.app';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  
  page.on('console', msg => console.log('[CONSOLE]', msg.text()));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder*="name"]', 'Boss');
  await page.click('button:has-text("Play vs Yugi")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Start Duel")');
  
  console.log('=== TURN 1: Waiting for AI ===');
  await page.waitForTimeout(18000);
  
  // Find the card element with the actual onclick handler
  const cardInfo = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const style = window.getComputedStyle(el);
      if (style.cursor !== 'pointer') continue;
      const text = el.textContent || '';
      if (!text.match(/ATK.*DEF/)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.top < 780 || rect.width < 70 || rect.height < 100) continue;
      
      // Found a hand card
      return {
        cx: Math.round(rect.left + rect.width/2),
        cy: Math.round(rect.top + rect.height/2),
        tag: el.tagName,
        class: el.className.split(' ')[0],
        hasOnClick: typeof el.onclick === 'function',
        hasAttributeOnClick: el.hasAttribute('onclick'),
        text: text.slice(0, 40)
      };
    }
    return null;
  });
  
  console.log('Card info:', JSON.stringify(cardInfo));
  
  if (cardInfo) {
    const { cx, cy } = cardInfo;
    
    // Method 1: Use page.locator with exact text to find and click
    console.log('\n=== Method 1: page.locator with text ===');
    const locator = page.locator('div.relative').filter({ hasText: /ATK.*DEF/ }).nth(0);
    if (await locator.count() > 0) {
      const box = await locator.boundingBox();
      console.log('Locator box:', box);
      
      // Double click using locator
      await locator.dblclick();
      await page.waitForTimeout(800);
      
      const modal1 = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return {
          hasSummon: !!buttons.find(b => b.textContent.includes('Summon')),
          buttons: buttons.map(b => b.textContent.trim()).slice(0, 5)
        };
      });
      console.log('Modal after locator dblclick:', JSON.stringify(modal1));
    }
    
    if (!modal1?.hasSummon) {
      // Method 2: Direct evaluate to call the element's onclick
      console.log('\n=== Method 2: Direct onclick dispatch ===');
      
      const result = await page.evaluate(() => {
        // Find the card div with onclick
        const all = document.querySelectorAll('div.relative');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (style.cursor !== 'pointer') continue;
          const text = el.textContent || '';
          if (!text.match(/ATK.*DEF/) || text.length < 50) continue;
          
          const rect = el.getBoundingClientRect();
          if (rect.top < 780) continue;
          
          // Check if this element has React fiber (meaning it's a React element)
          const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
          if (!fiberKey) continue;
          
          return {
            found: true,
            tag: el.tagName,
            class: el.className.split(' ')[0],
            hasOnClick: typeof el.onclick === 'function',
            text: text.slice(0, 30)
          };
        }
        return { found: false };
      });
      console.log('Card element:', JSON.stringify(result));
      
      if (result.found) {
        // Simulate two clicks rapidly to trigger double-tap
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(80);
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(500);
        
        const modal2 = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return {
            hasSummon: !!buttons.find(b => b.textContent.includes('Summon')),
            buttons: buttons.map(b => b.textContent.trim()).filter(t => ['Summon', 'Set', 'Cancel'].includes(t))
          };
        });
        console.log('Modal after 2 rapid clicks:', JSON.stringify(modal2));
      }
    }
  }
  
  await browser.close();
}

run().catch(console.error);