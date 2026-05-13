/**
 * Server-authoritative game state management
 * Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 */

import CARDS from './cards.js';
import { getCardImageUrl } from './cardImages.js';

// Fisher-Yates shuffle
function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createPlayerState(name, socketId = null) {
  return {
    id: socketId,
    name,
    lp: 4000,
    deck: [],
    hand: [],
    field: { monsters: [], spells: [] },
    grave: [],
    ready: false,
    hasNormalSummoned: false,
    attackedMonsters: [],
  };
}

function createGameState(player1Name, player2Name) {
  // Create decks (40 cards each - simplified starter decks)
  const p1Deck = shuffleDeck(generateDeck());
  const p2Deck = shuffleDeck(generateDeck());

  const state = {
    players: {
      player1: createPlayerState(player1Name),
      player2: createPlayerState(player2Name),
    },
    turn: 1,
    currentPlayer: 'player1',
    phase: 'draw',
    winner: null,
    log: [],
    started: false,
    playerLocked: false,  // Prevents AI from firing during player actions
  };

  state.players.player1.deck = p1Deck;
  state.players.player2.deck = p2Deck;

  // Draw opening hands (5 cards each)
  for (let i = 0; i < 5; i++) {
    drawCard(state, 'player1');
    drawCard(state, 'player2');
  }

  return state;
}

function generateDeck() {
  // Build a 40-card deck from the 160-card pool
  // Pick 10 unique monsters (3 copies each = 30) + 5 spells (2 copies = 10)
  const monsters = CARDS.filter(c => c.type === 'monster');
  const spells = CARDS.filter(c => c.type === 'spell');
  
  // Shuffle and pick 10 monsters (3 copies each)
  const shuffledMonsters = [...monsters].sort(() => Math.random() - 0.5).slice(0, 10);
  const deck = [];
  for (const m of shuffledMonsters) {
    for (let i = 0; i < 3; i++) {
      deck.push({ ...m, uid: `${m.id}_${i}`, cardId: `${m.id}_${i}` });
    }
  }
  
  // Pick 5 spells (2 copies each)
  const shuffledSpells = [...spells].sort(() => Math.random() - 0.5).slice(0, 5);
  for (const s of shuffledSpells) {
    for (let i = 0; i < 2; i++) {
      deck.push({ ...s, uid: `${s.id}_${i}`, cardId: `${s.id}_${i}` });
    }
  }
  
  return shuffleDeck(deck);
}

function drawCard(state, playerKey) {
  const p = state.players[playerKey];
  if (p.deck.length === 0) return null;
  const card = p.deck.pop();
  p.hand.push(card);
  return card;
}

function summonMonster(state, playerKey, cardId, position = 'defense') {
  const p = state.players[playerKey];
  const cardIndex = p.hand.findIndex(c => c.cardId === cardId);
  if (cardIndex === -1) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = p.hand.splice(cardIndex, 1)[0];
  card.position = position;
  card.faceDown = false;
  p.field.monsters.push(card);
  p.hasNormalSummoned = true;

  return { success: true, card };
}

function setSpellTrap(state, playerKey, cardId, faceDown = true) {
  const p = state.players[playerKey];
  const cardIndex = p.hand.findIndex(c => c.cardId === cardId);
  if (cardIndex === -1) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = p.hand.splice(cardIndex, 1)[0];
  card.faceDown = faceDown;
  card.position = faceDown ? 'set' : 'open';
  p.field.spells.push(card);

  return { success: true, card };
}

function canAttack(state, playerKey) {
  if (state.phase !== 'battle') return false;
  if (state.currentPlayer !== playerKey) return false;
  const p = state.players[playerKey];
  return p.field.monsters.some(m => m.position === 'attack' && !p.attackedMonsters.includes(m.cardId));
}

