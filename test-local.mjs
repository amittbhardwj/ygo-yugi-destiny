import { chromium } from 'playwright';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function setupLocalServer() {
  const distDir = join(__dirname, 'client/dist');
  
  // Read local Railway HTML and patch it for local testing
  // The local dist/index.html references our LOCAL build (index-DgrPcVpP.js with [HGE] logging)
  // But we need to ALSO serve a Socket.IO server on the same port
  const localIndexPath = join(distDir, 'index.html');
  const localHTML = readFileSync(localIndexPath, 'utf8');
  
  const httpServer = createServer((req, res) => {
    // Serve from local dist
    let url = req.url === '/' ? '/index.html' : req.url;
    let filePath = join(distDir, url);
    
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const ct = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': ct });
      res.end(readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not found: ' + url);
    }
  });

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('[Socket.IO] client connected:', socket.id);
    
    socket.on('play-vs-ai', (data) => {
      console.log('[Socket.IO] play-vs-ai:', data);
      socket.emit('room-created', { roomCode: 'TEST' });
      
      setTimeout(() => {
        socket.emit('game-state', {
          state: {
            player: {
              name: 'Amitt',
              lifePoints: 4000,
              hand: [
                { id: 'm1', name: 'Dark Magician', type: 'monster', attack: 2500, defense: 2100 },
                { id: 'm3', name: 'Dark Magic Attack', type: 'spell' }
              ],
              field: { monsters: [null, null, null], spells: [null, null, null] },
              deck: { cards: Array(35).fill({ id: 'x', name: 'card' }) },
              graveyard: []
            },
            opponent: {
              name: 'Yugi',
              lifePoints: 4000,
              hand: [{ id: 'm2', name: 'Blue Eyes White Dragon', type: 'monster', attack: 3000, defense: 2500 }],
              field: { monsters: [null, null, null], spells: [null, null, null] },
              deck: { cards: Array(35).fill({ id: 'x', name: 'card' }) },
              graveyard: []
            },
            turn: 1,
            phase: 'draw'
          }
        });
        console.log('[Socket.IO] sent game-state with 2 cards in player hand');
      }, 1000);
    });
  });

  return new Promise(resolve => {
    httpServer.listen(3456, () => {
      console.log('[SERVER] Listening on http://localhost:3456 (serving local dist with [HGE] build)');
      resolve(httpServer);
    });
  });
}

async function main() {
  // First rebuild to ensure we have the latest
  console.log('[BUILD] Building latest client...');
  const { exec } = await import('child_process');
  await new Promise((resolve, reject) => {
    exec('npm run build', { cwd: join(__dirname, 'client') }, (err, stdout, stderr) => {
      if (err) { console.error('Build error:', stderr); reject(err); }
      else { console.log('Build output:', stdout.substring(0, 200)); resolve(); }
    });
  });

  await setupLocalServer();
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const logs = [];
  page.on('pageerror', err => logs.push('[PAGE ERROR] ' + err.message));
  page.on('console', msg => logs.push('[' + msg.type() + '] ' + msg.text()));

  await page.goto('http://localhost:3456/');
  console.log('Page loaded');
  await new Promise(r => setTimeout(r, 2000));

  await page.locator('input[placeholder="Enter your name..."]').fill('Amitt');
  await new Promise(r => setTimeout(r, 500));
  await page.locator('button:has-text("Play vs Yugi")').click();
  console.log('Clicked Play vs Yugi');
  await new Promise(r => setTimeout(r, 500));
  await page.locator('button:has-text("Start Duel")').click();
  console.log('Clicked Start Duel');

  await new Promise(r => setTimeout(r, 6000));

  const bodyText = await page.locator('body').textContent();
  console.log('\n=== BODY (first 400 chars) ===');
  console.log(bodyText.substring(0, 400));
  console.log('\nHand (0 cards):', bodyText.includes('Hand (0 cards)'));
  console.log('Dark Magician:', bodyText.includes('Dark Magician'));
  console.log('Blue Eyes:', bodyText.includes('Blue Eyes'));

  const hgeLogs = logs.filter(l => l.includes('[HGE]'));
  console.log('\n=== [HGE] LOGS (' + hgeLogs.length + ') ===');
  hgeLogs.forEach(l => console.log(l));

  console.log('\n=== ALL LOGS (' + logs.length + ') ===');
  logs.forEach(l => console.log(l));

  await browser.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });