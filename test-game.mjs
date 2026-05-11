import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
page.on('console', msg => {
  const text = msg.text();
  // Only show socket/turn/game related logs
  if (text.includes('[log]') || text.includes('[error]')) {
    console.log(text);
  }
});

// Intercept WebSocket messages to see what's actually coming from server
await page.addInitScript(() => {
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    console.log('[WS SEND]', data);
    return originalSend.call(this, data);
  };
  
  // Capture incoming messages
  const originalOnMessage = WebSocket.prototype.onmessage;
  WebSocket.prototype.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.args?.[0]?.state) {
        console.log('[WS RECV game-state state]:', JSON.stringify(data.args[0].state).substring(0, 500));
      } else if (data.args?.[0]?.player) {
        console.log('[WS RECV turn-start]:', JSON.stringify(data.args[0]));
      }
    } catch(e) {}
    return originalOnMessage.call(this, event);
  };
});

await page.goto('https://ygo-yugi-destiny-production.up.railway.app/');
await new Promise(r => setTimeout(r, 2000));

await page.fill('input[placeholder="Enter your name..."]', 'Amitt');
await new Promise(r => setTimeout(r, 1000));

await page.locator('button:has-text("Play vs Yugi")').click();
await new Promise(r => setTimeout(r, 500));

await page.locator('button:has-text("Start Duel")').click();

await new Promise(r => setTimeout(r, 6000));

const bodyText = await page.locator('body').textContent();
console.log('\n--- FINAL STATE ---');
console.log('Your Hand (0 cards):', bodyText.includes('Your Hand (0 cards)'));
console.log('Your Hand (5 cards):', bodyText.includes('Your Hand (5 cards)'));
console.log("Opponent's Hand (0 cards):", bodyText.includes("Opponent's Hand (0 cards)"));
console.log("Opponent's Hand (5 cards):", bodyText.includes("Opponent's Hand (5 cards)"));

await browser.close();
process.exit(0);