# Power of Chaos: Yugi the Destiny — Game Understanding

## Identity
- First Yu-Gi-Oh! PC game and first Power of Chaos title.
- Core mode: player learns Yu-Gi-Oh! from Yugi, then duels Yugi to collect cards and build a stronger deck.
- Card pool is early-era Yu-Gi-Oh!: 155 cards, mostly Legend of Blue Eyes White Dragon and Starter Deck: Yugi.

## Player Loop
1. Start with a fixed beginner deck.
2. Learn rules through Yugi tutorial prompts.
3. Duel Yugi using turn-based Yu-Gi-Oh! rules.
4. Win/complete duels to collect more cards.
5. Edit deck under constraints.
6. Duel again with improved deck.

## Deck Rules
- Main Deck minimum: 40 cards.
- Max 3 copies of each card.
- Fusion Deck is separate and does not count toward the 40-card minimum.
- Starting deck includes early normal monsters, a few effects, one fusion, staple spells, and traps.

## Duel Field
Each player has:
- Deck zone.
- Graveyard zone.
- Field Spell zone.
- Fusion Deck zone.
- 5 Monster Zones.
- 5 Spell/Trap Zones.

## Turn Phases
Each turn has 6 phases:
1. Draw Phase — current player draws 1 card. If they cannot draw, they lose.
2. Standby Phase — maintenance/effects resolve.
3. Main Phase 1 — summon/set monsters, change positions, set/activate spells/traps.
4. Battle Phase — attack with attack-position monsters.
5. Main Phase 2 — same actions as Main 1, after battle.
6. End Phase — cleanup/end-of-turn effects, then turn passes.

## Summoning / Setting
- Attack Position: face-up vertical monster; can attack in Battle Phase.
- Defense Position set: face-down horizontal monster.
- Only 5 monsters can be on field at once.
- Spell/Trap zone limit is 5.
- Traps must be set before they can be activated.

## Battle Logic
- Only attack-position monsters can attack.
- If opponent has monsters, attacker must choose a target.
- If opponent has no monsters, attack can be direct to LP.
- Attack vs Attack:
  - Higher ATK destroys lower ATK monster.
  - Difference is dealt as battle damage to losing player.
  - Equal ATK destroys both, no damage.
- Attack vs Defense:
  - Compare attacker ATK to defender DEF.
  - If ATK > DEF: defender destroyed, no LP damage in classic tutorial example.
  - If ATK < DEF: attacker survives, attacker’s player takes difference as damage.
  - If equal: no destruction/damage.
- Face-down defense monsters flip during battle resolution.

## UI/Interaction Personality
- Yugi acts as guide/opponent via speech bubbles.
- Cursor hover reveals contextual actions: Summon, Set, Attack, phase commands.
- Empty field/right-click opens command windows for phase/turn actions.
- Phase orbs show current phase.
- Battle feedback should be theatrical: attack calls, card movement, flashes, damage numbers, destruction.

## Implementation Priority for Our Clone
1. Faithful phase flow and phase-gated actions.
2. Correct battle resolution.
3. Collection/deck-building loop.
4. Yugi tutorial/dialog system.
5. Early card pool and starting deck accuracy.
6. Visual polish/animations/sound matching Power of Chaos.
