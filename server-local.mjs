import { createServer } from 'http';
import { Server } from 'socket.io';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'client/dist');
const PORT = 3001;

const app = express();
app.use(express.static(distDir));

const httpServer = createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
  socket.on('play-vs-ai', (data) => {
    console.log('[LOCAL] got play-vs-ai:', data.playerName);
    socket.emit('room-created', { roomCode: 'TEST' });
    setTimeout(() => {
      socket.emit('game-state', {
        state: {
          player: { name: data.playerName, lifePoints: 4000, hand: [{ id: 'm1', name: 'Dark Magician', type: 'monster', attack: 2500, defense: 2100 }], field: { monsters: [null,null,null], spells: [null,null,null] }, deck: { cards: Array(35).fill({}) }, graveyard: [] },
          opponent: { name: 'Yugi', lifePoints: 4000, hand: [{ id: 'm2', name: 'Blue Eyes', type: 'monster', attack: 3000, defense: 2500 }], field: { monsters: [null,null,null], spells: [null,null,null] }, deck: { cards: Array(35).fill({}) }, graveyard: [] },
          turn: 1, phase: 'draw'
        }
      });
      console.log('[LOCAL] sent game-state');
    }, 800);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[LOCAL] Server on http://localhost:${PORT}`);
  console.log(`[LOCAL] Serving from ${distDir}`);
  console.log(`[LOCAL] index.html exists: ${existsSync(join(distDir, 'index.html'))}`);
  
  // Quick verification
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const hasModule = html.includes('type="module"');
  console.log(`[LOCAL] HTML has module script: ${hasModule}`);
  
  if (hasModule) {
    const match = html.match(/src="([^"]+)"/);
    console.log(`[LOCAL] Script src: ${match ? match[1] : 'unknown'}`);
  }
});