import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

const allLogs = [];
page.on('pageerror', err => {
  allLogs.push('[PAGE ERROR] ' + err.message);
  console.log('[PAGE ERROR]', err.message);
});
page.on('console', msg => {
  allLogs.push('[' + msg.type() + '] ' + msg.text());
  console.log('[' + msg.type() + ']', msg.text());
});

await page.goto('https://ygo-yugi-destiny-production.up.railway.app/');
await new Promise(r => setTimeout(r, 3000));

await page.fill('input[placeholder="Enter your name..."]', 'Amitt');
await new Promise(r => setTimeout(r, 1000));
await page.locator('button:has-text("Play vs Yugi")').click();
await new Promise(r => setTimeout(r, 500));
await page.locator('button:has-text("Start Duel")').click();

// Poll every second for up to 10 seconds
console.log('\n--- POLLING FOR GAME STATE ---');
for (let i = 0; i < 10; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const bodyText = await page.locator('body').textContent();
  const hasCards = bodyText.includes('Hand (5 cards)') || bodyText.includes('Hand (4 cards)') || bodyText.includes('Hand (3 cards)');
  const zeroCards = bodyText.includes('Hand (0 cards)');
  console.log(`[${i+1}s] Hand (0 cards): ${zeroCards}, Hand (5+ cards): ${hasCards}`);
  if (hasCards) {
    console.log('SUCCESS! Cards are showing!');
    break;
  }
}

const bodyText = await page.locator('body').textContent();
console.log('\n--- FINAL BODY ---');
const handIdx = bodyText.indexOf('Your Hand');
if (handIdx !== -1) {
  console.log(bodyText.substring(handIdx, handIdx + 100));
}

// Show App logs specifically  
console.log('\n--- APP LOGS ---');
allLogs.filter(l => l.includes('[App]')).forEach(l => console.log(l));

await browser.close();
process.exit(0);