import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected', socket.id);
  socket.emit('play-vs-ai', { playerName: 'TestPlayer', deckIds: ['m1', 'm2', 'm3'] });
});

socket.on('room-created', (data) => {
  console.log('Room created:', data);
});

socket.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
  process.exit(0);
});

socket.on('game-state', (data) => {
  console.log('Game state received:', Object.keys(data.state));
  process.exit(0);
});
