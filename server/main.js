import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import CARDS from './cards.js';
import { getCardImageUrl } from './cardImages.js';
import { createGameState, drawCard, advancePhase, serialize, canAttack, executeAttack, directAttack, summonMonster, setSpellTrap, getActivatableTraps } from './gameState.js';
import { resolveSpellEffect, resolveTrapEffect, processEventEffects, activateTrapByEffect } from './rules.js';
import { createRoom, joinRoom, getRoomBySocket as _getRoomBySocket, broadcastToRoom, broadcastToOpponent, getGameState, closeRoom } from './rooms.js';
import { executeYugiTurn, shouldAIActivateTrap } from './ai.js';

function attachTrapResolvers(room) {
  if (!room) return room;
  room.resolvePendingActionWithoutTrap = () => resolvePendingActionWithoutTrap(room);
  room.resolvePendingActionWithTrap = (trapCardId) => resolvePendingActionWithTrap(room, trapCardId);
  return room;
}

function getRoomBySocket(socketId) {
  const room = _getRoomBySocket(socketId);
  return attachTrapResolvers(room);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static client build in production
app.use(express.static(join(__dirname, '../client/dist')));

// REST endpoints for room management (for lobby)
app.post('/api/create-room', (req, res) => {
  try {
    const { playerName, yugiMode } = req.body;
    if (!playerName) {
      return res.status(400).json({ error: 'playerName required' });
    }
    const room = createRoom({ playerName, yugiMode: !!yugiMode });
    attachTrapResolvers(room.state);
    res.json({ roomCode: room.roomCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/join-room', (req, res) => {
  try {
    const { roomCode, playerName } = req.body;
    if (!roomCode || !playerName) {
      return res.status(400).json({ error: 'roomCode and playerName required' });
    }
    const result = joinRoom(roomCode.toUpperCase(), playerName);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// All cards are unlocked for Deck Construction.
app.get('/api/cards', (req, res) => {
  res.json({ cards: CARDS.map(card => ({ ...card, imgUrl: getCardImageUrl(card.id) })) });
});

// Serve index for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

// Track AI timeouts per room so we can cancel them on cleanup
const aiTimeouts = new Map();
const autoPhaseTimeouts = new Map();

function clearAITimeout(roomCode) {
  const timeout = aiTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    aiTimeouts.delete(roomCode);
  }
}

function setAITimeout(roomCode, fn, delayMs) {
  clearAITimeout(roomCode);
  const timeout = setTimeout(fn, delayMs);
  aiTimeouts.set(roomCode, timeout);
}

function clearAutoPhaseTimeout(roomCode) {
  const timeout = autoPhaseTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    autoPhaseTimeouts.delete(roomCode);
  }
}

function setAutoPhaseTimeout(roomCode, fn, delayMs) {
  clearAutoPhaseTimeout(roomCode);
  const timeout = setTimeout(fn, delayMs);
  autoPhaseTimeouts.set(roomCode, timeout);
}

function emitPhaseAndState(roomCode, gs) {
  io.to(roomCode).emit('turn-start', {
    player: gs.currentPlayer,
    phase: gs.phase,
    turn: gs.turn
  });
  io.to(roomCode).emit('game-state', { state: serialize(gs, null) });
}

function scheduleAutoMainPhase(roomState) {
  if (!roomState || !roomState.gameState) return;
  const roomCode = roomState.code || roomState.roomCode;
  const gs = roomState.gameState;
  clearAutoPhaseTimeout(roomCode);

  // Yugi already advances his own Draw/Standby phases inside executeYugiTurn().
  if (!gs.started || gs.winner || gs.phase !== 'draw' || (roomState.yugiMode && gs.currentPlayer === 'player2')) return;

  const playerAtSchedule = gs.currentPlayer;
  const turnAtSchedule = gs.turn;

  const advanceOneOpeningPhase = () => {
    autoPhaseTimeouts.delete(roomCode);
    if (!roomState.gameState || gs.winner || !gs.started) return;
    if (gs.currentPlayer !== playerAtSchedule || gs.turn !== turnAtSchedule) return;
    if (gs.phase !== 'draw' && gs.phase !== 'standby') return;

    const result = advancePhase(gs);
    if (!result.success) return;
    if (checkWinCondition(gs, roomCode, io)) return;

    emitPhaseAndState(roomCode, gs);

    if (gs.phase === 'standby') {
      setAutoPhaseTimeout(roomCode, advanceOneOpeningPhase, 1000);
    }
  };

  setAutoPhaseTimeout(roomCode, advanceOneOpeningPhase, 1000);
}

function finishAITurnIfNeeded(roomState) {
  if (!roomState || !roomState.yugiMode || !roomState.gameState) return;
  const gs = roomState.gameState;
  if (gs.winner || !gs.started) return;
  gs.playerLocked = false;

  // executeYugiTurn intentionally plays through Yugi's End Phase, but does not
  // switch control back to the human. Advance once from Yugi's end phase to the
  // player's draw phase. Do not overwrite currentPlayer first, or advancePhase()
  // will switch back to Yugi and leave the duel stuck on the AI draw phase.
  if (gs.currentPlayer === 'player2' && gs.phase === 'end') {
    advancePhase(gs);
    if (checkWinCondition(gs, roomState.code, io)) return;
    io.to(roomState.code).emit('turn-start', {
      player: gs.currentPlayer,
      phase: gs.phase,
      turn: gs.turn
    });
    scheduleAutoMainPhase(roomState);
  }

  io.to(roomState.code).emit('game-state', { state: serialize(gs, null) });
}

function executeOriginalAction(room, pending, trapApplied) {
  const gs = room.gameState;
  const { type, playerKey, cardId, position, tributeIds, attackerId, targetId, context } = pending;
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';

  if (type === 'summon') {
    const card = gs.players[playerKey].field.monsters.find(m => m.cardId === cardId);
    
    if (!trapApplied) {
      processEventEffects(gs, 'summon', playerKey, { summonedMonster: card });
      gs.log.push(`${gs.players[playerKey].name} summoned ${card ? card.name : 'Monster'}`);
    } else {
      gs.log.push(`${gs.players[playerKey].name} summoned ${card ? card.name : 'Monster'}, but ${trapApplied.name} was activated!`);
    }
    
    gs.playerLocked = true;

    io.to(room.code).emit('action-result', {
      success: true,
      message: trapApplied 
        ? `${card ? card.name : 'Monster'} summoned, but ${trapApplied.name} was activated!`
        : `Summoned ${card ? card.name : 'Monster'}`,
      newState: serialize(gs, null)
    });
    io.to(room.code).emit('game-state', { state: serialize(gs, null) });
    scheduleAutoMainPhase(room);
  } else if (type === 'attack' || type === 'direct-attack') {
    const attacker = gs.players[playerKey].field.monsters.find(m => m.cardId === attackerId);
    let cancelAttack = false;
    if (trapApplied) {
      if (trapApplied.effect === 'destroy_attackers' || trapApplied.effect === 'reflect_battle') {
        cancelAttack = true;
      }
    } else {
      const eventResult = processEventEffects(gs, 'attack_declared', playerKey, { attacker, targetId });
      if (eventResult.cancelAttack) cancelAttack = true;
    }

    if (cancelAttack) {
      io.to(room.code).emit('attack-result', {
        attackerId,
        targetId,
        damage: 0,
        destroyed: []
      });
      if (!checkWinCondition(gs, room.code, io)) {
        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      }
    } else {
      if (type === 'attack') {
        const result = executeAttack(gs, playerKey, attackerId, targetId);
        if (result.success) {
          const target = gs.players[opponentKey].field.monsters.find(m => m.cardId === targetId);

          if (result.damageToDefender > 0) {
            processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: opponentKey, damage: result.damageToDefender });
          }
          if (result.damageToAttacker > 0) {
            processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: playerKey, damage: result.damageToAttacker });
          }

          gs.log.push(`${attacker?.name} attacked ${target?.name}`);

          io.to(room.code).emit('attack-result', {
            attackerId,
            targetId,
            damage: result.damage,
            destroyed: result.destroyed || []
          });
          if (!checkWinCondition(gs, room.code, io)) {
            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
          }
        }
      } else {
        const result = directAttack(gs, playerKey, attackerId);
        if (result.success) {
          if (result.damage > 0) {
            processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: opponentKey, damage: result.damage });
          }
          gs.log.push(`${attacker?.name} attacks ${gs.players[opponentKey].name}'s LP directly for ${result.damage} damage`);

          io.to(room.code).emit('attack-result', {
            attackerId,
            targetId: null,
            damage: result.damage,
            destroyed: []
          });
          if (!checkWinCondition(gs, room.code, io)) {
            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
          }
        }
      }
    }
  }
}

