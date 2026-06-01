import { createServer } from 'http';
import { Server } from 'socket.io-client';
import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/create-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: 'Tester' })
  });
  const data = await res.json();
  console.log('Created room:', data.roomCode);

  const socket = new Server('http://localhost:3000');
  // wait, socket.io-client is default export
}
// wait I can just write a vanilla test
