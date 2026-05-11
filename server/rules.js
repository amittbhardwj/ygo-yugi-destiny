/**
 * All game rule logic - the core battle engine
 * Yu-Gi-Oh! Power of Chaos: Yugi the Destiny
 */

function resolveBattle(attacker, defender) {
  const result = {
    winner: null,
    damageToAttacker: 0,
    damageToDefender: 0,
    destroyedAttacker: false,
    destroyedDefender: false,
  };

  if (attacker.position === 'attack' && defender.position === 'attack') {
    if (attacker.atk > defender.atk) {
      result.winner = 'attacker';
      result.damageToDefender = attacker.atk - defender.atk;
      result.destroyedDefender = true;
    } else if (defender.atk > attacker.atk) {
      result.winner = 'defender';
      result.damageToAttacker = defender.atk - attacker.atk;
      result.destroyedAttacker = true;
    } else {
      result.winner = 'tie';
      result.destroyedAttacker = true;
      result.destroyedDefender = true;
    }
  } else if (attacker.position === 'attack' && defender.position === 'defense') {
    if (attacker.atk > defender.def) {
      result.winner = 'attacker';
      result.destroyedDefender = true;
    } else if (defender.def > attacker.atk) {
      result.winner = 'defender';
      result.damageToAttacker = defender.def - attacker.atk;
    } else {
      result.winner = 'tie';
    }
  }

  return result;
}

function resolveSpellEffect(state, playerKey, spellCardId) {
  const p = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];

  const spellIndex = p.field.spells.findIndex(s => s.cardId === spellCardId);
  if (spellIndex === -1) {
    return { success: false, error: 'Spell not on field' };
  }

  const spell = p.field.spells[spellIndex];
  const cardName = spell.name;

  // Remove spell from field
  p.field.spells.splice(spellIndex, 1);
  p.grave.push(spell);

  switch (spell.effect) {
    case 'destroy_all_monsters': {
      // Dark Hole - destroy all monsters on both fields
      const p1Monsters = state.players.player1.field.monsters.splice(0);
      const p2Monsters = state.players.player2.field.monsters.splice(0);
      state.players.player1.grave.push(...p1Monsters);
      state.players.player2.grave.push(...p2Monsters);
      state.log.push(`${p.name} activated ${cardName}! All monsters destroyed!`);
      break;
    }

    case 'destroy_opponent_monsters': {
      // Raigeki - destroy all monsters opponent controls
      const oppMonsters = opponent.field.monsters.splice(0);
      opponent.grave.push(...oppMonsters);
      state.log.push(`${p.name} activated ${cardName}! Opponent's monsters destroyed!`);
      break;
    }

    case 'special_summon_grave': {
      // Monster Reborn - handled with target selection (simplified: summon highest ATK from grave)
      const graveMonsters = p.grave.filter(c => c.type === 'monster');
      if (graveMonsters.length > 0) {
        const best = graveMonsters.reduce((a, b) => (a.atk > b.atk ? a : b));
        p.grave = p.grave.filter(c => c.cardId !== best.cardId);
        best.position = 'defense';
        best.faceDown = false;
        p.field.monsters.push(best);
        state.log.push(`${p.name} activated ${cardName}! ${best.name} special summoned!`);
      } else {
        state.log.push(`${p.name} activated ${cardName}! But no monsters in grave.`);
      }
      break;
    }

    case 'take_control': {
      // Change of Heart - take control of opponent's strongest monster
      if (opponent.field.monsters.length > 0) {
        const strongest = opponent.field.monsters.reduce((a, b) => (a.atk > b.atk ? a : b));
        opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== strongest.cardId);
        strongest.position = 'attack';
        strongest.faceDown = false;
        p.field.monsters.push(strongest);
        state.log.push(`${p.name} activated ${cardName}! Took control of ${strongest.name}!`);
      } else {
        state.log.push(`${p.name} activated ${cardName}! But opponent has no monsters.`);
      }
      break;
    }

    case 'heal_500': {
      p.lp = Math.min(p.lp + 500, 9999);
      state.log.push(`${p.name} used ${cardName}! +500 LP`);
      break;
    }

    case 'damage_800': {
      opponent.lp -= 800;
      state.log.push(`${p.name} used ${cardName}! 800 damage to ${opponent.name}`);
      break;
    }

    case 'damage_1000': {
      opponent.lp -= 1000;
      state.log.push(`${p.name} used ${cardName}! 1000 damage to ${opponent.name}`);
      break;
    }

    case 'boost_atk_500': {
      // Mysterious Sword - boost one monster's ATK by 500
      if (p.field.monsters.length > 0) {
        const target = p.field.monsters[p.field.monsters.length - 1];
        target.atk += 500;
        state.log.push(`${p.name} equipped ${target.name} with ${cardName}! +500 ATK`);
      } else {
        state.log.push(`${p.name} used ${cardName}! But no monsters to equip.`);
      }
      break;
    }

    default:
      state.log.push(`${p.name} activated ${cardName}!`);
  }

  return { success: true };
}