function executeAttack(state, playerKey, attackerId, targetId) {
  const p = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opp = state.players[opponentKey];

  const attacker = p.field.monsters.find(m => m.cardId === attackerId);
  const target = opp.field.monsters.find(m => m.cardId === targetId);

  if (!attacker || !target) {
    return { success: false, error: 'Invalid monster IDs' };
  }
  if (attacker.position !== 'attack') {
    return { success: false, error: 'Attacker must be in attack position' };
  }
  if (p.attackedMonsters.includes(attackerId)) {
    return { success: false, error: 'Monster already attacked' };
  }

  // Flip face-down defense monster
  if (target.faceDown) {
    target.faceDown = false;
    target.position = 'defense';
  }

  // Mark attacker as having attacked
  p.attackedMonsters.push(attackerId);

  // Resolve battle
  let damageToAttacker = 0;
  let damageToDefender = 0;
  let destroyedAttacker = false;
  let destroyedDefender = false;

  if (attacker.position === 'attack' && target.position === 'attack') {
    if (attacker.atk > target.atk) {
      damageToDefender = attacker.atk - target.atk;
      destroyedDefender = true;
    } else if (target.atk > attacker.atk) {
      damageToAttacker = target.atk - attacker.atk;
      destroyedAttacker = true;
    } else {
      destroyedAttacker = true;
      destroyedDefender = true;
    }
  } else if (attacker.position === 'attack' && target.position === 'defense') {
    if (attacker.atk > target.def) {
      destroyedDefender = true;
    } else if (target.def > attacker.atk) {
      damageToAttacker = target.def - attacker.atk;
    }
  }

  // Apply damage
  if (damageToAttacker > 0) p.lp -= damageToAttacker;
  if (damageToDefender > 0) opp.lp -= damageToDefender;

  // Handle destroyed monsters
  if (destroyedAttacker) {
    p.field.monsters = p.field.monsters.filter(m => m.cardId !== attackerId);
    p.grave.push(attacker);
  }
  if (destroyedDefender) {
    opp.field.monsters = opp.field.monsters.filter(m => m.cardId !== targetId);
    opp.grave.push(target);
  }

  return {
    success: true,
    damage: damageToDefender,
    destroyed: [...(destroyedAttacker ? [attackerId] : []), ...(destroyedDefender ? [targetId] : [])]
  };
}

function directAttack(state, playerKey, attackerId) {
  const p = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opp = state.players[opponentKey];

  const attacker = p.field.monsters.find(m => m.cardId === attackerId);
  if (!attacker) return { success: false, error: 'Invalid monster ID' };
  if (attacker.position !== 'attack') return { success: false, error: 'Must be in attack position' };
  if (p.attackedMonsters.includes(attackerId)) return { success: false, error: 'Monster already attacked' };
  if (opp.field.monsters.length > 0) return { success: false, error: 'Opponent has monsters on field' };

  p.attackedMonsters.push(attackerId);
  opp.lp -= attacker.atk;

  return { success: true, damage: attacker.atk };
}

const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];

function advancePhase(state) {
  const currentIndex = PHASES.indexOf(state.phase);
  if (currentIndex < PHASES.length - 1) {
    state.phase = PHASES[currentIndex + 1];
    return { success: true, newPhase: state.phase };
  } else {
    // End of turn
    const currentPlayer = state.currentPlayer;
    const opponentKey = currentPlayer === 'player1' ? 'player2' : 'player1';

    // Reset current player's flags
    const currentP = state.players[currentPlayer];
    currentP.hasNormalSummoned = false;
    currentP.attackedMonsters = [];

    // Switch players
    state.currentPlayer = opponentKey;
    state.turn++;
    state.phase = 'draw';

    // Reset playerLocked so the new current player can act
    state.playerLocked = false;

    // Draw phase
    drawCard(state, state.currentPlayer);

    return { success: true, newPhase: 'draw' };
  }
}

function serialize(state, forSocketId) {
  // Determine which player corresponds to the socket
  const isP1 = forSocketId === null || forSocketId === state.players.player1?.id;

  const serializePlayer = (key, isOwner) => {
    const player = state.players[key];
    const opponentKey = key === 'player1' ? 'player2' : 'player1';
    const opponent = state.players[opponentKey];

    return {
      name: player.name,
      lp: player.lp,
      // Show full hand only to owner
      hand: isOwner ? player.hand.map(c => ({ ...c, imgUrl: getCardImageUrl(c.cardId) })) : player.hand.map(() => ({ hidden: true })),
      deckCount: player.deck.length,
      field: {
        monsters: player.field.monsters.map(m => ({
          ...m,
          imgUrl: getCardImageUrl(m.cardId),
          // Hide face-down cards that belong to opponent
          faceDown: isOwner ? m.faceDown : (opponent?.id === forSocketId ? m.faceDown : m.faceDown),
        })),
        spells: player.field.spells.map(s => ({
          ...s,
          imgUrl: getCardImageUrl(s.cardId),
          faceDown: isOwner ? s.faceDown : s.faceDown,
        })),
      },
      grave: player.grave,
    };
  };

  let playerView, opponentView;
  if (isP1) {
    playerView = serializePlayer('player1', true);
    opponentView = serializePlayer('player2', false);
  } else {
    playerView = serializePlayer('player2', true);
    opponentView = serializePlayer('player1', false);
  }

  return {
    player: playerView,
    opponent: opponentView,
    players: {
      player1: playerView,
      player2: opponentView,
    },
    turn: state.turn,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    winner: state.winner,
    log: state.log,
    started: state.started,
  };
}

export {
  createGameState,
  drawCard,
  shuffleDeck,
  summonMonster,
  setSpellTrap,
  canAttack,
  executeAttack,
  directAttack,
  advancePhase,
  serialize,
  PHASES,
};
