/**
 * Yugi AI Engine - Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 * AI opponent logic for single-player mode
 */

import { summonMonster, setSpellTrap, executeAttack, directAttack, advancePhase, drawCard, serialize } from './gameState.js';
import { resolveSpellEffect } from './rules.js';

const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'];

const CARD_DATABASE = {
  'm1':  { name: 'Dark Magician',            atk: 2500, def: 2100, level: 7, type: 'monster' },
  'm2':  { name: 'Blue-Eyes White Dragon',   atk: 3000, def: 2500, level: 8, type: 'monster' },
  'm3':  { name: 'Gaia The Fierce Knight',    atk: 2300, def: 2100, level: 7, type: 'monster' },
  'm4':  { name: 'Summoned Skull',           atk: 2500, def: 1200, level: 6, type: 'monster' },
  'm5':  { name: 'Ansato',                   atk: 1000, def: 1000, level: 4, type: 'monster' },
  'm6':  { name: 'Cerebral',                atk: 800,  def: 2000, level: 4, type: 'monster' },
  'm7':  { name: 'Feral Imp',               atk: 1300, def: 1000, level: 4, type: 'monster' },
  'm8':  { name: 'Dragoner',                atk: 1100, def: 1600, level: 4, type: 'monster' },
  'm9':  { name: 'Mystical Elf',            atk: 300,  def: 2500, level: 4, type: 'monster' },
  'm10': { name: 'Haniwa',                  atk: 500,  def: 500,  level: 2, type: 'monster' },
  's1':  { name: 'Dark Hole',                type: 'spell', effect: 'destroy_all_monsters' },
  's2':  { name: 'Raigeki',                  type: 'spell', effect: 'destroy_opponent_monsters' },
  's3':  { name: 'Monster Reborn',           type: 'spell', effect: 'special_summon_grave' },
  's4':  { name: 'Change of Heart',          type: 'spell', effect: 'take_control' },
  's5':  { name: 'Dian Keto',                type: 'spell', effect: 'heal_500' },
  's6':  { name: 'Ookazi',                   type: 'spell', effect: 'damage_800' },
  's7':  { name: 'The Hall of Dragon',       type: 'spell', effect: 'damage_1000' },
  's8':  { name: 'Mysterious Sword',        type: 'spell', effect: 'boost_atk_500' },
  't1':  { name: 'Trap Hole',               type: 'trap', effect: 'destroy_1000atk_monster' },
  't2':  { name: 'Mirror Force',            type: 'trap', effect: 'destroy_attackers' },
  't3':  { name: 'Ring of Destruction',    type: 'trap', effect: 'destroy_both_500' },
};

