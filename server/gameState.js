/**
 * Server-authoritative game state management
 * Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 */

import CARDS from './cards.js';
import { getCardImageUrl } from './cardImages.js';

const STARTING_LP = 8000;
const EXODIA_IDS = ['m101', 'm102', 'm103', 'm104', 'm105'];

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
    lp: STARTING_LP,
    deck: [],
    hand: [],
    field: { monsters: [], spells: [] },
    grave: [],
    ready: false,
    hasNormalSummoned: false,
    attackedMonsters: [],
  };
}

function createGameState(player1Name, player2Name, options = {}) {
  const firstPlayer = options.firstPlayer === 'player2' ? 'player2' : 'player1';
  const p1Deck = shuffleDeck(buildDeckFromIds(options.player1DeckIds) || generateDeck());
  const p2Deck = shuffleDeck(buildDeckFromIds(options.player2DeckIds) || generateDeck());

  const state = {
    players: {
      player1: createPlayerState(player1Name),
      player2: createPlayerState(player2Name),
    },
    turn: 1,
    currentPlayer: firstPlayer,
    phase: 'draw',
    winner: null,
    log: [],
    started: false,
    playerLocked: false,  // Prevents AI from firing during player actions
    coinFlip: options.coinFlip || null,
  };

  state.players.player1.deck = p1Deck;
  state.players.player2.deck = p2Deck;

  // Draw opening hands (5 cards each)
  for (let i = 0; i < 5; i++) {
    drawCard(state, 'player1');
    drawCard(state, 'player2');
  }

  // Early Power of Chaos/tutorial flow lets the starting player draw on turn 1.
  drawCard(state, firstPlayer);

  return state;
}

function instantiateDeck(cardIds) {
  const counts = new Map();
  return cardIds.map((id) => {
    const card = CARDS.find(c => c.id === id);
    if (!card) return null;
    const copy = counts.get(id) || 0;
    counts.set(id, copy + 1);
    return { ...card, uid: `${id}_${copy}`, cardId: `${id}_${copy}` };
  }).filter(Boolean);
}

function buildDeckFromIds(cardIds) {
  if (!Array.isArray(cardIds)) return null;
  const mainIds = cardIds.filter(id => CARDS.some(c => c.id === id && c.type !== 'fusion'));
  if (mainIds.length < 40) return null;
  const counts = mainIds.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
  if (Object.values(counts).some(count => count > 3)) return null;
  return instantiateDeck(mainIds);
}

function getBaseCardId(card) {
  return card?.id || card?.cardId?.replace(/_[0-9]+$/, '') || null;
}

function hasAllExodiaPieces(player) {
  const handIds = new Set((player.hand || []).map(getBaseCardId).filter(Boolean));
  return EXODIA_IDS.every(id => handIds.has(id));
}

function checkExodiaWin(state, playerKey) {
  const player = state.players[playerKey];
  if (!player || !hasAllExodiaPieces(player)) return false;
  state.winner = playerKey;
  state.winReason = 'Exodia the Forbidden One';
  state.log.push(`${player.name} assembled all five pieces of Exodia! ${player.name} wins!`);
  return true;
}

function generateDeck() {
  // Build a legal 40-card early-PoC style starter deck from the unlocked pool.
  const monsters = CARDS.filter(c => c.type === 'monster');
  const spellsAndTraps = CARDS.filter(c => c.type === 'spell' || c.type === 'trap');
  const deckIds = [];
  for (const m of [...monsters].sort(() => Math.random() - 0.5).slice(0, 12)) {
    deckIds.push(m.id, m.id);
  }
  for (const s of [...spellsAndTraps].sort(() => Math.random() - 0.5).slice(0, 16)) {
    deckIds.push(s.id);
  }
  return shuffleDeck(instantiateDeck(deckIds.slice(0, 40)));
}

function drawCard(state, playerKey) {
  const player = state.players[playerKey];
  if (player.skipNextDraw) {
    player.skipNextDraw = false;
    state.log.push(`${player.name} skips their draw due to a card effect!`);
    return;
  }
  if (player.deck.length === 0) {
    const winnerKey = playerKey === 'player1' ? 'player2' : 'player1';
    state.winner = winnerKey;
    state.winReason = 'No cards to draw';
    state.log.push(`${player.name} cannot draw a card! ${state.players[winnerKey].name} wins!`);
    return null;
  }
  const card = player.deck.pop();
  player.hand.push(card);
  checkExodiaWin(state, playerKey);
  return card;
}

