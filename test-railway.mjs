import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('pageerror', err => { logs.push('[PAGE ERROR] ' + err.message); console.log('[PAGE ERROR]', err.message); });
  page.on('console', msg => {
    const text = '[' + msg.type() + '] ' + msg.text();
    console.log(text);
    logs.push(text);
  });

  console.log('Loading Railway...');
  await page.goto('https://ygo-yugi-destiny-production.up.railway.app/', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Check current script tag
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[crossorigin]')).map(s => s.src);
  });
  console.log('Scripts:', scripts);

  // Check for build marker
  const hasMarker = await page.evaluate(() => {
    return document.body.textContent.includes('abc123xyz');
  });
  console.log('Has build marker (abc123xyz):', hasMarker);

  await page.locator('input[placeholder="Enter your name..."]').fill('TestPlayer');
  await new Promise(r => setTimeout(r, 1000));
  await page.locator('button:has-text("Play vs Yugi")').click();
  await new Promise(r => setTimeout(r, 1000));
  await page.locator('button:has-text("Start Duel")').click();
  await new Promise(r => setTimeout(r, 10000));

  const body = await page.locator('body').textContent();
  console.log('\n=== BODY ===');
  console.log(body.substring(0, 300));
  console.log('Hand (0 cards):', body.includes('Hand (0 cards)'));
  console.log('Dark Magician:', body.includes('Dark Magician'));

  const hgeLogs = logs.filter(l => l.includes('[HGE]'));
  console.log('\n[HGE] logs:', hgeLogs.length);
  hgeLogs.forEach(l => console.log(l));

  const socketLogs = logs.filter(l => l.includes('[Socket]') || l.includes('Game event'));
  console.log('\nSocket logs:', socketLogs.length);
  socketLogs.forEach(l => console.log(l));

  await browser.close();
  process.exit(0);
})();