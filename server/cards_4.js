const CARDS_PART4 = [
  // ============================================
  // SPELL CARDS s16-s40
  // ============================================
  { id: 's16', name: "The Necklace", type: 'spell', category: 'continuous', effect: 'damage_prevention', description: "Prevent 500 battle damage to you during each of your turns." },
  { id: 's17', name: "Mysterious Sword", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 500 ATK." },
  { id: 's18', name: "Malevolent Nuzzler", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 700 ATK." },
  { id: 's19', name: "Spark of the Monkey King", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 800 ATK." },
  { id: 's20', name: "Vile Quintet", type: 'spell', category: 'normal', effect: 'mill', description: "Both players send the top 5 cards of their Deck to the Graveyard." },
  { id: 's21', name: "Dian Keto the Cure Master", type: 'spell', category: 'normal', effect: 'life_gain', description: "Gain 500 Life Points." },
  { id: 's22', name: "Dark Energy", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 300 ATK." },
  { id: 's23', name: "Ancient Telescope", type: 'spell', category: 'normal', effect: 'rearrange_top', description: "Look at the top 5 cards of your Deck, then return them to the top of your Deck in any order." },
  { id: 's24', name: "Book of Secret Arts", type: 'spell', category: 'equip', effect: 'spellcaster_boost', description: "Equip only to a Spellcaster-type monster. It gains 300 ATK and 300 DEF." },
  { id: 's25', name: "Dark Purple", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 600 ATK." },
  { id: 's26', name: "The Injection Needle", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a monster you control. It gains 1200 ATK." },
  { id: 's27', name: "Rare Value", type: 'spell', category: 'normal', effect: 'exchange_hand', description: "Exchange 1 random card from your opponent's hand with 1 random card from your own hand." },
  { id: 's28', name: "Enchanting Mists", type: 'spell', category: 'continuous', effect: 'damage_prevention', description: "Prevent 1000 battle damage to you during each of your turns." },
  { id: 's29', name: "Draining Shield", type: 'spell', category: 'continuous', effect: 'damage_prevention', description: "Prevent 1500 battle damage to you during each of your turns." },
  { id: 's30', name: "Dark Eraser", type: 'spell', category: 'continuous', effect: 'damage_prevention', description: "Prevent 700 battle damage to you during each of your turns." },
  { id: 's31', name: "Shadow of Void", type: 'spell', category: 'normal', effect: 'skip_draw', description: "Neither player takes their Draw Phase. Both players skip their next Draw Phase." },
  { id: 's32', name: "Crush Card", type: 'spell', category: 'normal', effect: 'draw', description: "If your opponent controls 3 or more monsters, draw 2 cards from your Deck." },
  { id: 's33', name: "Metal Treasure", type: 'spell', category: 'normal', effect: 'life_gain', description: "Gain 1000 Life Points." },
  { id: 's34', name: "Silver Pendant", type: 'spell', category: 'normal', effect: 'life_gain', description: "Gain 700 Life Points." },
  { id: 's35', name: "Dark Core", type: 'spell', category: 'normal', effect: 'destroy_monster', description: "Destroy 1 face-up monster on the field." },
  { id: 's36', name: "Abyss Sea", type: 'spell', category: 'continuous', effect: 'field_spell', description: "All Aquatic, Sea Serpent, and Fish monsters gain 200 ATK and DEF." },
  { id: 's37', name: "Flame Circle", type: 'spell', category: 'normal', effect: 'damage_redirect', description: "During this turn, any battle damage you take is halved." },
  { id: 's38', name: "Thunder Force", type: 'spell', category: 'equip', effect: 'atk_boost', description: "Equip only to a Thunder-type monster. It gains 500 ATK." },
  { id: 's39', name: "Mystic Relay", type: 'spell', category: 'ritual', effect: 'ritual_summon', description: "Ritual Summon 1 Ritual Monster from your hand by tributing monsters from your field or hand whose total Levels equal 4 or more." },
  { id: 's40', name: "Spiral Gate", type: 'spell', category: 'quick-play', effect: 'bounce', description: "Return 1 monster your opponent controls to their hand." },

  // ============================================
  // TRAP CARDS t1-t20
  // ============================================
  { id: 't1', name: "Trap Hole", type: 'trap', effect: 'destroy_monster', description: "When your opponent Normal or Flip Summons a monster with 1000 or more ATK: Destroy that monster." },
  { id: 't2', name: "Mirror Force", type: 'trap', effect: 'destroy_attackers', description: "When an opponent's monster declares an attack: Destroy all Attack Position monsters your opponent controls." },
  { id: 't3', name: "Ring of Destruction", type: 'trap', effect: 'destroy_both_damage', description: "When both players have at least 1 monster on the field: Destroy both monsters and inflict 500 damage to each player." },
  { id: 't4', name: "Wicked Dragon Wrath", type: 'trap', effect: 'destroy_monster', description: "Destroy 1 opponent's monster on the field." },
  { id: 't5', name: "Nobleman of Crossout", type: 'trap', effect: 'flip_destroy', description: "Target 1 face-down monster your opponent controls. Flip it face-up. If flipped, destroy it. The targeted card cannot change its battle position this turn." },
  { id: 't6', name: "Reinforcement", type: 'trap', effect: 'search_low_atk', description: "Add 1 monster with 1000 or less ATK from your Deck to your hand." },
  { id: 't7', name: "Dust Tornado", type: 'trap', effect: 'destroy_set_st', description: "Destroy 1 Spell or Trap Card your opponent controls, then you can Set 1 Spell or Trap Card from your hand." },
  { id: 't8', name: "Shadow Spell", type: 'trap', effect: 'take_control', description: "Take control of 1 opponent's monster on the field. It cannot attack or change its battle position for 3 turns." },
  { id: 't9', name: "Decoy", type: 'trap', effect: 'swap_draw', description: "Swap 1 monster you control with the top card of your Deck. If the swapped monster is destroyed by battle, draw 1 card." },
  { id: 't10', name: "Medal of the Caught", type: 'trap', effect: 'redirect_damage', description: "When you would take battle damage from an opponent's monster: Redirect that damage to 1 opponent's monster instead." },
  { id: 't11', name: "Light of Redemption", type: 'trap', effect: 'life_gain', description: "Gain 800 Life Points." },
  { id: 't12', name: "Curse of the Void", type: 'trap', effect: 'banish_top', description: "Both players banish the top 3 cards of their Deck face-down." },
  { id: 't13', name: "Counter Counter", type: 'trap', effect: 'negate_spell', description: "Negate the activation of a Trap Card and destroy it." },
  { id: 't14', name: "Phantom Fog", type: 'trap', effect: 'lower_atk', description: "All monsters your opponent currently controls lose 400 ATK until the End Phase." },
  { id: 't15', name: "Ancient Predicament", type: 'trap', effect: 'skip_draw_player', description: "Your opponent skips their next Draw Phase." },
  { id: 't16', name: "Mirror Gate Strike", type: 'trap', effect: 'reflect_battle', description: "When an opponent's monster attacks: The attacking monster's ATK becomes 0 until the End Phase, then the opponent takes damage equal to the original ATK." },
  { id: 't17', name: "Thunder Claw", type: 'trap', effect: 'atk_boost_turn', description: "One monster you control gains 600 ATK until the End Phase." },
  { id: 't18', name: "Spirit Return", type: 'trap', effect: 'special_summon_grave', description: "Special Summon 1 monster from your Graveyard to your field." },
  { id: 't19', name: "Dark Ruler Masquerade", type: 'trap', effect: 'both_skip_draw', description: "Both players skip their next Draw Phase." },
  { id: 't20', name: "Dragon's Fury", type: 'trap', effect: 'damage_double', description: "Double the battle damage you would take from this battle." }
];
export default CARDS_PART4;