function resolvePendingActionWithoutTrap(room) {
  if (!room || !room.pendingTrapResponse) return;
  const pending = room.pendingTrapResponse;
  room.pendingTrapResponse = null;
  if (room.trapTimeout) {
    clearTimeout(room.trapTimeout);
    room.trapTimeout = null;
  }

  const gs = room.gameState;

  if (pending.type === 'counter-trap') {
    const { activatorKey, trapCardId, originalAction } = pending;
    const trap = gs.players[activatorKey].field.spells.find(s => s.cardId === trapCardId);
    if (trap) {
      gs.players[activatorKey].field.spells = gs.players[activatorKey].field.spells.filter(s => s.cardId !== trapCardId);
      gs.players[activatorKey].grave.push({ ...trap, faceDown: false });
      activateTrapByEffect(gs, activatorKey, trap, originalAction.event, originalAction.context || {});
    }
    executeOriginalAction(room, originalAction, trap);
  } else {
    executeOriginalAction(room, pending, null);
  }

  io.to(room.code).emit('trap-prompt-resolved', {});
}

function resolvePendingActionWithTrap(room, trapCardId) {
  if (!room || !room.pendingTrapResponse) return;
  const pending = room.pendingTrapResponse;
  
  if (room.trapTimeout) {
    clearTimeout(room.trapTimeout);
    room.trapTimeout = null;
  }

  const gs = room.gameState;

  if (pending.type === 'counter-trap') {
    room.pendingTrapResponse = null;
    const { activatorKey, trapCardId: originalTrapId, responderKey, originalAction } = pending;

    const responder = gs.players[responderKey];
    const counterTrap = responder.field.spells.find(s => s.cardId === trapCardId);
    if (counterTrap) {
      responder.field.spells = responder.field.spells.filter(s => s.cardId !== trapCardId);
      responder.grave.push({ ...counterTrap, faceDown: false });
    }

    const activator = gs.players[activatorKey];
    const originalTrap = activator.field.spells.find(s => s.cardId === originalTrapId);
    if (originalTrap) {
      activator.field.spells = activator.field.spells.filter(s => s.cardId !== originalTrapId);
      activator.grave.push({ ...originalTrap, faceDown: false });
    }

    gs.log.push(`${responder.name} activated ${counterTrap?.name || 'Counter Trap'} to negate ${originalTrap?.name || 'Trap'}!`);
    
    executeOriginalAction(room, originalAction, null);
    io.to(room.code).emit('trap-prompt-resolved', {});
    return;
  }

  room.pendingTrapResponse = null;
  const { type, playerKey, cardId, attackerId, targetId } = pending;
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = gs.players[opponentKey];

  const trap = opponent.field.spells.find(s => s.cardId === trapCardId && s.type === 'trap' && s.faceDown);
  if (!trap) {
    room.pendingTrapResponse = pending;
    resolvePendingActionWithoutTrap(room);
    return;
  }

  const initiator = gs.players[playerKey];
  const negateTraps = initiator.field.spells.filter(s => s.type === 'trap' && s.faceDown && (s.effect === 'negate_spell' || s.id === 't13' || s.cardId?.startsWith('t13')));

  if (negateTraps.length > 0) {
    const initiatorIsHuman = initiator.id && initiator.id !== 'YUGI_AI';
    if (initiatorIsHuman) {
      clearAutoPhaseTimeout(room.code);
      room.pendingTrapResponse = {
        type: 'counter-trap',
        activatorKey: opponentKey,
        responderKey: playerKey,
        trapCardId,
        originalAction: pending
      };

      io.to(initiator.id).emit('trap-prompt', {
        event: 'counter-trap',
        triggerCard: { name: trap.name, cardId: trap.cardId },
        traps: negateTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
        timeout: 8
      });

      const activatorSocketId = opponent.id;
      if (activatorSocketId && activatorSocketId !== 'YUGI_AI') {
        io.to(activatorSocketId).emit('waiting-for-trap', {});
      }

      if (room.trapTimeout) clearTimeout(room.trapTimeout);
      room.trapTimeout = setTimeout(() => {
        resolvePendingActionWithoutTrap(room);
      }, 8000);

      io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      return;
    } else {
      const shouldAI = shouldAIActivateTrap(gs, negateTraps[0], 'counter-trap', { trapToNegate: trap });
      if (shouldAI) {
        initiator.field.spells = initiator.field.spells.filter(s => s.cardId !== negateTraps[0].cardId);
        initiator.grave.push({ ...negateTraps[0], faceDown: false });

        opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== trapCardId);
        opponent.grave.push({ ...trap, faceDown: false });

        gs.log.push(`Yugi activated ${negateTraps[0].name} to negate ${trap.name}!`);
        executeOriginalAction(room, pending, null);
        io.to(room.code).emit('trap-prompt-resolved', {});
        return;
      }
    }
  }

  opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== trapCardId);
  opponent.grave.push({ ...trap, faceDown: false });
  activateTrapByEffect(gs, opponentKey, trap, pending.event, pending.context || {});

  executeOriginalAction(room, pending, trap);
  io.to(room.code).emit('trap-prompt-resolved', {});
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // --- Create Room ---
  socket.on('play-vs-ai', ({ playerName, deckIds }) => {
    try {
      if (!playerName) {
        socket.emit('error', { message: 'playerName required' });
        return;
      }
      const room = createRoom({ playerName, yugiMode: true, socketId: socket.id });
      attachTrapResolvers(room.state);
      socket.join(room.roomCode);
      socket.roomCode = room.roomCode;
      socket.playerName = playerName;
      socket.isYugiMode = true;
      socket.emit('room-created', { roomCode: room.roomCode });
      console.log(`[Room] Created AI room: ${room.roomCode} by ${playerName}`);

      // Auto-start game for AI mode - player1 is ready when they click
      room.state.players.player1.ready = true;
      if (room.state.players.player1?.ready && room.state.players.player2?.ready) {
        const coinSide = Math.random() < 0.5 ? 'heads' : 'tails';
        const firstPlayer = coinSide === 'heads' ? 'player1' : 'player2';
        const gs = createGameState(room.state.players.player1.name, room.state.players.player2.name, {
          player1DeckIds: deckIds,
          firstPlayer,
          coinFlip: { side: coinSide, winner: firstPlayer },
        });
        gs.started = true;
        gs.players.player1.id = socket.id; // Store socketId so playerKey detection works in all handlers
        room.state.gameState = gs;
        if (checkWinCondition(gs, room.roomCode, io)) return;
        io.to(room.roomCode).emit('coin-flip', { side: coinSide, winner: firstPlayer });
        io.to(room.roomCode).emit('turn-start', { player: gs.currentPlayer, phase: gs.phase, turn: gs.turn });
        io.to(room.roomCode).emit('game-state', { state: serialize(gs, null) });
        scheduleAutoMainPhase(room.state);
        console.log(`[Game] Started (AI mode): ${room.roomCode}`);
        // Trigger AI turn after a short delay
        if (room.state.yugiMode) {
          setAITimeout(room.roomCode, () => {
            if (room.state && room.state.gameState && room.state.gameState.started) {
              executeYugiTurn(room.state.gameState, io, room.roomCode, () => {
                if (checkWinCondition(room.state.gameState, room.roomCode, io)) return true;
                io.to(room.roomCode).emit('game-state', { state: serialize(room.state.gameState, null) });
                return false;
              }).then(() => finishAITurnIfNeeded(room.state)).catch(() => {});
            }
          }, 800);
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Create Room (online) ---
  socket.on('create-room', ({ playerName, yugiMode }) => {
    try {
      if (!playerName) {
        socket.emit('error', { message: 'playerName required' });
        return;
      }
      const room = createRoom({ playerName, yugiMode: !!yugiMode, socketId: socket.id });
      attachTrapResolvers(room.state);
      socket.join(room.roomCode);
      socket.roomCode = room.roomCode;
      socket.playerName = playerName;
      socket.isYugiMode = !!yugiMode;
      socket.emit('room-created', { roomCode: room.roomCode });
      console.log(`[Room] Created: ${room.roomCode} by ${playerName} (yugiMode=${!!yugiMode})`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Join Room ---
  socket.on('join-room', ({ roomCode, playerName }) => {
    try {
      if (!roomCode || !playerName) {
        socket.emit('error', { message: 'roomCode and playerName required' });
        return;
      }
      const code = roomCode.toUpperCase();
      const result = joinRoom(code, playerName, socket.id);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }
      socket.join(code);
      socket.roomCode = code;
      socket.playerName = playerName;
      socket.isYugiMode = false;
      socket.emit('joined', { success: true });

      // Notify host
      const room = result.room;
      const hostSocketId = room.players.player1?.id;
      if (hostSocketId) {
        io.to(hostSocketId).emit('opponent-joined', { playerName });
      }

      // Send current room state if game already in progress
      if (room.gameState && room.gameState.started) {
        socket.emit('game-state', { state: serialize(room.gameState, socket.id) });
      }

      console.log(`[Room] ${playerName} joined ${code}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Ready ---
  socket.on('ready', () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      const playerKey = room.players.player1?.id === socket.id ? 'player1' : 'player2';
      room.players[playerKey].ready = true;

      // Notify opponent
      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
      const opponentSocketId = room.players[opponentKey]?.id;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('opponent-ready', {});
      }

      // Check if both players ready
      if (room.players.player1?.ready && room.players.player2?.ready) {
        // Start the game
        room.gameState = createGameState(room.players.player1.name, room.players.player2.name);
        room.gameState.started = true;
        room.gameState.currentPlayer = 'player1';
        room.gameState.phase = 'draw';
        if (checkWinCondition(room.gameState, room.code, io)) return;

        // Broadcast turn start
        io.to(room.code).emit('turn-start', {
          player: room.gameState.currentPlayer,
          phase: room.gameState.phase,
          turn: room.gameState.turn
        });

        // Send full game state
        io.to(room.code).emit('game-state', { state: serialize(room.gameState, null) });
        scheduleAutoMainPhase(room);

        console.log(`[Game] Started: ${room.code}`);

        // If Yugi mode and player2 (AI) just got ready, trigger AI after draw
        if (room.yugiMode && room.gameState.currentPlayer === 'player2') {
          // AI draws and takes its turn after a short delay
          setAITimeout(room.code, () => {
            if (room && room.gameState && room.gameState.started) {
              executeYugiTurn(room.gameState, io, room.code, (action) => {
                io.to(room.code).emit('yugi-action', { action });
                if (checkWinCondition(room.gameState, room.code, io)) return true;
                io.to(room.code).emit('game-state', { state: serialize(room.gameState, null) });
                return false;
              });
            }
          }, 800);
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Play Card (summon monster) ---
  socket.on('play-card', ({ cardId, position, tributeIds }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';
      clearAutoPhaseTimeout(room.code);
      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';

      // Validate it's this player's turn
      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      // Must be in main1 phase
      if (gs.phase !== 'main1') {
        socket.emit('error', { message: 'Can only summon during Main Phase 1' });
        return;
      }

      // Find the card in hand
      const cardIndex = gs.players[playerKey].hand.findIndex(c => c.cardId === cardId);
      if (cardIndex === -1) {
        socket.emit('error', { message: 'Card not in hand' });
        return;
      }

      const card = gs.players[playerKey].hand[cardIndex];
      if (card.type !== 'monster') {
        socket.emit('error', { message: 'Use set-spell-trap for spell/trap cards' });
        return;
      }

      if (gs.players[playerKey].hasNormalSummoned) {
        socket.emit('error', { message: 'You can only Normal Summon or Set once per turn' });
        return;
      }

      // Count already summoned monsters this turn
      const existingMonsters = gs.players[playerKey].field.monsters.filter(m => !m.token).length;
      if (existingMonsters >= 5) {
        socket.emit('error', { message: 'Maximum 5 monsters on field' });
        return;
      }

      // Summon the monster
      const result = summonMonster(gs, playerKey, cardId, position || 'defense', tributeIds);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      // Check if opponent is human and has activatable traps
      const opponent = gs.players[opponentKey];
      const opponentIsHuman = opponent && opponent.id && opponent.id !== 'YUGI_AI';
      const opponentIsAI = opponent && opponent.id === 'YUGI_AI';
      const activatableTraps = getActivatableTraps(gs, 'summon', playerKey, { summonedMonster: result.card });

      if (opponentIsHuman && activatableTraps.length > 0) {
        clearAutoPhaseTimeout(room.code);
        room.pendingTrapResponse = {
          type: 'summon',
          event: 'summon',
          playerKey,
          cardId,
          position,
          tributeIds,
          traps: activatableTraps,
          context: { summonedMonster: result.card }
        };

        io.to(opponent.id).emit('trap-prompt', {
          event: 'summon',
          triggerCard: { name: result.card.name, cardId: result.card.cardId },
          traps: activatableTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
          timeout: 8
        });

        socket.emit('waiting-for-trap', {});

        if (room.trapTimeout) clearTimeout(room.trapTimeout);
        room.trapTimeout = setTimeout(() => {
          resolvePendingActionWithoutTrap(room);
        }, 8000);

        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      } else {
        let aiTrapToActivate = null;
        if (opponentIsAI && activatableTraps.length > 0) {
          for (const t of activatableTraps) {
            if (shouldAIActivateTrap(gs, t, 'summon', { summonedMonster: result.card })) {
              aiTrapToActivate = t;
              break;
            }
          }
        }

        if (aiTrapToActivate) {
          const humanNegateTraps = gs.players.player1.field.spells.filter(s => s.type === 'trap' && s.faceDown && (s.effect === 'negate_spell' || s.id === 't13' || s.cardId?.startsWith('t13')));
          if (humanNegateTraps.length > 0) {
            clearAutoPhaseTimeout(room.code);
            room.pendingTrapResponse = {
              type: 'counter-trap',
              activatorKey: opponentKey,
              responderKey: playerKey,
              trapCardId: aiTrapToActivate.cardId,
              originalAction: {
                type: 'summon',
                event: 'summon',
                playerKey,
                cardId,
                position,
                tributeIds,
                context: { summonedMonster: result.card }
              }
            };

            socket.emit('trap-prompt', {
              event: 'counter-trap',
              triggerCard: { name: aiTrapToActivate.name, cardId: aiTrapToActivate.cardId },
              traps: humanNegateTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
              timeout: 8
            });

            if (room.trapTimeout) clearTimeout(room.trapTimeout);
            room.trapTimeout = setTimeout(() => {
              resolvePendingActionWithoutTrap(room);
            }, 8000);

            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
            return;
          } else {
            opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== aiTrapToActivate.cardId);
            opponent.grave.push({ ...aiTrapToActivate, faceDown: false });
            activateTrapByEffect(gs, opponentKey, aiTrapToActivate, 'summon', { summonedMonster: result.card });
            
            executeOriginalAction(room, {
              type: 'summon',
              playerKey,
              cardId,
              position,
              tributeIds
            }, aiTrapToActivate);
            return;
          }
        }

        processEventEffects(gs, 'summon', playerKey, { summonedMonster: result.card });

        gs.log.push(`${gs.players[playerKey].name} summoned ${card.name}`);
        gs.playerLocked = true;

        io.to(room.code).emit('action-result', {
          success: true,
          message: `Summoned ${card.name}`,
          newState: serialize(gs, null)
        });
        io.to(room.code).emit('game-state', { state: serialize(gs, null) });

        console.log(`[Game] ${gs.players[playerKey].name} summoned ${card.name}`);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Set Spell/Trap ---
  socket.on('set-spell-trap', ({ cardId, faceDown, targetId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      if (gs.phase !== 'main1' && gs.phase !== 'main2') {
        socket.emit('error', { message: 'Can only set cards during Main Phase' });
        return;
      }

      const cardIndex = gs.players[playerKey].hand.findIndex(c => c.cardId === cardId);
      if (cardIndex === -1) {
        socket.emit('error', { message: 'Card not in hand' });
        return;
      }

      const card = gs.players[playerKey].hand[cardIndex];
      if (card.type === 'monster') {
        socket.emit('error', { message: 'Use play-card to summon monsters' });
        return;
      }

      if (gs.players[playerKey].field.spells.length >= 5) {
        socket.emit('error', { message: 'Maximum 5 Spell/Trap cards on field' });
        return;
      }

      const result = setSpellTrap(gs, playerKey, cardId, faceDown !== false);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      const position = faceDown === false ? 'open' : 'set';
      gs.log.push(`${gs.players[playerKey].name} set ${card.name} (${position})`);
      gs.playerLocked = true;

      if (faceDown === false && card.type === 'spell') {
        const spellResult = resolveSpellEffect(gs, playerKey, cardId, { targetId });
        if (!spellResult.success) {
          socket.emit('error', { message: spellResult.error });
          return;
        }
      }

      io.to(room.code).emit('action-result', {
        success: true,
        message: `Set ${card.name}`,
        newState: serialize(gs, null)
      });
      io.to(room.code).emit('game-state', { state: serialize(gs, null) });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Activate Spell ---
  socket.on('activate-spell', ({ cardId, targetId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      if (gs.phase !== 'main1' && gs.phase !== 'main2') {
        socket.emit('error', { message: 'Can only activate spells during Main Phase' });
        return;
      }

      const fieldSpell = gs.players[playerKey].field.spells.find(s => s.cardId === cardId);
      const handSpell = gs.players[playerKey].hand.find(s => s.cardId === cardId);

      if (!fieldSpell && !handSpell) {
        socket.emit('error', { message: 'Spell not found' });
        return;
      }
      const card = fieldSpell || handSpell;
      if (card.type !== 'spell') {
        socket.emit('error', { message: 'Only Spell cards can be activated here' });
        return;
      }
      if (fieldSpell?.faceDown) {
        fieldSpell.faceDown = false;
        fieldSpell.position = 'open';
      }
      if (handSpell) {
        if (gs.players[playerKey].field.spells.length >= 5) {
          socket.emit('error', { message: 'Maximum 5 Spell/Trap cards on field' });
          return;
        }
        const setResult = setSpellTrap(gs, playerKey, cardId, false);
        if (!setResult.success) {
          socket.emit('error', { message: setResult.error });
          return;
        }
      }

      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
      const result = resolveSpellEffect(gs, playerKey, cardId, { targetId });

      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      gs.log.push(`${gs.players[playerKey].name} activated ${card.name}`);

      io.to(room.code).emit('action-result', {
        success: true,
        message: `Activated ${card.name}`,
        newState: serialize(gs, null)
      });
      if (!checkWinCondition(gs, room.code, io)) {
        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Activate Trap ---
  socket.on('activate-trap', ({ cardId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      const fieldTrap = gs.players[playerKey].field.spells.find(s => s.cardId === cardId);

      if (!fieldTrap) {
        socket.emit('error', { message: 'Trap not found on field' });
        return;
      }
      if (fieldTrap.type !== 'trap') {
        socket.emit('error', { message: 'Only Trap cards can be activated here' });
        return;
      }
      if (!fieldTrap.faceDown) {
        socket.emit('error', { message: 'Trap is already face-up' });
        return;
      }

      fieldTrap.faceDown = false;
      fieldTrap.position = 'open';

      const result = resolveTrapEffect(gs, playerKey, cardId);

      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      io.to(room.code).emit('action-result', {
        success: true,
        message: `Activated ${fieldTrap.name}`,
        newState: serialize(gs, null)
      });
      if (!checkWinCondition(gs, room.code, io)) {
        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Attack ---
  socket.on('attack', ({ attackerId, targetId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      if (gs.phase !== 'battle') {
        socket.emit('error', { message: 'Can only attack during Battle Phase' });
        return;
      }

      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
      const opponent = gs.players[opponentKey];
      const opponentIsHuman = opponent && opponent.id && opponent.id !== 'YUGI_AI';
      
      const attackingMonster = gs.players[playerKey].field.monsters.find(m => m.cardId === attackerId);
      const activatableTraps = getActivatableTraps(gs, 'attack_declared', playerKey, { attacker: attackingMonster, targetId });

      if (opponentIsHuman && activatableTraps.length > 0) {
        clearAutoPhaseTimeout(room.code);
        room.pendingTrapResponse = {
          type: 'attack',
          event: 'attack_declared',
          playerKey,
          attackerId,
          targetId,
          traps: activatableTraps
        };

        io.to(opponent.id).emit('trap-prompt', {
          event: 'attack',
          triggerCard: { name: attackingMonster.name, cardId: attackingMonster.cardId },
          traps: activatableTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
          timeout: 8
        });

        socket.emit('waiting-for-trap', {});

        if (room.trapTimeout) clearTimeout(room.trapTimeout);
        room.trapTimeout = setTimeout(() => {
          resolvePendingActionWithoutTrap(room);
        }, 8000);

        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      } else {
        const opponentIsAI = opponent && opponent.id === 'YUGI_AI';
        let aiTrapToActivate = null;
        if (opponentIsAI && activatableTraps.length > 0) {
          for (const t of activatableTraps) {
            if (shouldAIActivateTrap(gs, t, 'attack_declared', { attacker: attackingMonster, targetId })) {
              aiTrapToActivate = t;
              break;
            }
          }
        }

        if (aiTrapToActivate) {
          const humanNegateTraps = gs.players.player1.field.spells.filter(s => s.type === 'trap' && s.faceDown && (s.effect === 'negate_spell' || s.id === 't13' || s.cardId?.startsWith('t13')));
          if (humanNegateTraps.length > 0) {
            clearAutoPhaseTimeout(room.code);
            room.pendingTrapResponse = {
              type: 'counter-trap',
              activatorKey: opponentKey,
              responderKey: playerKey,
              trapCardId: aiTrapToActivate.cardId,
              originalAction: {
                type: 'attack',
                event: 'attack_declared',
                playerKey,
                attackerId,
                targetId,
                context: { attacker: attackingMonster, targetId }
              }
            };

            socket.emit('trap-prompt', {
              event: 'counter-trap',
              triggerCard: { name: aiTrapToActivate.name, cardId: aiTrapToActivate.cardId },
              traps: humanNegateTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
              timeout: 8
            });

            if (room.trapTimeout) clearTimeout(room.trapTimeout);
            room.trapTimeout = setTimeout(() => {
              resolvePendingActionWithoutTrap(room);
            }, 8000);

            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
            return;
          } else {
            opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== aiTrapToActivate.cardId);
            opponent.grave.push({ ...aiTrapToActivate, faceDown: false });
            activateTrapByEffect(gs, opponentKey, aiTrapToActivate, 'attack_declared', { attacker: attackingMonster, targetId });
            
            executeOriginalAction(room, {
              type: 'attack',
              playerKey,
              attackerId,
              targetId
            }, aiTrapToActivate);
            return;
          }
        }

        const eventResult = processEventEffects(gs, 'attack_declared', playerKey, { attacker: attackingMonster, targetId });
        if (eventResult.cancelAttack) {
          io.to(room.code).emit('attack-result', {
            attackerId,
            targetId,
            damage: 0,
            destroyed: []
          });
          if (!checkWinCondition(gs, room.code, io)) {
            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
          }
          return;
        }

        const result = executeAttack(gs, playerKey, attackerId, targetId);
        if (!result.success) {
          socket.emit('error', { message: result.error });
          return;
        }

        const attacker = gs.players[playerKey].field.monsters.find(m => m.cardId === attackerId);
        const target = gs.players[opponentKey].field.monsters.find(m => m.cardId === targetId);

        if (result.damageToDefender > 0) {
          processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: opponentKey, damage: result.damageToDefender });
        }
        if (result.damageToAttacker > 0) {
          processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: playerKey, damage: result.damageToAttacker });
        }

        gs.log.push(`${attacker?.name} attacked ${target?.name}`);

        io.to(room.code).emit('attack-result', {
          attackerId,
          targetId,
          damage: result.damage,
          destroyed: result.destroyed || []
        });
        if (!checkWinCondition(gs, room.code, io)) {
          io.to(room.code).emit('game-state', { state: serialize(gs, null) });
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Direct Attack ---
  socket.on('direct-attack', ({ attackerId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      if (gs.phase !== 'battle') {
        socket.emit('error', { message: 'Can only attack directly during Battle Phase' });
        return;
      }

      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';

      // Check opponent has no monsters
      const opponentMonsters = gs.players[opponentKey].field.monsters.filter(m => !m.destroyed);
      if (opponentMonsters.length > 0) {
        socket.emit('error', { message: 'Opponent has monsters on field' });
        return;
      }

      const opponent = gs.players[opponentKey];
      const opponentIsHuman = opponent && opponent.id && opponent.id !== 'YUGI_AI';
      
      const attackingMonster = gs.players[playerKey].field.monsters.find(m => m.cardId === attackerId);
      const activatableTraps = getActivatableTraps(gs, 'attack_declared', playerKey, { attacker: attackingMonster, targetId: null });

      if (opponentIsHuman && activatableTraps.length > 0) {
        clearAutoPhaseTimeout(room.code);
        room.pendingTrapResponse = {
          type: 'direct-attack',
          event: 'attack_declared',
          playerKey,
          attackerId,
          targetId: null,
          traps: activatableTraps
        };

        io.to(opponent.id).emit('trap-prompt', {
          event: 'attack',
          triggerCard: { name: attackingMonster.name, cardId: attackingMonster.cardId },
          traps: activatableTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
          timeout: 8
        });

        socket.emit('waiting-for-trap', {});

        if (room.trapTimeout) clearTimeout(room.trapTimeout);
        room.trapTimeout = setTimeout(() => {
          resolvePendingActionWithoutTrap(room);
        }, 8000);

        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      } else {
        const opponentIsAI = opponent && opponent.id === 'YUGI_AI';
        let aiTrapToActivate = null;
        if (opponentIsAI && activatableTraps.length > 0) {
          for (const t of activatableTraps) {
            if (shouldAIActivateTrap(gs, t, 'attack_declared', { attacker: attackingMonster, targetId: null })) {
              aiTrapToActivate = t;
              break;
            }
          }
        }

        if (aiTrapToActivate) {
          const humanNegateTraps = gs.players.player1.field.spells.filter(s => s.type === 'trap' && s.faceDown && (s.effect === 'negate_spell' || s.id === 't13' || s.cardId?.startsWith('t13')));
          if (humanNegateTraps.length > 0) {
            clearAutoPhaseTimeout(room.code);
            room.pendingTrapResponse = {
              type: 'counter-trap',
              activatorKey: opponentKey,
              responderKey: playerKey,
              trapCardId: aiTrapToActivate.cardId,
              originalAction: {
                type: 'direct-attack',
                event: 'attack_declared',
                playerKey,
                attackerId,
                targetId: null,
                context: { attacker: attackingMonster, targetId: null }
              }
            };

            socket.emit('trap-prompt', {
              event: 'counter-trap',
              triggerCard: { name: aiTrapToActivate.name, cardId: aiTrapToActivate.cardId },
              traps: humanNegateTraps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
              timeout: 8
            });

            if (room.trapTimeout) clearTimeout(room.trapTimeout);
            room.trapTimeout = setTimeout(() => {
              resolvePendingActionWithoutTrap(room);
            }, 8000);

            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
            return;
          } else {
            opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== aiTrapToActivate.cardId);
            opponent.grave.push({ ...aiTrapToActivate, faceDown: false });
            activateTrapByEffect(gs, opponentKey, aiTrapToActivate, 'attack_declared', { attacker: attackingMonster, targetId: null });
            
            executeOriginalAction(room, {
              type: 'direct-attack',
              playerKey,
              attackerId,
              targetId: null
            }, aiTrapToActivate);
            return;
          }
        }

        const eventResult = processEventEffects(gs, 'attack_declared', playerKey, { attacker: attackingMonster, targetId: null });
        if (eventResult.cancelAttack) {
          io.to(room.code).emit('attack-result', {
            attackerId,
            targetId: null,
            damage: 0,
            destroyed: []
          });
          if (!checkWinCondition(gs, room.code, io)) {
            io.to(room.code).emit('game-state', { state: serialize(gs, null) });
          }
          return;
        }

        const result = directAttack(gs, playerKey, attackerId);
        if (!result.success) {
          socket.emit('error', { message: result.error });
          return;
        }

        const attacker = gs.players[playerKey].field.monsters.find(m => m.cardId === attackerId);
        if (result.damage > 0) {
          processEventEffects(gs, 'battle_damage', playerKey, { damagedPlayerKey: opponentKey, damage: result.damage });
        }
        gs.log.push(`${attacker?.name} attacks ${gs.players[opponentKey].name}'s LP directly for ${result.damage} damage`);

        io.to(room.code).emit('attack-result', {
          attackerId,
          targetId: null,
          damage: result.damage,
          destroyed: []
        });
        if (!checkWinCondition(gs, room.code, io)) {
          io.to(room.code).emit('game-state', { state: serialize(gs, null) });
        }
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Resolve Trap Prompt ---
  socket.on('resolve-trap-prompt', ({ activate, cardId }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.pendingTrapResponse) return;

      if (activate && cardId) {
        resolvePendingActionWithTrap(room, cardId);
      } else {
        resolvePendingActionWithoutTrap(room);
      }
    } catch (err) {
      console.error('[Socket] Error in resolve-trap-prompt:', err);
    }
  });

  // --- End Phase ---
  socket.on('end-phase', () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      const prevPhase = gs.phase;
      const prevPlayer = gs.currentPlayer;
      const result = advancePhase(gs);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }
      processEventEffects(gs, 'phase_start', gs.currentPlayer, { previousPhase: prevPhase, previousPlayer: prevPlayer });
      if (checkWinCondition(gs, room.code, io)) return;

      gs.log.push(`${gs.players[playerKey].name} ended ${gs.phase === 'battle' ? 'Battle Phase' : 'Phase'}`);

      io.to(room.code).emit('turn-start', {
        player: gs.currentPlayer,
        phase: gs.phase,
        turn: gs.turn
      });
      io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      scheduleAutoMainPhase(room);

      // In yugiMode: player1's turn ends when they advance from 'end' phase.
      // At that moment, turn switches to player2 (AI). Clear playerLocked and fire AI.
      const turnJustSwitchedToAI = (room.yugiMode && playerKey === 'player1' && prevPhase === 'end');
      if (turnJustSwitchedToAI) {
        gs.playerLocked = false; // unlock so AI can act
        console.log(`[AI TRIGGER] player1 ended, AI turn beginning (turn ${gs.turn})`);
        setAITimeout(room.code, () => {
          if (room && room.gameState && room.gameState.started) {
            console.log(`[AI START] turn=${gs.turn}, phase=${gs.phase}, currentPlayer=${gs.currentPlayer}`);
            io.to(room.code).emit('yugi-thinking', {});
            executeYugiTurn(gs, io, room.code, (action) => {
              io.to(room.code).emit('yugi-action', { action });
              if (checkWinCondition(gs, room.code, io)) return true;
              io.to(room.code).emit('game-state', { state: serialize(gs, null) });
              return false;
            }).then(() => {
              finishAITurnIfNeeded(room);
            }).catch(() => {});
          }
        }, 600);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- End Turn ---
  // Cycles through all remaining phases then advances once more to trigger AI
  socket.on('end-turn', () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState || !room.gameState.started) {
        socket.emit('error', { message: 'Game not started' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';
      clearAutoPhaseTimeout(room.code);

      if (gs.currentPlayer !== playerKey) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      // Loop through all remaining phases until 'end'
      while (gs.phase !== 'end') {
        const previousPhase = gs.phase;
        const result = advancePhase(gs);
        if (!result.success) break;
        processEventEffects(gs, 'phase_start', gs.currentPlayer, { previousPhase });
        io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      }

      // Advance one more time to switch turns
      const previousPhase = gs.phase;
      const result = advancePhase(gs);
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }
      processEventEffects(gs, 'phase_start', gs.currentPlayer, { previousPhase });
      if (checkWinCondition(gs, room.code, io)) return;

      const prevPlayer = playerKey;
      gs.log.push(`${gs.players[playerKey].name} ended their turn`);

      io.to(room.code).emit('turn-start', {
        player: gs.currentPlayer,
        phase: gs.phase,
        turn: gs.turn
      });
      io.to(room.code).emit('game-state', { state: serialize(gs, null) });
      scheduleAutoMainPhase(room);

      // In yugiMode: player1's turn ends → AI takes over
      const turnJustSwitchedToAI = (room.yugiMode && prevPlayer === 'player1');
      if (turnJustSwitchedToAI) {
        gs.playerLocked = false;
        console.log(`[AI TRIGGER] player1 ended, AI turn beginning (turn ${gs.turn})`);
        setAITimeout(room.code, () => {
          if (room && room.gameState && room.gameState.started) {
            console.log(`[AI START] turn=${gs.turn}, phase=${gs.phase}, currentPlayer=${gs.currentPlayer}`);
            io.to(room.code).emit('yugi-thinking', {});
            executeYugiTurn(gs, io, room.code, (action) => {
              io.to(room.code).emit('yugi-action', { action });
              if (checkWinCondition(gs, room.code, io)) return true;
              io.to(room.code).emit('game-state', { state: serialize(gs, null) });
              return false;
            }).then(() => {
              finishAITurnIfNeeded(room);
            }).catch(() => {});
          }
        }, 600);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Surrender ---
  socket.on('surrender', () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room || !room.gameState) {
        socket.emit('error', { message: 'Not in a game' });
        return;
      }

      const gs = room.gameState;
      const playerKey = gs.players.player1?.id === socket.id ? 'player1' : 'player2';
      const winnerKey = playerKey === 'player1' ? 'player2' : 'player1';

      gs.winner = winnerKey;
      gs.log.push(`${gs.players[playerKey].name} surrendered. ${gs.players[winnerKey].name} wins!`);

      io.to(room.code).emit('game-over', {
        winnerKey,
        winner: gs.players[winnerKey].name,
        reason: 'Surrender'
      });

      clearAITimeout(room.code);
      clearAutoPhaseTimeout(room.code);
      closeRoom(room.code);
      console.log(`[Game] ${room.code}: ${gs.players[playerKey].name} surrendered`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Leave Room ---
  socket.on('leave-room', () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (room) {
        clearAITimeout(room.code);
        clearAutoPhaseTimeout(room.code);
        const playerKey = room.players.player1?.id === socket.id ? 'player1' : 'player2';
        closeRoom(room.code);
        socket.emit('left-room', {});
        socket.leave(room.code);
        console.log(`[Room] ${socket.playerName} left ${room.code}`);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    const room = getRoomBySocket(socket.id);
    if (room) {
      clearAITimeout(room.code);
      clearAutoPhaseTimeout(room.code);
      const playerKey = room.players.player1?.id === socket.id ? 'player1' : 'player2';
      const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
      const opponentSocketId = room.players[opponentKey]?.id;

      if (room.gameState && room.gameState.started && room.players[opponentKey]) {
        // Opponent wins by forfeit
        room.gameState.winner = opponentKey;
        room.gameState.log.push(`${room.players[playerKey]?.name || 'Player'} disconnected. ${room.players[opponentKey]?.name} wins!`);
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('game-over', {
            winnerKey: opponentKey,
            winner: room.players[opponentKey].name,
            reason: 'Opponent disconnected'
          });
        }
      }

      closeRoom(room.code);
      console.log(`[Room] ${socket.playerName} disconnected from ${room.code}`);
    }
  });
});


const EXODIA_ANIMATION_PIECES = [
  { id: 'm103', name: 'Right Arm of the Forbidden One', imgUrl: getCardImageUrl('m103') },
  { id: 'm101', name: 'Right Leg of the Forbidden One', imgUrl: getCardImageUrl('m101') },
  { id: 'm100', name: 'Exodia the Forbidden One', imgUrl: getCardImageUrl('m100') },
  { id: 'm102', name: 'Left Leg of the Forbidden One', imgUrl: getCardImageUrl('m102') },
  { id: 'm104', name: 'Left Arm of the Forbidden One', imgUrl: getCardImageUrl('m104') },
];

function buildGameOverPayload(gs, winnerKey, reason) {
  const isExodia = reason === 'Exodia the Forbidden One';
  return {
    winnerKey,
    winner: gs.players[winnerKey]?.name,
    reason,
    isExodia,
    pieces: isExodia ? EXODIA_ANIMATION_PIECES : [],
  };
}

// --- Win Condition Checker ---
function checkWinCondition(gs, roomCode, io) {
  if (!gs || !gs.started) return !!gs?.winner;

  if (gs.winner) {
    const winnerKey = gs.winner;
    io.to(roomCode).emit('game-over', buildGameOverPayload(gs, winnerKey, gs.winReason || 'Win condition met'));
    gs.started = false;
    clearAITimeout(roomCode);
    clearAutoPhaseTimeout(roomCode);
    closeRoom(roomCode);
    return true;
  }

  for (const key of ['player1', 'player2']) {
    if (gs.players[key].lp <= 0) {
      const winnerKey = key === 'player1' ? 'player2' : 'player1';
      gs.players[key].lp = 0;
      gs.winner = winnerKey;
      gs.winReason = 'LP reached 0';
      gs.log.push(`${gs.players[key].name} ran out of LP! ${gs.players[winnerKey].name} wins!`);
      io.to(roomCode).emit('game-over', buildGameOverPayload(gs, winnerKey, gs.winReason));
      gs.started = false;
      clearAITimeout(roomCode);
      clearAutoPhaseTimeout(roomCode);
      closeRoom(roomCode);
      return true;
    }
  }

  // In Yu-Gi-Oh!, a player loses when they are required to draw but cannot.
  // drawCard() sets gs.winner at the point of failed draw, so this block is a
  // fallback for any older/manual state transitions.
  for (const key of ['player1', 'player2']) {
    if (gs.phase === 'draw' && gs.currentPlayer === key && gs.players[key].deck.length === 0) {
      const winnerKey = key === 'player1' ? 'player2' : 'player1';
      gs.winner = winnerKey;
      gs.winReason = 'No cards to draw';
      gs.log.push(`${gs.players[key].name} cannot draw a card! ${gs.players[winnerKey].name} wins!`);
      io.to(roomCode).emit('game-over', buildGameOverPayload(gs, winnerKey, gs.winReason));
      gs.started = false;
      clearAITimeout(roomCode);
      clearAutoPhaseTimeout(roomCode);
      closeRoom(roomCode);
      return true;
    }
  }

  return false;
}

// --- Start Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Yu-Gi-Oh! server running on port ${PORT}`);
});
