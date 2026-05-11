import { chromium } from 'playwright';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'client/dist');

// Create a patched index.html that uses localhost:3456 for socket
const localHTML = readFileSync(join(distDir, 'index.html'), 'utf8')
  .replace(
    'const SOCKET_URL = window.location.origin',
    'const SOCKET_URL = "http://localhost:3456"'
  );
const patchedIndexPath = join(distDir, 'index-patched.html');
writeFileSync(patchedIndexPath, localHTML);

const httpServer = createServer((req, res) => {
  let filePath = join(distDir, req.url === '/' ? '/index-patched.html' : req.url);
  if (existsSync(filePath)) {
    const ct = filePath.endsWith('.js') ? 'application/javascript' 
               : filePath.endsWith('.css') ? 'text/css' 
               : filePath.endsWith('.html') ? 'text/html' : 'text/plain';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404); res.end('Not found: ' + req.url);
  }
});

const io = new Server(httpServer);
io.on('connection', (socket) => {
  socket.on('play-vs-ai', (data) => {
    console.log('[LOCAL SERVER] got play-vs-ai');
    socket.emit('room-created', { roomCode: 'TEST' });
    setTimeout(() => {
      socket.emit('game-state', {
        state: {
          player: {
            name: 'Amitt', lifePoints: 4000,
            hand: [
              { id: 'm1', name: 'Dark Magician', type: 'monster', attack: 2500, defense: 2100 },
              { id: 'm3', name: 'Dark Magic Attack', type: 'spell' }
            ],
            field: { monsters: [null, null, null], spells: [null, null, null] },
            deckCount: 35, grave: []
          },
          opponent: {
            name: 'Yugi', lifePoints: 4000,
            hand: [{ id: 'm2', name: 'Blue Eyes White Dragon', type: 'monster', attack: 3000, defense: 2500 }],
            field: { monsters: [null, null, null], spells: [null, null, null] },
            deckCount: 35, grave: []
          },
          turn: 1, phase: 'draw'
        }
      });
      console.log('[LOCAL SERVER] sent game-state with 2 cards');
    }, 1000);
  });
});

httpServer.listen(3456, async () => {
  console.log('[LOCAL] Server on http://localhost:3456');
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('pageerror', err => { console.log('[PAGE ERROR]', err.message); logs.push('[PAGE ERROR] ' + err.message); });
  page.on('console', msg => {
    const text = '[' + msg.type() + '] ' + msg.text();
    console.log(text);
    logs.push(text);
  });

  await page.goto('http://localhost:3456/');
  console.log('[TEST] Page loaded');
  await new Promise(r => setTimeout(r, 2000));

  // Check if we have the NEW bundle
  const jsEntries = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[type="module"]')).map(s => s.src);
  });
  console.log('[TEST] Script src:', jsEntries);

  await page.locator('input[placeholder="Enter your name..."]').fill('Amitt');
  await new Promise(r => setTimeout(r, 500));
  await page.locator('button:has-text("Play vs Yugi")').click();
  console.log('[TEST] Clicked Play vs Yugi');
  await new Promise(r => setTimeout(r, 500));
  await page.locator('button:has-text("Start Duel")').click();
  console.log('[TEST] Clicked Start Duel');
  await new Promise(r => setTimeout(r, 8000));

  const body = await page.locator('body').textContent();
  console.log('\n=== BODY (first 400) ===');
  console.log(body.substring(0, 400));
  console.log('\n=== CHECKS ===');
  console.log('Dark Magician:', body.includes('Dark Magician'));
  console.log('Blue Eyes:', body.includes('Blue Eyes'));
  console.log('Hand (0 cards):', body.includes('Hand (0 cards)'));
  console.log('Hand (2 cards):', body.includes('Hand (2 cards)'));

  const hgeLogs = logs.filter(l => l.includes('[HGE]'));
  console.log('\n=== [HGE] LOGS (' + hgeLogs.length + ') ===');
  hgeLogs.forEach(l => console.log(l));

  const gameStateLogs = logs.filter(l => l.includes('game_state') || l.includes('game-state'));
  console.log('\n=== GAME STATE LOGS (' + gameStateLogs.length + ') ===');
  gameStateLogs.forEach(l => console.log(l));

  await browser.close();
  httpServer.close();
  process.exit(0);
});