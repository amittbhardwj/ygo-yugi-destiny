/**
 * Room management for multiplayer + AI mode
 * Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 */

import { createGameState } from './gameState.js';

const rooms = new Map();
const playerSockets = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom({ playerName, yugiMode = false, socketId = null }) {
  const roomCode = generateRoomCode();
  const player1 = { id: socketId, name: playerName, ready: false };

  // For yugiMode, create a dummy player2 for AI
  const player2Name = yugiMode ? 'Yugi' : 'Waiting...';
  const player2Id = yugiMode ? 'YUGI_AI' : null;

  const state = {
    code: roomCode,
    yugiMode,
    players: {
      player1,
      player2: { id: player2Id, name: player2Name, ready: yugiMode },
    },
    gameState: null,
  };

  rooms.set(roomCode, state);
  if (socketId) {
    playerSockets.set(socketId, { roomCode, playerKey: 'player1' });
  }

  return { roomCode, state };
}

function joinRoom(roomCode, playerName, socketId) {
  const room = rooms.get(roomCode);
  if (!room) {
    return { success: false, error: 'Room not found' };
  }
  if (room.players.player2 && room.players.player2.id !== null && room.players.player2.id !== 'YUGI_AI') {
    return { success: false, error: 'Room is full' };
  }

  room.players.player2 = { id: socketId, name: playerName, ready: false };
  playerSockets.set(socketId, { roomCode, playerKey: 'player2' });

  return { success: true, room };
}

function getRoomBySocket(socketId) {
  const data = playerSockets.get(socketId);
  if (!data) return null;
  return rooms.get(data.roomCode) || null;
}

function broadcastToRoom(roomCode, event, data) {
  // Caller handles actual emission via io.to(roomCode)
}

function broadcastToOpponent(socketId, event, data) {
  // Caller handles actual emission via io.to(socketId)
}

function getGameState(roomCode) {
  const room = rooms.get(roomCode);
  return room ? room.gameState : null;
}

function closeRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  // Clean up player socket mappings
  if (room.players.player1?.id) {
    playerSockets.delete(room.players.player1.id);
  }
  if (room.players.player2?.id) {
    playerSockets.delete(room.players.player2.id);
  }

  rooms.delete(roomCode);
}

export {
  rooms,
  playerSockets,
  createRoom,
  joinRoom,
  getRoomBySocket,
  broadcastToRoom,
  broadcastToOpponent,
  getGameState,
  closeRoom,
  generateRoomCode,
};