function summonMonster(state, playerKey, cardId, position = 'defense', tributeIds = []) {
  const p = state.players[playerKey];
  const cardIndex = p.hand.findIndex(c => c.cardId === cardId);
  if (cardIndex === -1) {
    return { success: false, error: 'Card not in hand' };
  }

  const card = p.hand[cardIndex];

  // Limit 1 Normal Summon/Set per turn
  if (p.hasNormalSummoned) {
    return { success: false, error: 'You have already Normal Summoned or Set a monster this turn.' };
  }

  // Prevent Normal Summoning monsters that must be Special Summoned
  const desc = card.description || '';
  if (desc.includes('Cannot be Normal Summoned') || card.category === 'ritual' || card.category === 'fusion') {
    return { success: false, error: 'This card cannot be Normal Summoned or Set.' };
  }

  // Check Tribute requirements
  const level = card.level || 0;
  let requiredTributes = 0;
  if (level >= 5 && level <= 6) requiredTributes = 1;
  if (level >= 7) requiredTributes = 2;

  if (requiredTributes > 0) {
    if (p.field.monsters.length < requiredTributes) {
      return { success: false, error: `Requires ${requiredTributes} tributes for Level ${level}` };
    }
    
    let tributes = [];
    if (tributeIds && tributeIds.length > 0) {
      if (tributeIds.length !== requiredTributes) {
        return { success: false, error: `Invalid number of tributes selected: expected ${requiredTributes}` };
      }
      for (const tId of tributeIds) {
        const monster = p.field.monsters.find(m => m.cardId === tId);
        if (!monster) {
          return { success: false, error: 'Selected tribute monster not found on field' };
        }
        tributes.push(monster);
      }
    } else {
      // Auto-tribute weakest monsters (fallback / AI)
      const sortedMonsters = [...p.field.monsters].sort((a, b) => (a.atk || 0) - (b.atk || 0));
      tributes = sortedMonsters.slice(0, requiredTributes);
    }
    
    // Remove tributes from field
    p.field.monsters = p.field.monsters.filter(m => !tributes.some(t => t.cardId === m.cardId));
    p.grave.push(...tributes.map(m => ({ ...m, faceDown: false })));
    
    state.log.push(`${p.name} tributed ${tributes.length} monster(s) (${tributes.map(t => t.name).join(', ')}) to summon ${card.name}`);
  }

  // Actually remove from hand
  p.hand.splice(cardIndex, 1);

  card.position = position;
  card.faceDown = position === 'defense' || position === 'set';
  if (card.faceDown) {
    card.position = 'defense';
  }
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
    // Import dynamically to avoid circular dependencies if any arise later, or just use the imported one
    if (typeof target.effect === 'string' && target.effect.startsWith('flip_')) {
        import('./rules.js').then(r => r.resolveFlipEffect(state, opponentKey, target));
    }
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
  if (damageToAttacker > 0) {
    if (p.redirectNextDamage) {
      p.redirectNextDamage = false;
      opp.lp -= damageToAttacker;
      state.log.push(`Medal of the Caught redirected ${damageToAttacker} damage to ${opp.name}!`);
    } else {
      if (p.doubleNextDamage) { damageToAttacker *= 2; p.doubleNextDamage = false; state.log.push(`Damage to ${p.name} was doubled!`); }
      p.lp -= damageToAttacker;
    }
  }
  if (damageToDefender > 0) {
    if (opp.redirectNextDamage) {
      opp.redirectNextDamage = false;
      p.lp -= damageToDefender;
      state.log.push(`Medal of the Caught redirected ${damageToDefender} damage to ${p.name}!`);
    } else {
      if (opp.doubleNextDamage) { damageToDefender *= 2; opp.doubleNextDamage = false; state.log.push(`Damage to ${opp.name} was doubled!`); }
      opp.lp -= damageToDefender;
    }
  }

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
    damageToAttacker,
    damageToDefender,
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

    // Reset new player's flags to guarantee a clean turn state
    const nextP = state.players[opponentKey];
    nextP.hasNormalSummoned = false;
    nextP.attackedMonsters = [];

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
    // opponentKey is the OTHER player (not the one being serialized)
    const opponentKey = key === 'player1' ? 'player2' : 'player1';

    return {
      name: player.name,
      lp: player.lp,
      // Show full hand only to owner
      hand: isOwner ? player.hand.map(c => ({ ...c, imgUrl: getCardImageUrl(c.cardId) })) : player.hand.map(() => ({ hidden: true })),
      deck: isOwner ? player.deck.map(c => ({ ...c, imgUrl: getCardImageUrl(c.cardId) })) : player.deck.map(() => ({ hidden: true })),
      deckCount: player.deck.length,
      field: {
        monsters: player.field.monsters.map(m => ({
          ...m,
          imgUrl: getCardImageUrl(m.cardId),
        })),
        spells: player.field.spells.map(s => ({
          ...s,
          imgUrl: getCardImageUrl(s.cardId),
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
    winReason: state.winReason || null,
    log: state.log,
    started: state.started,
  };
}

function getActivatableTraps(gs, event, playerKey, context = {}) {
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = gs.players[opponentKey];
  if (!opponent) return [];
  
  if (event === 'summon') {
    return (opponent.field?.spells || []).filter(s => 
      s.type === 'trap' && 
      s.faceDown && 
      ['destroy_monster', 'destroy_1000atk_monster'].includes(s.effect) && 
      (context.summonedMonster?.atk || 0) >= 1000
    );
  }
  
  if (event === 'attack_declared') {
    return (opponent.field?.spells || []).filter(s => 
      s.type === 'trap' && 
      s.faceDown && 
      ['destroy_attackers', 'reflect_battle'].includes(s.effect)
    );
  }
  
  return [];
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
  buildDeckFromIds,
  hasAllExodiaPieces,
  checkExodiaWin,
  EXODIA_IDS,
  getActivatableTraps,
};
