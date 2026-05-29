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

function moveCardsToGrave(cards, owner) {
  if (cards.length) owner.grave.push(...cards.map(c => ({ ...c, faceDown: false })));
}

function removeCardFromZone(zone, cardId) {
  const index = zone.findIndex(c => c.cardId === cardId);
  if (index === -1) return null;
  return zone.splice(index, 1)[0];
}

function pickStrongest(monsters) {
  return monsters.reduce((best, card) => (!best || (card.atk || 0) > (best.atk || 0) ? card : best), null);
}

const EXODIA_IDS = ['m101', 'm102', 'm103', 'm104', 'm105'];
function getBaseCardId(card) {
  return card?.id || card?.cardId?.replace(/_[0-9]+$/, '') || null;
}
function checkExodiaWinInRules(state, playerKey) {
  const player = state.players[playerKey];
  if (!player) return false;
  const handIds = new Set((player.hand || []).map(getBaseCardId).filter(Boolean));
  const hasAll = EXODIA_IDS.every(id => handIds.has(id));
  if (hasAll) {
    state.winner = playerKey;
    state.winReason = 'Exodia the Forbidden One';
    state.log.push(`${player.name} assembled all five pieces of Exodia! ${player.name} wins!`);
    return true;
  }
  return false;
}

function drawSafe(state, playerKey, count = 1) {
  const drawn = [];
  const player = state.players[playerKey];
  for (let i = 0; i < count && player.deck.length > 0; i += 1) {
    drawn.push(player.deck.pop());
  }
  player.hand.push(...drawn);
  checkExodiaWinInRules(state, playerKey);
  return drawn;
}

