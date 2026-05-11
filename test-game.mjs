import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

// Use fresh context (no shared state)
const context = await browser.newContext();
const page = await context.newPage();

const allLogs = [];
page.on('pageerror', err => allLogs.push('PAGE_ERR: ' + err.message));
page.on('console', msg => allLogs.push(msg.type() + ': ' + msg.text()));
page.on('request', req => {
  if (req.url().includes('socket.io')) {
    // Only log if not already covered by console
  }
});

console.log('Loading page...');
await page.goto('https://ygo-yugi-destiny-production.up.railway.app/', { waitUntil: 'networkidle' });
console.log('Page loaded');

await new Promise(r => setTimeout(r, 3000));

// Fill name
await page.locator('input[placeholder="Enter your name..."]').fill('Amitt');
await new Promise(r => setTimeout(r, 1000));

// Click Play vs Yugi
await page.locator('button:has-text("Play vs Yugi")').click();
console.log('Clicked Play vs Yugi');
await new Promise(r => setTimeout(r, 800));

// Click Start Duel
await page.locator('button:has-text("Start Duel")').click();
console.log('Clicked Start Duel');
await new Promise(r => setTimeout(r, 8000));

// Print ALL logs
console.log('\n========== ALL CONSOLE LOGS ==========');
allLogs.forEach(l => console.log(l));
console.log('========== END LOGS ==========');

const bodyText = await page.locator('body').textContent();
console.log('\n========== BODY CHECK ==========');
console.log('Your Hand (0 cards):', bodyText.includes('Your Hand (0 cards)'));
console.log('Your Hand (5 cards):', bodyText.includes('Your Hand (5 cards)'));

await browser.close();
process.exit(0);