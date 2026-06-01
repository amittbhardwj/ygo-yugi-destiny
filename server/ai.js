/**
 * Yugi AI Engine - Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 * AI opponent logic for single-player mode
 */

import { summonMonster, setSpellTrap, executeAttack, directAttack, advancePhase, serialize, getActivatableTraps } from './gameState.js';
import { resolveSpellEffect, processEventEffects } from './rules.js';
import { rooms } from './rooms.js';
import CARDS from './cards.js';

async function waitForTrap(room) {
  if (!room) return;
  while (room.pendingTrapResponse) {
    await delay(200);
  }
}

const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];

// Build CARD_DATABASE dynamically from shared CARDS
const CARD_DATABASE = {};
for (const card of CARDS) {
  CARD_DATABASE[card.id] = card;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function roll(chance) {
  return Math.random() < chance;
}

function getCardBase(cardId) {
  if (!cardId) return null;
  const id = cardId.split('_')[0];
  return CARD_DATABASE[id] || null;
}

function isExodiaPiece(cardId) {
  if (!cardId) return false;
  const id = cardId.split('_')[0];
  return ['m100', 'm101', 'm102', 'm103', 'm104'].includes(id);
}

function getMonsterAtk(card) {
  if (!card) return 0;
  return card.atk || getCardBase(card.cardId)?.atk || 0;
}

function getMonsterDef(card) {
  if (!card) return 0;
  return card.def || getCardBase(card.cardId)?.def || 0;
}

function findMonsterInHand(hand) {
  return hand.filter(c => {
    const base = getCardBase(c.cardId);
    return base && base.type === 'monster' && !isExodiaPiece(c.cardId);
  });
}

function findSpellInHand(hand) {
  return hand.filter(c => {
    const base = getCardBase(c.cardId);
    return base && base.type === 'spell';
  });
}

function findTrapInHand(hand) {
  return hand.filter(c => {
    const base = getCardBase(c.cardId);
    return base && base.type === 'trap';
  });
}

function sortMonstersByPriority(monsters, preferDef = false) {
  return [...monsters].sort((a, b) => {
    const baseA = getCardBase(a.cardId);
    const baseB = getCardBase(b.cardId);
    const scoreA = preferDef ? (baseA?.def || 0) : (baseA?.atk || 0);
    const scoreB = preferDef ? (baseB?.def || 0) : (baseB?.atk || 0);
    return scoreB - scoreA;
  });
}

function reportAction(emitFn, action) {
  return emitFn(action) === true;
}

/**
 * Execute Yugi's turn. This is called after the draw phase.
 * It processes one action at a time with delay between each,
 * using the emitFn callback for each action taken.
 *
 * @param {Object} gameState - The server game state
 * @param {Object} io - Socket.IO server instance
 * @param {string} roomCode - Room code for broadcasting
 * @param {Function} emitFn - Called after each AI action: (action) => void
 */
async function executeYugiTurn(gameState, io, roomCode, emitFn) {
  const AI_KEY = 'player2'; // Yugi is always player2 in yugiMode
  const PLAYER_KEY = 'player1';
  const ai = gameState.players[AI_KEY];
  const player = gameState.players[PLAYER_KEY];

  const THINK_DELAY = 500 + Math.random() * 300;

  // Advance to next phase and notify clients
  async function stepPhase(emitFn) {
    const result = advancePhase(gameState);
    if (result.success) {
      io.to(roomCode).emit('turn-start', {
        player: gameState.currentPlayer,
        phase: gameState.phase,
        turn: gameState.turn
      });
      io.to(roomCode).emit('game-state', { state: serialize(gameState, null) });
    }
    await delay(THINK_DELAY);
  }

  // GUARD: Only act if it's AI's turn and player is not locked
  if (gameState.currentPlayer !== AI_KEY || gameState.playerLocked) {
    return;
  }

  // ---- DRAW PHASE ----
  await delay(THINK_DELAY);
  await stepPhase(emitFn); // draw → standby

  // ---- STANDBY PHASE ----
  await delay(THINK_DELAY);
  await stepPhase(emitFn); // standby → main1

  // ---- MAIN PHASE 1 ----
  await delay(THINK_DELAY);

  const oppMonsters = player.field.monsters.filter(Boolean);
  const strongestOppAtk = oppMonsters.reduce((max, m) => {
    const mAtk = m.position === 'attack' ? (m.atk || 0) : 0;
    return mAtk > max ? mAtk : max;
  }, 0);

  const availableTributes = ai.field.monsters.length;
  const summonable = findMonsterInHand(ai.hand).filter(c => {
    const base = getCardBase(c.cardId);
    if (!base) return false;
    const lvl = base.level || 4;
    if (lvl >= 7) return availableTributes >= 2;
    if (lvl >= 5) return availableTributes >= 1;
    return true;
  });

  if (summonable.length > 0 && !ai.hasNormalSummoned) {
    const bestInHandAtk = sortMonstersByPriority(summonable, false)[0];
    const bestInHandDef = sortMonstersByPriority(summonable, true)[0];
    
    const baseAtk = getCardBase(bestInHandAtk.cardId);
    const baseDef = getCardBase(bestInHandDef.cardId);
    
    let best = bestInHandAtk;
    let position = 'attack';
    
    if ((baseDef?.def || 0) > (baseAtk?.atk || 0) || strongestOppAtk > (baseAtk?.atk || 0) || ai.lp < 2000) {
      best = bestInHandDef;
      position = 'defense';
    }

    const result = summonMonster(gameState, AI_KEY, best.cardId, position);
    if (result.success) {
      const action = { type: 'summon', cardId: best.cardId, position };
      const displayPos = position === 'defense' ? 'face-down Defense Position' : 'Attack Position';
      gameState.log.push(`Yugi summoned ${best.name} in ${displayPos}`);
      
      const traps = getActivatableTraps(gameState, 'summon', AI_KEY, { summonedMonster: result.card });
      const player1Socket = gameState.players.player1?.id;
      
      if (player1Socket && traps.length > 0) {
        const room = rooms.get(roomCode);
        if (room) {
          room.pendingTrapResponse = {
            type: 'summon',
            event: 'summon',
            playerKey: AI_KEY,
            cardId: best.cardId,
            position,
            traps,
            context: { summonedMonster: result.card }
          };
          
          io.to(player1Socket).emit('trap-prompt', {
            event: 'summon',
            triggerCard: { name: result.card.name, cardId: result.card.cardId },
            traps: traps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
            timeout: 8
          });
          
          io.to(roomCode).emit('game-state', { state: serialize(gameState, null) });
          
          if (room.trapTimeout) clearTimeout(room.trapTimeout);
          room.trapTimeout = setTimeout(() => {
            if (room.resolvePendingActionWithoutTrap) room.resolvePendingActionWithoutTrap();
          }, 8000);
          
          await waitForTrap(room);
        }
      } else {
        processEventEffects(gameState, 'summon', AI_KEY, { summonedMonster: result.card });
        if (reportAction(emitFn, action)) return;
        await delay(THINK_DELAY);
      }
    }
  }

  // Set a trap if available
  const traps = findTrapInHand(ai.hand);
  if (traps.length > 0 && ai.field.spells.length < 5) {
    const trap = traps[0];
    const result = setSpellTrap(gameState, AI_KEY, trap.cardId, true);
    if (result.success) {
      const action = { type: 'set-trap', cardId: trap.cardId, faceDown: true };
      gameState.log.push(`Yugi set a trap`);
      if (reportAction(emitFn, action)) return;
      await delay(THINK_DELAY);
    }
  }

  // Play spells
  const spells = findSpellInHand(ai.hand);
  for (const spell of spells) {
    const base = getCardBase(spell.cardId);
    if (!base) continue;

    // Random 15% chance to skip a spell (makes AI beatable)
    if (roll(0.15)) continue;

    // Heuristics
    if (base.effect === 'destroy_all_monsters') {
      const oppCount = player.field.monsters.filter(Boolean).length;
      const myCount = ai.field.monsters.filter(Boolean).length;
      if (oppCount === 0) continue;
      const myMaxAtk = ai.field.monsters.reduce((max, m) => Math.max(max, m.atk || 0), 0);
      const oppMaxAtk = player.field.monsters.reduce((max, m) => Math.max(max, m.atk || 0), 0);
      if (myCount > 0 && oppMaxAtk <= myMaxAtk) continue;
    }

    if (base.effect === 'destroy_opponent_monsters') {
      const oppCount = player.field.monsters.filter(Boolean).length;
      if (oppCount === 0) continue;
    }

    if (base.effect === 'life_gain' || base.effect === 'heal_500') {
      if (ai.lp >= 7500) continue;
    }

    if (base.category === 'equip' || base.effect === 'atk_boost' || base.effect === 'spellcaster_boost' || base.effect === 'boost_by_spells') {
      const myFaceUpCount = ai.field.monsters.filter(m => m && !m.faceDown).length;
      if (myFaceUpCount === 0) continue;
    }

    if (ai.field.spells.length < 5) {
      const setResult = setSpellTrap(gameState, AI_KEY, spell.cardId, false);
      if (setResult.success) {
        const resolveResult = resolveSpellEffect(gameState, AI_KEY, spell.cardId);
        if (resolveResult.success) {
          gameState.log.push(`Yugi activated Spell card: ${base.name}!`);
          if (reportAction(emitFn, { type: 'spell', cardId: spell.cardId })) return;
          await delay(THINK_DELAY);
        }
      }
    }
  }

  // ---- BATTLE PHASE ----
  await delay(THINK_DELAY);
  await stepPhase(emitFn); // main1 → battle
  await delay(THINK_DELAY);

  // Smart flip check
  for (const monster of ai.field.monsters) {
    if (monster.position === 'defense' && !monster.faceDown) {
      const atk = monster.atk || 0;
      const def = monster.def || 0;
      const oppMonsters = player.field.monsters.filter(Boolean);
      
      let shouldFlip = false;
      if (atk > def) {
        if (oppMonsters.length === 0) {
          shouldFlip = true;
        } else {
          shouldFlip = oppMonsters.some(opp => {
            const oppAtk = opp.position === 'attack' ? (opp.atk || 0) : (opp.def || 0);
            return atk >= oppAtk;
          });
        }
      }
      
      if (shouldFlip) {
        monster.position = 'attack';
        monster.faceDown = false;
        gameState.log.push(`Yugi flipped ${monster.name} to Attack Position`);
        if (reportAction(emitFn, { type: 'flip', cardId: monster.cardId })) return;
        await delay(THINK_DELAY);
      }
    }
  }

  // Get attack-ready monsters
  const attackers = ai.field.monsters.filter(m =>
    m.position === 'attack' && !ai.attackedMonsters.includes(m.cardId)
  );

  for (const attacker of attackers) {
    const oppMonsters = player.field.monsters.filter(Boolean);

    if (oppMonsters.length === 0) {
      // Direct attack
      const traps = getActivatableTraps(gameState, 'attack_declared', AI_KEY, { attacker, targetId: null });
      const player1Socket = gameState.players.player1?.id;
      
      if (player1Socket && traps.length > 0) {
        const room = rooms.get(roomCode);
        if (room) {
          room.pendingTrapResponse = {
            type: 'direct-attack',
            event: 'attack_declared',
            playerKey: AI_KEY,
            attackerId: attacker.cardId,
            targetId: null,
            traps
          };
          
          io.to(player1Socket).emit('trap-prompt', {
            event: 'attack',
            triggerCard: { name: attacker.name, cardId: attacker.cardId },
            traps: traps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
            timeout: 8
          });
          
          io.to(roomCode).emit('game-state', { state: serialize(gameState, null) });
          
          if (room.trapTimeout) clearTimeout(room.trapTimeout);
          room.trapTimeout = setTimeout(() => {
            if (room.resolvePendingActionWithoutTrap) room.resolvePendingActionWithoutTrap();
          }, 8000);
          
          await waitForTrap(room);
        }
      } else {
        const eventResult = processEventEffects(gameState, 'attack_declared', AI_KEY, { attacker, targetId: null });
        if (eventResult.cancelAttack) {
          if (reportAction(emitFn, { type: 'attack', attackerId: attacker.cardId, targetId: null, damage: 0, destroyed: [] })) return;
          ai.attackedMonsters.push(attacker.cardId);
          await delay(THINK_DELAY);
        } else {
          const result = directAttack(gameState, AI_KEY, attacker.cardId);
          if (result.success) {
            gameState.log.push(`Yugi's ${attacker.name} attacks directly for ${result.damage}!`);
            if (reportAction(emitFn, { type: 'direct-attack', attackerId: attacker.cardId, damage: result.damage })) return;
            ai.attackedMonsters.push(attacker.cardId);
            await delay(THINK_DELAY);
          }
        }
      }
    } else {
      // Find the best target
      let bestTarget = null;
      let bestScore = -9999;
      
      for (const current of oppMonsters) {
        let score = -9999;
        const currentAtk = getMonsterAtk(current);
        const currentDef = getMonsterDef(current);
        const attackerAtk = getMonsterAtk(attacker);

        if (current.position === 'attack') {
          if (attackerAtk > currentAtk) {
            score = attackerAtk - currentAtk + 500;
          } else if (attackerAtk === currentAtk) {
            score = 10;
          }
        } else {
          if (current.faceDown) {
            // Attack face-down monsters without knowing their DEF!
            score = 50;
          } else if (attackerAtk > currentDef) {
            score = 100;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestTarget = current;
        }
      }

      // 10% beatable randomness
      if (roll(0.1)) {
        if (roll(0.5) && oppMonsters.length > 0) {
          bestTarget = oppMonsters[Math.floor(Math.random() * oppMonsters.length)];
          const attackerAtk = getMonsterAtk(attacker);
          const targetVal = bestTarget.position === 'attack' ? getMonsterAtk(bestTarget) : getMonsterDef(bestTarget);
          bestScore = attackerAtk >= targetVal ? 1 : -1;
        } else {
          bestTarget = null;
        }
      }

      if (bestTarget && bestScore >= 0) {
        const traps = getActivatableTraps(gameState, 'attack_declared', AI_KEY, { attacker, targetId: bestTarget.cardId });
        const player1Socket = gameState.players.player1?.id;
        
        if (player1Socket && traps.length > 0) {
          const room = rooms.get(roomCode);
          if (room) {
            room.pendingTrapResponse = {
              type: 'attack',
              event: 'attack_declared',
              playerKey: AI_KEY,
              attackerId: attacker.cardId,
              targetId: bestTarget.cardId,
              traps
            };
            
            io.to(player1Socket).emit('trap-prompt', {
              event: 'attack',
              triggerCard: { name: attacker.name, cardId: attacker.cardId },
              traps: traps.map(t => ({ cardId: t.cardId, name: t.name, description: t.description })),
              timeout: 8
            });
            
            io.to(roomCode).emit('game-state', { state: serialize(gameState, null) });
            
            if (room.trapTimeout) clearTimeout(room.trapTimeout);
            room.trapTimeout = setTimeout(() => {
              if (room.resolvePendingActionWithoutTrap) room.resolvePendingActionWithoutTrap();
            }, 8000);
            
            await waitForTrap(room);
          }
        } else {
          // No human traps. Resolve attack normally.
          const eventResult = processEventEffects(gameState, 'attack_declared', AI_KEY, { attacker, targetId: bestTarget.cardId });
          if (eventResult.cancelAttack) {
            if (reportAction(emitFn, { type: 'attack', attackerId: attacker.cardId, targetId: bestTarget.cardId, damage: 0, destroyed: [] })) return;
            ai.attackedMonsters.push(attacker.cardId);
            await delay(THINK_DELAY);
          } else {
            const result = executeAttack(gameState, AI_KEY, attacker.cardId, bestTarget.cardId);
            if (result.success) {
              if (result.damageToDefender > 0) {
                processEventEffects(gameState, 'battle_damage', AI_KEY, { damagedPlayerKey: PLAYER_KEY, damage: result.damageToDefender });
              }
              if (result.damageToAttacker > 0) {
                processEventEffects(gameState, 'battle_damage', AI_KEY, { damagedPlayerKey: AI_KEY, damage: result.damageToAttacker });
              }
              gameState.log.push(`Yugi's ${attacker.name} attacks ${bestTarget.name}`);
              if (reportAction(emitFn, {
                type: 'attack',
                attackerId: attacker.cardId,
                targetId: bestTarget.cardId,
                damage: result.damage,
                destroyed: result.destroyed
              })) return;
              ai.attackedMonsters.push(attacker.cardId);
              await delay(THINK_DELAY);
            }
          }
        }
      } else {
        // Can't safely attack any monster
        ai.attackedMonsters.push(attacker.cardId);
      }
    }
  }

  // ---- MAIN PHASE 2 ----
  await delay(THINK_DELAY);
  await stepPhase(emitFn); // battle → main2
  await delay(THINK_DELAY);

  // ---- END PHASE ----
  await stepPhase(emitFn); // main2 → end
  gameState.log.push(`Yugi ended their turn`);
  reportAction(emitFn, { type: 'end-phase' });
}

function shouldAIActivateTrap(gameState, trap, event, context = {}) {
  // Beatable randomness: 10% chance to just fail/ignore the trap activation entirely
  if (Math.random() < 0.10) {
    return false;
  }

  const ai = gameState.players.player2;
  const player = gameState.players.player1;

  if (event === 'summon') {
    const summoned = context.summonedMonster;
    const atk = summoned?.atk || 0;
    
    // Trap Hole (destroy_monster / destroy_1000atk_monster)
    if (trap.effect === 'destroy_monster' || trap.effect === 'destroy_1000atk_monster') {
      // Meaningful threat: ATK >= 1500, or if AI LP is low (< 2500) and ATK >= 1000
      if (atk >= 1500) return Math.random() < 0.85;
      if (ai.lp < 2500 && atk >= 1000) return Math.random() < 0.80;
      return false; // Skip for weak monsters
    }
  }

  if (event === 'attack_declared') {
    const attacker = context.attacker;
    const attackerAtk = attacker?.atk || 0;

    // Mirror Force (destroy_attackers)
    if (trap.effect === 'destroy_attackers') {
      // Count opponent's attack position monsters
      const oppAttackMonsters = player.field.monsters.filter(m => m && m.position === 'attack');
      // High value: multiple attackers (>= 2)
      if (oppAttackMonsters.length >= 2) return Math.random() < 0.90;
      // High value: threat has high ATK (>= 1800)
      if (attackerAtk >= 1800) return Math.random() < 0.85;
      // High value: AI has low LP (< 3000)
      if (ai.lp < 3000) return Math.random() < 0.80;
      // Otherwise, save it
      return false;
    }

    // Reflect Battle / Mirror Gate Strike (reflect_battle)
    if (trap.effect === 'reflect_battle') {
      // Reflect when the incoming attacker has high ATK (>= 1500) or AI is low LP
      if (attackerAtk >= 1500) return Math.random() < 0.85;
      if (ai.lp < 2500) return Math.random() < 0.80;
      return false;
    }
  }

  if (event === 'counter-trap') {
    // Counter Counter (negate_spell)
    return Math.random() < 0.80;
  }

  // Fallback for other traps: 70% chance to activate
  return Math.random() < 0.70;
}

export { executeYugiTurn, shouldAIActivateTrap };
