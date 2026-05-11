import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const allLogs = [];
page.on('pageerror', err => allLogs.push('[PAGE ERROR] ' + err.message));
page.on('console', msg => allLogs.push('[' + msg.type() + '] ' + msg.text()));

// Intercept socket.io packets using request interceptor
let wsMessages = [];
await page.route('**', async route => {
  await route.continue();
});

// Alternative: evaluate before page loads to intercept
await page.addInitScript(() => {
  // Override the socket.io parser to capture all events
  window.__capturedEvents = [];
  
  // Intercept all postMessage to capture socket.io
  const originalPostMessage = window.postMessage;
  window.postMessage = function(data, origin) {
    if (typeof data === 'string' && data.includes('engine')) {
      window.__capturedEvents.push({type: 'postMessage', data});
    }
    return originalPostMessage.apply(this, arguments);
  };
});

await page.goto('https://ygo-yugi-destiny-production.up.railway.app/');
await new Promise(r => setTimeout(r, 3000));

// Now start the game
await page.fill('input[placeholder="Enter your name..."]', 'Amitt');
await new Promise(r => setTimeout(r, 1000));
await page.locator('button:has-text("Play vs Yugi")').click();
await new Promise(r => setTimeout(r, 500));
await page.locator('button:has-text("Start Duel")').click();

// Wait for game events
await new Promise(r => setTimeout(r, 6000));

// Print all logs
console.log('\n=== ALL CONSOLE LOGS ===');
allLogs.forEach(l => console.log(l));

// Check captured events
const captured = await page.evaluate(() => window.__capturedEvents);
console.log('\n=== CAPTURED EVENTS ===');
console.log(JSON.stringify(captured, null, 2));

const bodyText = await page.locator('body').textContent();
console.log('\n--- BODY ---');
console.log('Your Hand (0 cards):', bodyText.includes('Your Hand (0 cards)'));
console.log('Your Hand (5 cards):', bodyText.includes('Your Hand (5 cards)'));

await browser.close();
process.exit(0);