const MONSTER_PRIORITY = {
  'm2': 100, // Blue-Eyes White Dragon
  'm4': 90,  // Summoned Skull
  'm3': 85,  // Gaia The Fierce Knight
  'm1': 80,  // Dark Magician
  'm7': 60,  // Feral Imp
  'm8': 55,  // Dragoner
  'm5': 50,  // Ansato
  'm6': 45,  // Cerebral
  'm10': 40, // Haniwa
  'm9': 30,  // Mystical Elf
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function roll(chance) {
  return Math.random() < chance;
}

function getCardBase(cardId) {
  const id = cardId.split('_')[0];
  return CARD_DATABASE[id] || null;
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
    return base && base.type === 'monster';
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

function sortMonstersByPriority(monsters) {
  return [...monsters].sort((a, b) => {
    const pa = MONSTER_PRIORITY[a.cardId.split('_')[0]] || 0;
    const pb = MONSTER_PRIORITY[b.cardId.split('_')[0]] || 0;
    return pb - pa;
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
  const availableTributes = ai.field.monsters.length;
  const summonable = findMonsterInHand(ai.hand).filter(c => {
    const base = getCardBase(c.cardId);
    if (!base) return false;
    const lvl = base.level || 4;
    if (lvl >= 7) return availableTributes >= 2;
    if (lvl >= 5) return availableTributes >= 1;
    return true;
  });

  if (summonable.length > 0) {
    const best = sortMonstersByPriority(summonable)[0];
    const result = summonMonster(gameState, AI_KEY, best.cardId, 'attack');
    if (result.success) {
      const action = { type: 'summon', cardId: best.cardId, position: 'attack' };
      gameState.log.push(`Yugi summoned ${best.name}`);
      if (reportAction(emitFn, action)) return;
      await delay(THINK_DELAY);
    }
  }

  // Set a trap if available
  const traps = findTrapInHand(ai.hand);
  if (traps.length > 0) {
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

    switch (base.effect) {
      case 'damage_800':
      case 'damage_1000': {
        const dmg = base.effect === 'damage_800' ? 800 : 1000;
        player.lp -= dmg;
        ai.hand = ai.hand.filter(c => c.cardId !== spell.cardId);
        ai.grave.push({ ...spell });
        gameState.log.push(`Yugi used ${base.name}! ${dmg} damage!`);
        if (reportAction(emitFn, { type: 'spell', cardId: spell.cardId, damage: dmg })) return;
        await delay(THINK_DELAY);
        break;
      }

      case 'heal_500': {
        ai.lp = Math.min(ai.lp + 500, 9999);
        ai.hand = ai.hand.filter(c => c.cardId !== spell.cardId);
        ai.grave.push({ ...spell });
        gameState.log.push(`Yugi used ${base.name}! +500 LP`);
        if (reportAction(emitFn, { type: 'spell', cardId: spell.cardId })) return;
        await delay(THINK_DELAY);
        break;
      }

      case 'destroy_all_monsters': {
        const p1Monsters = gameState.players.player1.field.monsters.splice(0);
        const p2Monsters = gameState.players.player2.field.monsters.splice(0);
        gameState.players.player1.grave.push(...p1Monsters);
        gameState.players.player2.grave.push(...p2Monsters);
        ai.hand = ai.hand.filter(c => c.cardId !== spell.cardId);
        ai.grave.push({ ...spell });
        gameState.log.push(`Yugi activated ${base.name}!`);
        if (reportAction(emitFn, { type: 'spell', cardId: spell.cardId })) return;
        await delay(THINK_DELAY);
        break;
      }

      case 'destroy_opponent_monsters': {
        const oppMonsters = gameState.players.player1.field.monsters.splice(0);
        gameState.players.player1.grave.push(...oppMonsters);
        ai.hand = ai.hand.filter(c => c.cardId !== spell.cardId);
        ai.grave.push({ ...spell });
        gameState.log.push(`Yugi activated ${base.name}!`);
        if (reportAction(emitFn, { type: 'spell', cardId: spell.cardId })) return;
        await delay(THINK_DELAY);
        break;
      }

      default:
        break;
    }
  }

  // ---- BATTLE PHASE ----
  await delay(THINK_DELAY);
  await stepPhase(emitFn); // main1 → battle
  await delay(THINK_DELAY);
  for (const monster of ai.field.monsters) {
    if (monster.position === 'defense' && !monster.faceDown) {
      monster.position = 'attack';
      monster.faceDown = false;
      gameState.log.push(`Yugi flipped ${monster.name} to attack position`);
      if (reportAction(emitFn, { type: 'flip', cardId: monster.cardId })) return;
      await delay(THINK_DELAY);
    }
  }

  // Get attack-ready monsters
  const attackers = ai.field.monsters.filter(m =>
    m.position === 'attack' && !ai.attackedMonsters.includes(m.cardId)
  );

  for (const attacker of attackers) {
    const oppMonsters = player.field.monsters;

    if (oppMonsters.length === 0) {
      // Direct attack
      const result = directAttack(gameState, AI_KEY, attacker.cardId);
      if (result.success) {
        gameState.log.push(`Yugi's ${attacker.name} attacks directly for ${result.damage}!`);
        if (reportAction(emitFn, { type: 'direct-attack', attackerId: attacker.cardId, damage: result.damage })) return;
        ai.attackedMonsters.push(attacker.cardId);
        await delay(THINK_DELAY);
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
             score = attackerAtk - currentAtk; // prefer highest damage
           }
        } else {
           if (attackerAtk > currentDef) {
             score = 0; // Destroying def monster is okay
           }
        }
        if (score > bestScore) {
          bestScore = score;
          bestTarget = current;
        }
      }

      if (bestTarget && bestScore >= 0) {
        const result = executeAttack(gameState, AI_KEY, attacker.cardId, bestTarget.cardId);
        if (result.success) {
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

export { executeYugiTurn };
