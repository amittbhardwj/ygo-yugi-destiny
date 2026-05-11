import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

await page.goto('https://ygo-yugi-destiny-production.up.railway.app/');
await new Promise(r => setTimeout(r, 2000));

await page.fill('input[placeholder="Enter your name..."]', 'Amitt');
await new Promise(r => setTimeout(r, 1000));

await page.locator('button:has-text("Play vs Yugi")').click();
await new Promise(r => setTimeout(r, 500));

await page.locator('button:has-text("Start Duel")').click();
await new Promise(r => setTimeout(r, 4000));

// Get the full HTML and look at the structure
const html = await page.content();

// Check for any card elements in hand
const handSections = html.match(/Your Hand[^<]*<[^>]*>[^<]*(<div[^>]*class="[^"]*card[^>]*"[^>]*>.*?<\/div>)/gs);
console.log('Hand card elements found:', handSections?.length || 0);

// Check what the actual DOM structure looks like around hand
const handMatch = html.match(/Your Hand.{0,300}/s);
console.log('\n--- HAND SECTION HTML ---');
console.log(handMatch ? handMatch[0].substring(0, 500) : 'not found');

// Check if there are actual card divs
const cardDivs = html.match(/<div[^>]*class="[^"]*(?:card|monster|spell|trap)[^"]*"[^>]*>/gi);
console.log('\nCard divs found:', cardDivs?.length || 0);
if (cardDivs?.length) console.log(cardDivs.slice(0, 5).join('\n'));

// Check for "hidden" card indicators
const hiddenCards = (html.match(/hidden|face-down|card-back|back/gim) || []).length;
console.log('\nHidden/face-down references:', hiddenCards);

await browser.close();
process.exit(0);