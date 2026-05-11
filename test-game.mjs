import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

const logs = [];
page.on('pageerror', err => logs.push('[PAGE ERROR] ' + err.message));
page.on('console', msg => logs.push('[' + msg.type() + '] ' + msg.text()));

// Inject custom error handler and trace to detect React errors
await page.addInitScript(() => {
  window.addEventListener('error', (e) => {
    console.error('[WIN ERROR]', e.message, 'at', e.filename, ':', e.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED]', e.reason);
  });
  // Override dispatch to trace reducer calls
  const origDispatch = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
});

console.log('Loading page...');
await page.goto('https://ygo-yugi-destiny-production.up.railway.app/', { waitUntil: 'networkidle' });
console.log('Page loaded, waiting 3s...');
await new Promise(r => setTimeout(r, 3000));

// Fill name
await page.locator('input[placeholder="Enter your name..."]').fill('Amitt');
await new Promise(r => setTimeout(r, 800));
await page.locator('button:has-text("Play vs Yugi")').click();
await new Promise(r => setTimeout(r, 800));
await page.locator('button:has-text("Start Duel")').click();

// Wait for game
await new Promise(r => setTimeout(r, 10000));

// Get all logs
const allLogs = [...logs];

// Get body
const bodyText = await page.locator('body').textContent();
console.log('\n=== BODY ===');
console.log('Has "Your Hand (0 cards)":', bodyText.includes('Your Hand (0 cards)'));
console.log('Has "Your Hand (5 cards)":', bodyText.includes('Your Hand (5 cards)'));

// Check for the specific [HGE] log
const hgeLogs = allLogs.filter(l => l.includes('[HGE]'));
const handleGameEventLogs = allLogs.filter(l => l.includes('handleGameEvent'));
const winErrorLogs = allLogs.filter(l => l.includes('[WIN ERROR]') || l.includes('[UNHANDLED]'));

console.log('\n=== [HGE] LOGS (' + hgeLogs.length + ') ===');
hgeLogs.forEach(l => console.log(l));

console.log('\n=== handleGameEvent LOGS (' + handleGameEventLogs.length + ') ===');
handleGameEventLogs.forEach(l => console.log(l));

console.log('\n=== WIN/UNHANDLED ERRORS (' + winErrorLogs.length + ') ===');
winErrorLogs.forEach(l => console.log(l));

console.log('\n=== ALL LOGS (' + allLogs.length + ') ===');
allLogs.slice(0, 30).forEach(l => console.log(l));

await browser.close();
process.exit(0);