function resolveSpellEffect(state, playerKey, spellCardId, context = {}) {
  const p = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];

  const spellIndex = p.field.spells.findIndex(s => s.cardId === spellCardId);
  if (spellIndex === -1) {
    return { success: false, error: 'Spell not on field' };
  }

  const spell = p.field.spells[spellIndex];
  const cardName = spell.name;
  const effect = spell.effect;
  const category = spell.category;
  const keepOnField = category === 'continuous' || category === 'equip' || effect === 'field_spell' || effect === 'damage_prevention' || effect === 'prevent_death_damage';

  if (!keepOnField) {
    p.field.spells.splice(spellIndex, 1);
    p.grave.push({ ...spell, faceDown: false });
  } else {
    spell.faceDown = false;
    spell.position = 'open';
  }

  switch (effect) {
    case 'destroy_all_monsters': {
      moveCardsToGrave(state.players.player1.field.monsters.splice(0), state.players.player1);
      moveCardsToGrave(state.players.player2.field.monsters.splice(0), state.players.player2);
      state.log.push(`${p.name} activated ${cardName}! All monsters destroyed!`);
      break;
    }

    case 'destroy_opponent_monsters': {
      moveCardsToGrave(opponent.field.monsters.splice(0), opponent);
      state.log.push(`${p.name} activated ${cardName}! Opponent's monsters destroyed!`);
      break;
    }

    case 'destroy_opponent_backrow': {
      const destroyed = opponent.field.spells.splice(0);
      moveCardsToGrave(destroyed, opponent);
      p.lp = Math.max(0, p.lp - 800);
      state.log.push(`${p.name} activated ${cardName}! Destroyed ${destroyed.length} opponent Spell/Trap card(s).`);
      break;
    }

    case 'special_summon_grave':
    case 'special_summon_self_gy': {
      if (p.field.monsters.length >= 5) {
        state.log.push(`${p.name} activated ${cardName}! But the Monster Zone is full.`);
        break;
      }
      const allGraveMonsters = [...p.grave, ...opponent.grave].filter(c => c.type === 'monster');
      let target = null;
      let targetSource = null;
      if (context.targetId) {
        target = allGraveMonsters.find(c => c.cardId === context.targetId);
        if (target) {
          targetSource = p.grave.some(c => c.cardId === target.cardId) ? p : opponent;
        }
      }
      if (!target) {
        const graveMonsters = p.grave.filter(c => c.type === 'monster');
        target = pickStrongest(graveMonsters);
        if (target) targetSource = p;
      }
      if (!target) {
        const oppGraveMonsters = opponent.grave.filter(c => c.type === 'monster');
        target = pickStrongest(oppGraveMonsters);
        if (target) targetSource = opponent;
      }
      if (target && targetSource) {
        targetSource.grave = targetSource.grave.filter(c => c.cardId !== target.cardId);
        target.position = 'attack';
        target.faceDown = false;
        p.field.monsters.push(target);
        if (effect === 'special_summon_self_gy') p.lp = Math.max(0, p.lp - 800);
        state.log.push(`${p.name} activated ${cardName}! Special Summoned ${target.name} from the Graveyard!`);
      } else {
        state.log.push(`${p.name} activated ${cardName}! But no monsters were in the Graveyard.`);
      }
      break;
    }

    case 'take_control':
    case 'take_control_opponent_monster':
    case 'take_control_until_end':
    case 'steal_opponent_card': {
      if (p.field.monsters.length >= 5) {
        state.log.push(`${p.name} activated ${cardName}! But the Monster Zone is full.`);
        break;
      }
      let target = null;
      if (context.targetId) {
        target = opponent.field.monsters.find(m => m.cardId === context.targetId);
      }
      if (!target) {
        target = pickStrongest(opponent.field.monsters);
      }
      if (target) {
        opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== target.cardId);
        target.position = 'attack';
        target.faceDown = false;
        target.controlChangedBy = cardName;
        target.returnToOwnerAtEnd = opponentKey;
        p.field.monsters.push(target);
        state.log.push(`${p.name} activated ${cardName}! Took control of ${target.name}!`);
      } else {
        state.log.push(`${p.name} activated ${cardName}! But opponent has no monsters.`);
      }
      break;
    }

    case 'heal_500':
    case 'life_gain': {
      const amount = cardName.includes('1000') || cardName.includes('Metal') ? 1000 : cardName.includes('700') || cardName.includes('Silver') ? 700 : 500;
      p.lp = Math.min(p.lp + amount, 9999);
      state.log.push(`${p.name} used ${cardName}! +${amount} LP`);
      break;
    }

    case 'damage_800':
    case 'damage_1000': {
      const amount = effect === 'damage_1000' ? 1000 : 800;
      opponent.lp -= amount;
      state.log.push(`${p.name} used ${cardName}! ${amount} damage to ${opponent.name}`);
      break;
    }

    case 'boost_atk_500':
    case 'atk_boost':
    case 'spellcaster_boost':
    case 'boost_by_spells': {
      const target = context.target || pickStrongest(p.field.monsters);
      if (target) {
        const amount = effect === 'boost_by_spells' ? 500 * Math.max(1, p.field.spells.length) : /1200/.test(cardName) ? 1200 : /800/.test(cardName) ? 800 : /700/.test(cardName) ? 700 : /600/.test(cardName) ? 600 : 500;
        target.atk = (target.atk || 0) + amount;
        if (target.def !== undefined && effect === 'spellcaster_boost') target.def += 300;
        spell.equippedTo = target.cardId;
        state.log.push(`${p.name} equipped ${target.name} with ${cardName}! +${amount} ATK`);
      } else {
        state.log.push(`${p.name} used ${cardName}! But no monsters were available.`);
      }
      break;
    }

    case 'flip_monsters_up': {
      for (const key of ['player1', 'player2']) {
        state.players[key].field.monsters.forEach(m => { m.faceDown = false; if (!m.position || m.position === 'set') m.position = 'defense'; });
      }
      opponent.swordsTurns = 3;
      state.log.push(`${p.name} activated ${cardName}! All monsters were revealed.`);
      break;
    }

    case 'reload_hand': {
      const count = p.hand.length;
      p.grave.push(...p.hand.splice(0));
      drawSafe(state, playerKey, count);
      state.log.push(`${p.name} activated ${cardName}! Reloaded ${count} card(s).`);
      break;
    }

    case 'mill': {
      for (const key of ['player1', 'player2']) moveCardsToGrave(state.players[key].deck.splice(-5), state.players[key]);
      state.log.push(`${p.name} activated ${cardName}! Both players milled 5 cards.`);
      break;
    }

    case 'draw': {
      const drawn = drawSafe(state, playerKey, opponent.field.monsters.length >= 3 ? 2 : 1);
      state.log.push(`${p.name} activated ${cardName}! Drew ${drawn.length} card(s).`);
      break;
    }

    case 'destroy_monster': {
      let target = null;
      if (context.targetId) {
        target = opponent.field.monsters.find(m => m.cardId === context.targetId) ||
                 p.field.monsters.find(m => m.cardId === context.targetId);
      }
      if (!target) {
        target = pickStrongest([...opponent.field.monsters, ...p.field.monsters]);
      }
      if (target) {
        const owner = opponent.field.monsters.some(m => m.cardId === target.cardId) ? opponent : p;
        owner.field.monsters = owner.field.monsters.filter(m => m.cardId !== target.cardId);
        owner.grave.push(target);
        state.log.push(`${p.name} activated ${cardName}! Destroyed ${target.name}.`);
      } else {
        state.log.push(`${p.name} activated ${cardName}! But there were no monsters to destroy.`);
      }
      break;
    }

    case 'bounce': {
      const target = pickStrongest(opponent.field.monsters);
      if (target) {
        opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== target.cardId);
        opponent.hand.push(target);
        state.log.push(`${p.name} activated ${cardName}! Returned ${target.name} to hand.`);
        checkExodiaWinInRules(state, opponentKey);
      }
      break;
    }

    case 'drain_opponent_stat': {
      const target = pickStrongest(opponent.field.monsters);
      if (target) {
        target.atk = 0;
        target.tempAtkUntilEnd = true;
        state.log.push(`${p.name} activated ${cardName}! ${target.name}'s ATK became 0.`);
      }
      break;
    }

    case 'damage_prevention':
    case 'prevent_death_damage':
    case 'field_spell':
    case 'damage_redirect':
    case 'skip_draw':
    case 'banish_top_deck':
    case 'ritual_summon':
    case 'exchange_hand':
    case 'rearrange_top':
    default:
      state.log.push(`${p.name} activated ${cardName}!`);
  }

  return { success: true, spell, keptOnField: keepOnField };
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

