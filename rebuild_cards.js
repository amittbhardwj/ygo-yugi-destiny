/**
 * rebuild_cards.js — Complete card database rebuild
 * 
 * Uses name-based lookup from YGOPRODeck API to get correct card data
 * for all 155 official Yu-Gi-Oh! Power of Chaos: Yugi the Destiny cards.
 */
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================================================
// OFFICIAL 155-CARD LIST — lookup by exact name
// ========================================================================

const CARDS = [
  // ===== MONSTER CARDS =====
  // Normal Monsters
  { gameId: 'm1', name: 'Dark Magician', type: 'monster', effect: null },
  { gameId: 'm2', name: 'Blue-Eyes White Dragon', type: 'monster', effect: null },
  { gameId: 'm3', name: 'Summoned Skull', type: 'monster', effect: null },
  { gameId: 'm4', name: 'Gaia the Fierce Knight', type: 'monster', effect: null },
  { gameId: 'm5', name: 'Tri-Horned Dragon', type: 'monster', effect: null },
  { gameId: 'm6', name: 'Curse of Dragon', type: 'monster', effect: null },
  { gameId: 'm7', name: 'Celtic Guardian', type: 'monster', effect: null },
  { gameId: 'm8', name: 'Mystical Elf', type: 'monster', effect: null },
  { gameId: 'm9', name: 'Giant Soldier of Stone', type: 'monster', effect: null },
  { gameId: 'm10', name: 'Feral Imp', type: 'monster', effect: null },
  { gameId: 'm11', name: 'Winged Dragon, Guardian of the Fortress #1', type: 'monster', effect: null },
  { gameId: 'm12', name: 'Beaver Warrior', type: 'monster', effect: null },
  { gameId: 'm13', name: 'Mystic Clown', type: 'monster', effect: null },
  { gameId: 'm14', name: 'Mammoth Graveyard', type: 'monster', effect: null },
  { gameId: 'm15', name: 'Ansatsu', type: 'monster', effect: null },
  { gameId: 'm16', name: 'Witty Phantom', type: 'monster', effect: null },
  { gameId: 'm17', name: 'Neo the Magic Swordsman', type: 'monster', effect: null },
  { gameId: 'm18', name: 'Baron of the Fiend Sword', type: 'monster', effect: null },
  { gameId: 'm19', name: 'Sorcerer of the Doomed', type: 'monster', effect: null },
  { gameId: 'm20', name: 'Man-Eating Treasure Chest', type: 'monster', effect: null },
  { gameId: 'm21', name: 'Darkworld Thorns', type: 'monster', effect: null },
  { gameId: 'm22', name: 'Frenzied Panda', type: 'monster', effect: null },
  { gameId: 'm23', name: 'Armored Starfish', type: 'monster', effect: null },
  { gameId: 'm24', name: 'Armaill', type: 'monster', effect: null },
  { gameId: 'm25', name: 'Claw Reacher', type: 'monster', effect: null },
  { gameId: 'm26', name: 'Darkfire Dragon', type: 'monster', effect: null },
  { gameId: 'm27', name: 'Dark King of the Abyss', type: 'monster', effect: null },
  { gameId: 'm28', name: 'Fireyarou', type: 'monster', effect: null },
  { gameId: 'm29', name: 'Enchanting Mermaid', type: 'monster', effect: null },
  { gameId: 'm30', name: 'Turtle Tiger', type: 'monster', effect: null },
  { gameId: 'm31', name: 'Petit Dragon', type: 'monster', effect: null },
  { gameId: 'm32', name: 'Petit Angel', type: 'monster', effect: null },
  { gameId: 'm33', name: 'Aqua Madoor', type: 'monster', effect: null },
  { gameId: 'm34', name: 'Kagemusha of the Blue Flame', type: 'monster', effect: null },
  { gameId: 'm35', name: 'Flame Manipulator', type: 'monster', effect: null },
  { gameId: 'm36', name: 'Masaki the Legendary Swordsman', type: 'monster', effect: null },
  { gameId: 'm37', name: 'Drooling Lizard', type: 'monster', effect: null },
  { gameId: 'm38', name: 'Dissolverock', type: 'monster', effect: null },
  { gameId: 'm39', name: 'Flower Wolf', type: 'monster', effect: null },
  { gameId: 'm40', name: 'Spirit of the Harp', type: 'monster', effect: null },
  { gameId: 'm41', name: 'Lesser Dragon', type: 'monster', effect: null },
  { gameId: 'm42', name: 'Spike Seadra', type: 'monster', effect: null },
  { gameId: 'm43', name: 'Dragon Zombie', type: 'monster', effect: null },
  { gameId: 'm44', name: 'Hitotsu-Me Giant', type: 'monster', effect: null },
  { gameId: 'm45', name: 'Meda Bat', type: 'monster', effect: null },
  { gameId: 'm46', name: 'One-Eyed Shield Dragon', type: 'monster', effect: null },
  { gameId: 'm47', name: 'Trial of Nightmare', type: 'monster', effect: null },
  { gameId: 'm48', name: 'Dragoness the Wicked Knight', type: 'monster', effect: null },
  { gameId: 'm49', name: 'Silver Fang', type: 'monster', effect: null },
  { gameId: 'm50', name: 'Metal Dragon', type: 'monster', effect: null },
  { gameId: 'm51', name: 'Monster Egg', type: 'monster', effect: null },
  { gameId: 'm52', name: 'Firegrass', type: 'monster', effect: null },
  { gameId: 'm53', name: 'Nemuriko', type: 'monster', effect: null },
  { gameId: 'm54', name: 'Hard Armor', type: 'monster', effect: null },
  { gameId: 'm55', name: 'Two-Mouth Darkruler', type: 'monster', effect: null },
  { gameId: 'm56', name: 'Larvas', type: 'monster', effect: null },
  { gameId: 'm57', name: 'Dark Gray', type: 'monster', effect: null },
  { gameId: 'm58', name: 'Skull Red Bird', type: 'monster', effect: null },
  { gameId: 'm59', name: 'Skull Servant', type: 'monster', effect: null },
  { gameId: 'm60', name: 'Root Water', type: 'monster', effect: null },
  { gameId: 'm61', name: 'Sand Stone', type: 'monster', effect: null },
  { gameId: 'm62', name: 'Green Phantom King', type: 'monster', effect: null },
  { gameId: 'm63', name: 'Ray & Temperature', type: 'monster', effect: null },
  { gameId: 'm64', name: 'Misairuzame', type: 'monster', effect: null },
  { gameId: 'm65', name: 'Steel Ogre Grotto #1', type: 'monster', effect: null },
  { gameId: 'm66', name: 'Uraby', type: 'monster', effect: null },
  { gameId: 'm67', name: 'Tyhone', type: 'monster', effect: null },
  { gameId: 'm68', name: 'Flame Ghost', type: 'monster', effect: null },
  { gameId: 'm69', name: 'Karbonala Warrior', type: 'monster', effect: null },
  { gameId: 'm70', name: 'Magical Ghost', type: 'monster', effect: null },
  { gameId: 'm71', name: 'Succubus Knight', type: 'monster', effect: null },
  { gameId: 'm72', name: 'Charubin the Fire Knight', type: 'monster', effect: null },
  { gameId: 'm73', name: 'Kumootoko', type: 'monster', effect: null },
  { gameId: 'm74', name: 'Kurama', type: 'monster', effect: null },
  { gameId: 'm75', name: 'Hinotama Soul', type: 'monster', effect: null },
  { gameId: 'm76', name: 'Ancient Elf', type: 'monster', effect: null },
  { gameId: 'm77', name: 'M-Warrior #1', type: 'monster', effect: null },
  { gameId: 'm78', name: 'M-Warrior #2', type: 'monster', effect: null },
  { gameId: 'm79', name: 'Mystical Sheep #2', type: 'monster', effect: null },
  { gameId: 'm80', name: 'Doma The Angel of Silence', type: 'monster', effect: null },
  { gameId: 'm81', name: 'Terra the Terrible', type: 'monster', effect: null },
  { gameId: 'm82', name: 'The 13th Grave', type: 'monster', effect: null },
  { gameId: 'm83', name: 'King Fog', type: 'monster', effect: null },
  { gameId: 'm84', name: 'Tripwire Beast', type: 'monster', effect: null },
  { gameId: 'm85', name: 'The Furious Sea King', type: 'monster', effect: null },
  { gameId: 'm86', name: 'Basic Insect', type: 'monster', effect: null },
  { gameId: 'm87', name: 'Great White', type: 'monster', effect: null },
  { gameId: 'm88', name: 'Man Eater', type: 'monster', effect: null },
  { gameId: 'm89', name: 'Dragon Zombie', altName: true, type: 'monster', effect: null }, // duplicate skip

  // Fusion Monsters (needed for Polymerization)
  { gameId: 'm90', name: 'Fusionist', type: 'monster', effect: null },
  { gameId: 'm91', name: 'Gaia the Dragon Champion', type: 'monster', effect: null },

  // Effect Monsters
  { gameId: 'm92', name: 'Kuriboh', type: 'monster', effect: 'prevent_battle_damage' },
  { gameId: 'm93', name: 'Man-Eater Bug', type: 'monster', effect: 'flip_destroy_monster' },
  { gameId: 'm94', name: 'Hane-Hane', type: 'monster', effect: 'bounce' },
  { gameId: 'm95', name: 'Wall of Illusion', type: 'monster', effect: 'bounce_attacker' },
  { gameId: 'm96', name: 'Reaper of the Cards', type: 'monster', effect: 'flip_destroy_trap' },
  { gameId: 'm97', name: 'Trap Master', type: 'monster', effect: 'flip_destroy_trap' },
  { gameId: 'm98', name: 'The Stern Mystic', type: 'monster', effect: 'flip_all_face_up' },
  { gameId: 'm99', name: 'Armed Ninja', type: 'monster', effect: 'flip_destroy_spell' },

  // Exodia pieces
  { gameId: 'm100', name: 'Exodia the Forbidden One', type: 'monster', effect: 'exodia_head' },
  { gameId: 'm101', name: 'Right Leg of the Forbidden One', type: 'monster', effect: 'exodia_piece' },
  { gameId: 'm102', name: 'Left Leg of the Forbidden One', type: 'monster', effect: 'exodia_piece' },
  { gameId: 'm103', name: 'Right Arm of the Forbidden One', type: 'monster', effect: 'exodia_piece' },
  { gameId: 'm104', name: 'Left Arm of the Forbidden One', type: 'monster', effect: 'exodia_piece' },

  // ===== SPELL CARDS =====
  { gameId: 's1', name: 'Dark Hole', type: 'spell', category: 'normal', effect: 'destroy_all_monsters' },
  { gameId: 's2', name: 'Monster Reborn', type: 'spell', category: 'normal', effect: 'special_summon_grave' },
  { gameId: 's3', name: 'Raigeki', type: 'spell', category: 'normal', effect: 'destroy_opponent_monsters' },
  { gameId: 's4', name: 'Change of Heart', type: 'spell', category: 'normal', effect: 'take_control' },
  { gameId: 's5', name: 'Pot of Greed', type: 'spell', category: 'normal', effect: 'draw' },
  { gameId: 's6', name: 'Graceful Charity', type: 'spell', category: 'normal', effect: 'draw' },
  { gameId: 's7', name: 'Swords of Revealing Light', type: 'spell', category: 'continuous', effect: 'flip_monsters_up' },
  { gameId: 's8', name: 'Card Destruction', type: 'spell', category: 'normal', effect: 'reload_hand' },
  { gameId: 's9', name: 'Fissure', type: 'spell', category: 'normal', effect: 'destroy_monster' },
  { gameId: 's10', name: 'De-Spell', type: 'spell', category: 'normal', effect: 'destroy_opponent_backrow' },
  { gameId: 's11', name: 'Remove Trap', type: 'spell', category: 'normal', effect: 'destroy_opponent_backrow' },
  { gameId: 's12', name: 'Stop Defense', type: 'spell', category: 'normal', effect: 'flip_monsters_up' },
  { gameId: 's13', name: 'Polymerization', type: 'spell', category: 'normal', effect: 'fusion' },
  { gameId: 's14', name: 'Dian Keto the Cure Master', type: 'spell', category: 'normal', effect: 'heal_500' },
  { gameId: 's15', name: 'Red Medicine', type: 'spell', category: 'normal', effect: 'heal_500' },
  { gameId: 's16', name: "Goblin's Secret Remedy", type: 'spell', category: 'normal', effect: 'heal_500' },
  { gameId: 's17', name: 'Hinotama', type: 'spell', category: 'normal', effect: 'damage_800' },
  { gameId: 's18', name: 'Final Flame', type: 'spell', category: 'normal', effect: 'damage_800' },
  { gameId: 's19', name: 'Sparks', type: 'spell', category: 'normal', effect: 'damage_800' },
  // Equip Spells
  { gameId: 's20', name: 'Sword of Dark Destruction', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's21', name: 'Book of Secret Arts', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's22', name: 'Dark Energy', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's23', name: 'Dragon Treasure', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's24', name: 'Electro-Whip', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's25', name: 'Follow Wind', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's26', name: 'Laser Cannon Armor', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's27', name: 'Legendary Sword', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's28', name: 'Machine Conversion Factory', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's29', name: 'Mystical Moon', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's30', name: 'Power of Kaishin', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's31', name: 'Raise Body Heat', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's32', name: 'Silver Bow and Arrow', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's33', name: 'Vile Germs', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's34', name: 'Violet Crystal', type: 'spell', category: 'equip', effect: 'atk_boost' },
  { gameId: 's35', name: 'Beast Fangs', type: 'spell', category: 'equip', effect: 'atk_boost' },
  // Field Spells
  { gameId: 's36', name: 'Forest', type: 'spell', category: 'field', effect: 'field_spell' },
  { gameId: 's37', name: 'Mountain', type: 'spell', category: 'field', effect: 'field_spell' },
  { gameId: 's38', name: 'Sogen', type: 'spell', category: 'field', effect: 'field_spell' },
  { gameId: 's39', name: 'Umi', type: 'spell', category: 'field', effect: 'field_spell' },
  { gameId: 's40', name: 'Wasteland', type: 'spell', category: 'field', effect: 'field_spell' },
  { gameId: 's41', name: 'Yami', type: 'spell', category: 'field', effect: 'field_spell' },

  // ===== TRAP CARDS =====
  { gameId: 't1', name: 'Trap Hole', type: 'trap', effect: 'destroy_1000atk_monster' },
  { gameId: 't2', name: 'Mirror Force', type: 'trap', effect: 'destroy_attackers' },
  { gameId: 't3', name: 'Reinforcements', type: 'trap', effect: 'search_low_atk' },
  { gameId: 't4', name: 'Castle Walls', type: 'trap', effect: 'boost_atk_500' },
  { gameId: 't5', name: 'Waboku', type: 'trap', effect: 'damage_prevention' },
  { gameId: 't6', name: 'Two-Pronged Attack', type: 'trap', effect: 'destroy_both_500' },
  { gameId: 't7', name: 'Reverse Trap', type: 'trap', effect: 'reflect_battle' },
  { gameId: 't8', name: 'Anti Raigeki', type: 'trap', effect: 'reflect_battle' },
  { gameId: 't9', name: 'Dragon Capture Jar', type: 'trap', effect: 'flip_monsters_up' },
  { gameId: 't10', name: 'Spellbinding Circle', type: 'trap', effect: 'lower_atk' },
];