function resolveTrapEffect(state, playerKey, trapCardId) {
  const p = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];

  const trapIndex = p.field.spells.findIndex(s => s.cardId === trapCardId);
  if (trapIndex === -1) {
    return { success: false, error: 'Trap not on field' };
  }

  const trap = p.field.spells[trapIndex];
  const cardName = trap.name;

  p.field.spells.splice(trapIndex, 1);
  p.grave.push(trap);

  switch (trap.effect) {
    case 'destroy_1000atk_monster': {
      // Trap Hole - handled during summon, not here
      state.log.push(`${p.name} activated ${cardName}!`);
      break;
    }

    case 'destroy_attackers': {
      // Mirror Force - destroy all attack position monsters opponent controls
      const attackers = opponent.field.monsters.filter(m => m.position === 'attack');
      attackers.forEach(m => {
        opponent.field.monsters = opponent.field.monsters.filter(mon => mon.cardId !== m.cardId);
        opponent.grave.push(m);
      });
      state.log.push(`${p.name} activated ${cardName}! ${attackers.length} monsters destroyed!`);
      break;
    }

    case 'destroy_both_500': {
      // Ring of Destruction - requires target, simplified here
      if (opponent.field.monsters.length > 0) {
        const target = opponent.field.monsters[0];
        opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== target.cardId);
        opponent.grave.push(target);
        p.lp -= 500;
        opponent.lp -= 500;
        state.log.push(`${p.name} activated ${cardName}! ${target.name} destroyed! 500 damage to each!`);
      } else {
        p.lp -= 500;
        opponent.lp -= 500;
        state.log.push(`${p.name} activated ${cardName}! 500 damage to each player!`);
      }
      break;
    }

    default:
      state.log.push(`${p.name} activated ${cardName}!`);
  }

  return { success: true };
}

function checkTriggerEffects(card, event, state, playerKey) {
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];

  if (event === 'summon' && card.atk >= 1000) {
    const trapHole = opponent.field.spells.find(
      s => s.type === 'trap' && s.effect === 'destroy_1000atk_monster' && s.faceDown
    );
    if (trapHole) {
      // Activate Trap Hole
      opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== card.cardId);
      opponent.grave.push(card);
      opponent.field.spells = opponent.field.spells.filter(s => s.cardId !== trapHole.cardId);
      opponent.grave.push(trapHole);
      state.log.push(`Trap Hole activated! ${card.name} destroyed!`);
    }
  }
}

function checkWinCondition(state) {
  for (const key of ['player1', 'player2']) {
    if (state.players[key].lp <= 0) {
      state.winner = key === 'player1' ? 'player2' : 'player1';
      return key;
    }
  }
  return null;
}

export {
  resolveBattle,
  resolveSpellEffect,
  resolveTrapEffect,
  checkTriggerEffects,
  checkWinCondition,
};