function getOpenSpells(player, predicate = () => true) {
  return (player.field.spells || []).filter(card => card.type === 'spell' && !card.faceDown && predicate(card));
}

function activateTrapByEffect(state, ownerKey, trap, event, context = {}) {
  const owner = state.players[ownerKey];
  const opponentKey = ownerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];
  const removed = removeCardFromZone(owner.field.spells, trap.cardId);
  if (removed) owner.grave.push({ ...removed, faceDown: false });

  switch (trap.effect) {
    case 'destroy_monster': {
      const target = context.summonedMonster || context.target || pickStrongest(opponent.field.monsters);
      if (target) {
        const targetOwner = owner.field.monsters.some(m => m.cardId === target.cardId) ? owner : opponent;
        targetOwner.field.monsters = targetOwner.field.monsters.filter(m => m.cardId !== target.cardId);
        targetOwner.grave.push(target);
        state.log.push(`${trap.name} activated! ${target.name} destroyed!`);
      }
      break;
    }
    case 'destroy_attackers': {
      const attackers = opponent.field.monsters.filter(m => m.position === 'attack');
      attackers.forEach(m => {
        opponent.field.monsters = opponent.field.monsters.filter(mon => mon.cardId !== m.cardId);
        opponent.grave.push(m);
      });
      state.log.push(`${trap.name} activated! ${attackers.length} attacking monster(s) destroyed!`);
      break;
    }
    case 'destroy_both_damage':
    case 'destroy_both_500': {
      const theirMonster = pickStrongest(opponent.field.monsters);
      const ourMonster = pickStrongest(owner.field.monsters);
      for (const [pl, monster] of [[opponent, theirMonster], [owner, ourMonster]]) {
        if (!monster) continue;
        pl.field.monsters = pl.field.monsters.filter(m => m.cardId !== monster.cardId);
        pl.grave.push(monster);
      }
      owner.lp -= 500;
      opponent.lp -= 500;
      state.log.push(`${trap.name} activated! Monsters destroyed and both players took 500 damage!`);
      break;
    }
    case 'lower_atk': {
      opponent.field.monsters.forEach(m => { m.atk = Math.max(0, (m.atk || 0) - 400); });
      state.log.push(`${trap.name} activated! Opponent monsters lose 400 ATK.`);
      break;
    }
    case 'life_gain': {
      owner.lp = Math.min(9999, owner.lp + 800);
      state.log.push(`${trap.name} activated! ${owner.name} gained 800 LP.`);
      break;
    }
    case 'special_summon_grave': {
      if (owner.field.monsters.length < 5) {
        const best = pickStrongest(owner.grave.filter(c => c.type === 'monster'));
        if (best) {
          owner.grave = owner.grave.filter(c => c.cardId !== best.cardId);
          best.position = 'defense';
          best.faceDown = false;
          owner.field.monsters.push(best);
          state.log.push(`${trap.name} activated! ${best.name} returned from the Graveyard.`);
        }
      }
      break;
    }
    case 'reflect_battle': {
      const attacker = context.attacker;
      if (attacker) {
        const damage = attacker.atk || 0;
        attacker.atk = 0;
        opponent.lp -= damage;
        context.cancelAttack = true;
        state.log.push(`${trap.name} activated! ${opponent.name} took ${damage} damage.`);
      }
      break;
    }
    case 'flip_destroy': {
      const target = opponent.field.monsters.find(m => m.faceDown);
      if (target) {
        opponent.field.monsters = opponent.field.monsters.filter(m => m.cardId !== target.cardId);
        opponent.grave.push(target);
        state.log.push(`${trap.name} activated! Flipped and destroyed ${target.name}!`);
      } else {
        state.log.push(`${trap.name} activated! But opponent had no face-down monsters.`);
      }
      break;
    }
    case 'search_low_atk': {
      const targetIndex = owner.deck.findIndex(c => c.type === 'monster' && (c.atk || 0) <= 1000);
      if (targetIndex !== -1) {
        const card = owner.deck.splice(targetIndex, 1)[0];
        owner.hand.push(card);
        state.log.push(`${trap.name} activated! Added ${card.name} to hand.`);
      } else {
        state.log.push(`${trap.name} activated! But no targets in deck.`);
      }
      break;
    }
    case 'destroy_set_st': {
      if (opponent.field.spells.length > 0) {
        const target = opponent.field.spells.shift();
        opponent.grave.push({ ...target, faceDown: false });
        state.log.push(`${trap.name} activated! Destroyed opponent's ${target.name}.`);
      }
      break;
    }
    case 'swap_draw': {
      if (owner.field.monsters.length > 0 && owner.deck.length > 0) {
        const mon = owner.field.monsters.pop();
        const top = owner.deck.pop();
        owner.deck.unshift(mon);
        if (top.type === 'monster') {
          owner.field.monsters.push({...top, position: 'defense', faceDown: true});
        } else {
          owner.hand.push(top);
        }
        state.log.push(`${trap.name} activated! Swapped a monster with the top card of the deck.`);
      }
      break;
    }
    case 'redirect_damage': {
      owner.redirectNextDamage = true;
      state.log.push(`${trap.name} activated! The next battle damage will be redirected!`);
      break;
    }
    case 'banish_top': {
      for (const pl of [owner, opponent]) {
        pl.deck.splice(-3);
      }
      state.log.push(`${trap.name} activated! Both players banished 3 cards.`);
      break;
    }
    case 'negate_spell': {
      if (opponent.field.spells.length > 0) {
        const target = opponent.field.spells.shift();
        opponent.grave.push({ ...target, faceDown: false });
        state.log.push(`${trap.name} activated! Negated and destroyed ${target.name}.`);
      }
      break;
    }
    case 'skip_draw_player': {
      opponent.skipNextDraw = true;
      state.log.push(`${trap.name} activated! Opponent skips their next draw.`);
      break;
    }
    case 'atk_boost_turn': {
      const target = pickStrongest(owner.field.monsters);
      if (target) {
        target.atk = (target.atk || 0) + 600;
        target.tempAtkUntilEnd = (target.tempAtkUntilEnd || 0) + 600;
        state.log.push(`${trap.name} activated! ${target.name} gained 600 ATK.`);
      }
      break;
    }
    case 'both_skip_draw': {
      owner.skipNextDraw = true;
      opponent.skipNextDraw = true;
      state.log.push(`${trap.name} activated! Both players skip their next draw.`);
      break;
    }
    case 'damage_double': {
      owner.doubleNextDamage = true;
      state.log.push(`${trap.name} activated! The next battle damage taken will be doubled.`);
      break;
    }
    default:
      state.log.push(`${trap.name} activated!`);
  }
}