// ========================================================================
// API
// ========================================================================

function fetchCardByName(name) {
  return new Promise((resolve) => {
    const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.data && json.data[0]) resolve(json.data[0]);
            else resolve(null);
          } catch { resolve(null); }
        } else resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ========================================================================
// MAIN
// ========================================================================

async function main() {
  // Filter out the duplicate Dragon Zombie (m89)
  const entries = CARDS.filter(c => !c.altName);
  
  console.log(`Processing ${entries.length} cards...`);

  const results = [];
  const imageMap = {};
  const failed = [];

  for (const entry of entries) {
    process.stdout.write(`  ${entry.gameId}: ${entry.name}... `);
    
    const cardData = await fetchCardByName(entry.name);
    
    if (!cardData) {
      console.log('❌ FAILED');
      failed.push(entry.name);
      // Use fallback
      results.push({
        ...entry,
        atk: 0, def: 0, level: 1,
        attribute: 'dark', species: 'warrior',
        description: entry.name,
      });
      imageMap[entry.gameId] = '';
    } else {
      const imgId = cardData.card_images?.[0]?.id || cardData.id;
      const desc = cardData.desc || '';
      
      const obj = {
        ...entry,
        name: cardData.name,  // Use official API name
        description: desc,
      };
      
      if (entry.type === 'monster') {
        obj.atk = cardData.atk ?? 0;
        obj.def = cardData.def ?? 0;
        obj.level = cardData.level || 1;
        obj.attribute = (cardData.attribute || 'dark').toLowerCase();
        obj.species = (cardData.race || 'warrior').toLowerCase();
      }
      
      results.push(obj);
      imageMap[entry.gameId] = `https://images.ygoprodeck.com/images/cards/${imgId}.jpg`;
      console.log(`✅ (ATK:${cardData.atk ?? '-'} DEF:${cardData.def ?? '-'})`);
    }
    
    await delay(55);
  }

  if (failed.length > 0) {
    console.log(`\n⚠ Failed cards: ${failed.join(', ')}`);
  }

  // ===== GENERATE FILES =====
  function esc(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
  }

  function cardToJS(c) {
    const nameStr = esc(c.name);
    const descStr = esc(c.description);
    const effectStr = c.effect ? `'${c.effect}'` : 'null';

    if (c.type === 'monster') {
      return `  { id: '${c.gameId}', name: '${nameStr}', atk: ${c.atk}, def: ${c.def}, type: 'monster', level: ${c.level}, attribute: '${c.attribute}', species: '${c.species}', effect: ${effectStr}, description: '${descStr}' }`;
    } else if (c.type === 'spell') {
      const catStr = c.category ? `, category: '${c.category}'` : '';
      return `  { id: '${c.gameId}', name: '${nameStr}', type: 'spell'${catStr}, effect: ${effectStr}, description: '${descStr}' }`;
    } else {
      return `  { id: '${c.gameId}', name: '${nameStr}', type: 'trap', effect: ${effectStr}, description: '${descStr}' }`;
    }
  }

  const monsters = results.filter(c => c.type === 'monster');
  const spells = results.filter(c => c.type === 'spell');
  const traps = results.filter(c => c.type === 'trap');

  console.log(`\nMonsters: ${monsters.length}, Spells: ${spells.length}, Traps: ${traps.length}`);
  console.log(`Total: ${results.length}`);

  // cards_1.js: first 40 monsters
  const p1 = monsters.slice(0, 40);
  fs.writeFileSync(path.join(__dirname, 'server/cards_1.js'),
    `const CARDS_PART1 = [\n${p1.map(cardToJS).join(',\n')}\n];\n\nexport { CARDS_PART1 };\n`);

  // cards_2.js: monsters 41-80
  const p2 = monsters.slice(40, 80);
  fs.writeFileSync(path.join(__dirname, 'server/cards_2.js'),
    `const CARDS_PART2 = [\n${p2.map(cardToJS).join(',\n')}\n];\n\nexport { CARDS_PART2 };\n`);

  // cards_3.js: remaining monsters + first 15 spells
  const p3m = monsters.slice(80);
  const p3s = spells.slice(0, 15);
  fs.writeFileSync(path.join(__dirname, 'server/cards_3.js'),
    `const CARDS_PART3 = [\n  // ===== MONSTER CARDS =====\n${p3m.map(cardToJS).join(',\n')},\n  // ===== SPELL CARDS =====\n${p3s.map(cardToJS).join(',\n')}\n];\n\nexport { CARDS_PART3 };\n`);

  // cards_4.js: remaining spells + all traps
  const p4s = spells.slice(15);
  fs.writeFileSync(path.join(__dirname, 'server/cards_4.js'),
    `const CARDS_PART4 = [\n  // ===== SPELL CARDS =====\n${p4s.map(cardToJS).join(',\n')},\n  // ===== TRAP CARDS =====\n${traps.map(cardToJS).join(',\n')}\n];\n\nexport { CARDS_PART4 };\n`);

  // cardImageMap.json
  fs.writeFileSync(path.join(__dirname, 'server/cardImageMap.json'),
    JSON.stringify(imageMap, null, 2));

  console.log('\n✅ All files written!');
}

main().catch(console.error);