function processEventEffects(state, event, playerKey, context = {}) {
  const player = state.players[playerKey];
  const opponentKey = playerKey === 'player1' ? 'player2' : 'player1';
  const opponent = state.players[opponentKey];
  const result = { cancelAttack: false, preventedDamage: 0 };

  // Continuous/open spell checks run on every event, so spell effects are not ignored
  // just because the event was summon, phase, attack, damage, or end-turn.
  for (const key of ['player1', 'player2']) {
    const owner = state.players[key];
    for (const spell of getOpenSpells(owner)) {
      if (event === 'battle_damage' && context.damagedPlayerKey === key) {
        const prevention = spell.effect === 'prevent_death_damage' ? context.damage :
          spell.effect === 'damage_prevention' ? (/1500/.test(spell.name) ? 1500 : /1000/.test(spell.name) ? 1000 : /700/.test(spell.name) ? 700 : 500) : 0;
        if (prevention > 0) {
          const amount = Math.min(context.damage || 0, prevention);
          owner.lp += amount;
          result.preventedDamage += amount;
          state.log.push(`${spell.name} prevented ${amount} battle damage.`);
        }
      }
      if (event === 'phase_start' && spell.effect === 'field_spell') {
        owner.field.monsters.forEach(m => {
          const species = (m.species || '').toLowerCase();
          if (!m._fieldBoosted && ['aqua', 'fish', 'sea serpent'].includes(species)) {
            m.atk = (m.atk || 0) + 200;
            m.def = (m.def || 0) + 200;
            m._fieldBoosted = true;
          }
        });
      }
    }
  }

  if (event === 'attack_declared') {
    if (opponent.swordsTurns > 0) {
      result.cancelAttack = true;
      state.log.push(`Swords of Revealing Light prevented the attack!`);
    }
  }

  if (event === 'phase_start' && state.phase === 'end') {
    for (const key of ['player1', 'player2']) {
      const pl = state.players[key];
      for (const monster of [...pl.field.monsters]) {
        if (monster.returnToOwnerAtEnd) {
          pl.field.monsters = pl.field.monsters.filter(m => m.cardId !== monster.cardId);
          state.players[monster.returnToOwnerAtEnd].field.monsters.push({ ...monster, returnToOwnerAtEnd: null, controlChangedBy: null });
        }
        if (monster.tempAtkUntilEnd) delete monster.tempAtkUntilEnd;
      }
      if (pl.swordsTurns > 0) pl.swordsTurns -= 1;
    }
  }

  return result;
}

function checkTriggerEffects(card, event, state, playerKey) {
  return processEventEffects(state, event, playerKey, { summonedMonster: card });
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

function resolveFlipEffect(state, playerKey, monster) {
  if (!monster || !monster.effect) return;
  const p = state.players[playerKey];
  
  switch (monster.effect) {
    case 'flip_morphing_jar': {
      for (const key of ['player1', 'player2']) {
        const pl = state.players[key];
        moveCardsToGrave(pl.hand.splice(0), pl);
        drawSafe(state, key, 5);
      }
      state.log.push(`FLIP Effect! Morphing Jar forces both players to discard and draw 5 cards.`);
      break;
    }
    case 'flip_draw_2': {
      drawSafe(state, playerKey, 2);
      state.log.push(`FLIP Effect! ${p.name} drew 2 cards from ${monster.name}.`);
      break;
    }
  }
}

export {
  resolveBattle,
  resolveSpellEffect,
  resolveTrapEffect,
  checkTriggerEffects,
  processEventEffects,
  checkWinCondition,
  activateTrapByEffect,
  checkExodiaWinInRules,
  resolveFlipEffect,
};
