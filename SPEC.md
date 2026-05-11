# Yu-Gi-Oh! Power of Chaos: Yugi the Destiny — Online

## 1. Concept & Vision

A faithful browser-based recreation of **Yu-Gi-Oh! Power of Chaos: Yugi the Destiny** — the classic PC card game featuring 155 cards from the original storyline. Playable online with a friend via a shareable URL. One player controls the duel while the other plays as Yugi, or both players bring their own decks for PvP. The feel is nostalgic but modern: crisp card rendering, smooth animations, and zero-friction online play.

**Tagline:** "The destiny begins."

---

## 2. Game Overview

### What is Yugi the Destiny?
- First Yu-Gi-Oh! game released for PC (2003)
- Single-player campaign duel against Yugi (AI)
- 155 cards per deck
- LP (Life Points): 4000 each
- Turn phases: Draw → Standby → Main Phase 1 → Battle → Main Phase 2 → End
- Win by reducing opponent's LP to 0

### What We're Building
- Browser-based (no installation needed)
- Online multiplayer: Player vs Player OR Player vs Yugi AI
- Shareable room codes for easy friend joining
- Faithful card pool (155 cards from original)
- Clean, readable UI with card hover details

---

## 3. Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Frontend | React + Vite | Fast dev, modern DX, component-based |
| Styling | Tailwind CSS | Utility-first, easy card layouts |
| Game Rendering | HTML5 Canvas + React | Smooth card animations |
| Backend | Node.js + Express | Simple, WebSocket-friendly |
| Real-time | Socket.IO | Reliable multiplayer sync |
| State | In-memory (no DB for v1) | Simplicity, free tier friendly |
| Hosting | Render.com (Web Service) | Free tier, WebSocket support, Node.js |

### Architecture
```
Client (React) ←→ Socket.IO ←→ Server (Node.js)
                                   ↓
                              In-memory
                              Game State
```

Both client + server can run on a single Render Web Service.

---

## 4. Card Database (155 Cards)

Card data sourced from: Legend of Blue Eyes White Dragon, Starter Deck: Yugi, Metal Raiders, Spell Ruler, Tournament Pack 3rd Season, Starter Deck: Pegasus.

### Card Structure
```javascript
{
  id: 1,
  name: "Blue Eyes White Dragon",
  type: "monster",
  attribute: "light",
  kind: "dragon",  // monster type
  level: 8,
  atk: 3000,
  def: 2500,
  cardType: "normal", // "normal" | "effect"
  description: "This ferocious dragon has enough power to destroy any foe.",
  icon: "🐉"
}
```

### Key Cards to Include (representative sample)
**High-Level Monsters (Level 6-8):**
- Blue Eyes White Dragon (ATK 3000, DEF 2500) — Light/Dragon/Normal
- Red Eyes Dark Dragon (ATK 2400, DEF 2000) — Dark/Dragon/Normal
- Gaotama (ATK 2200, DEF 1800) — Light/ Fairy/Normal
- Celtic Guardian (ATK 1400, DEF 1200) — Earth/Warrior/Normal
- Moonlight (ATK 1800, DEF 1500) — Wind/Warrior/Normal

**Effect Monsters:**
- Dark Sage (ATK 2000, DEF 1500) — Dark/Spellcaster/Effect: Gains 500 ATK/DEF for each card in hand
- Lord of D. (ATK 1200, DEF 1100) — Spellcaster/Effect: Spells/Traps you control cannot be destroyed
- Castle of Dark Illusions (DEF 2000) — Level 4/Effect
- Kaiser Sea Horse (ATK 1400, DEF 1200) — Water/Effect: Returns to hand instead ofgrave
- NONO-chan (ATK 400, DEF 800) — Level 2/Effect

**Spells:**
- Monster Reborn ( Spell, Normal) — Special summon 1 monster from either grave
- Dark Hole (Spell, Normal) — Destroy all monsters on field
- Raigeki (Spell, Normal) — Destroy all monsters opponent controls
- Change of Heart (Spell, Normal) — Take control of 1 opponent monster
- Dark Magic Attack (Spell, Normal) — Destroy 1Spell/Trap opponent has + deal 300 damage
- Ookazi (Spell, Normal) — Deal 800 damage to opponent
- The Neckbear (Spell, Equip) — Equip to monster, +600 ATK
- Dragon's Tie (Spell, Equip) — Equip to Dragon-type, +300 ATK/DEF
- Ooguchi (Spell, Equip) — Equip to Aqua-type, +400 ATK/DEF
- Malevolent Nuzzler (Spell, Equip) — Equip to Beast-type, +300 ATK
- Fireye (Spell, Quick-Play) — Deal 500 damage to opponent
- Monster Recovery (Spell, Quick-Play) — Return 1 monster from grave to hand
- Dian Keto the Cure Master (Spell) — Heal 500 LP
- Ookashi (Spell, Equip) — Equip to Aqua-type, +400 DEF
- Book of Secret Arts (Spell, Equip) — Equip to Spellcaster, +300 ATK/DEF
- Spell Absorption (Spell, Continuous) — Heal 500 LP when Spell is activated
- Cold Wave (Spell) — Neither player can activate Spell/Trap effects this turn

**Traps:**
- Trap Hole (Trap, Normal) — Destroy 1 monster with 1000+ ATK when opponent summons
- Mirror Force (Trap, Normal) — Destroy all attack position monsters opponent controls
- Thunder of Rul (Trap, Normal) — Deal 500 damage to each player
- Damage=1000× (Trap) — Deal 1000 damage to opponent
- Full House (Trap, Normal) — Both players discard hand, draw 5
- Just desserts (Trap) — Deal 500 damage to opponent for each monster they control
- Mind Haxor (Trap) — Deal 600 damage to opponent
- Metal Reflectors (Trap, Continuous) — Special summon a 0 ATK/DEF copy of opponent's monster
- Negate Attack (Trap, Counter) — Negate Battle Phase, opponent skips to End Phase
- Magic Jammer (Trap, Counter) — Negate Spell, opponent discards 1 card
- Ring of Destruction (Trap) — Destroy 1 monster both players control, each takes 500 damage

### Full Card List (155 total)
TBD: Full card list will be implemented in `/cards.json`. Cards will be manually entered from wiki data.

---

## 5. Game Rules

### Turn Phases
1. **Draw Phase** — Draw 1 card (forced)
2. **Standby Phase** — Some card effects activate
3. **Main Phase 1** — Play 1 monster OR set spell/trap; can also activate spell cards
4. **Battle Phase** — Attack with each monster once (in any order)
5. **Main Phase 2** — Play additional spells/traps (optional)
6. **End Phase** — Trigger effects, turn passes

### Battle Rules
- **ATK vs ATK**: Higher ATK wins, difference dealt as damage to loser's controller
- **ATK vs DEF (defending monster)**: No damage unless DEF < ATK (difference to DEF player's LP)
- **Direct Attack**: If opponent has no monsters, attack their LP directly
- **Position Rules**: Monsters start in face-down defense; can flip to attack position once per turn

### Card Placement
- 1 monster per turn in Main Phase 1
- Unlimited spells/traps per turn (can set face-down)
- Face-down cards can be flipped by opponent's attack or effect

### Win Conditions
1. Opponent's LP reaches 0
2. Opponent cannot draw (deck empty)

---

## 6. Deck Configuration

### Yugi's Deck (40 cards, replicated for player's starting deck)
```
Monsters (24):
- 3x Blue Eyes White Dragon
- 2x Celtic Guardian
- 2x Moonlight
- 2x Gaotama
- 2x Dark Sage
- 1x Lord of D.
- 1x Kaiser Sea Horse
- 1x Castle of Dark Illusions
- 1x NONO-chan
- 1x Shadow Specter
- 1x Fire Reincarnation
- 1x Dragon's Tie
- 1x Ooguchi
- 1x Malevolent Nuzzler
- 1x Ookashi
- 1x Ookazi

Spells (13):
- 1x Monster Reborn
- 1x Dark Hole
- 1x Raigeki
- 1x Change of Heart
- 1x Dark Magic Attack
- 1x Ookazi
- 1x Monster Recovery
- 1x Dian Keto the Cure Master
- 1x Fireye
- 1x Spell Absorption
- 1x Cold Wave
- 2x (additional spells from pool)

Traps (3):
- 1x Trap Hole
- 1x Mirror Force
- 1x Negate Attack
```

---

## 7. Multiplayer Architecture

### Room System
- Player 1 creates room → gets 4-character room code (e.g., "YUGA")
- Player 2 joins with room code
- Server manages game state; clients are dumb terminals for game logic
- Both players must confirm "Ready" to start

### Socket.IO Events
```
Client → Server:
  create-room         → { playerName } → { roomCode }
  join-room          → { roomCode, playerName } → { success, error }
  ready              → { roomCode } → broadcast to room
  play-card          → { cardId, position, target? } → server validates
  attack             → { attackerId, targetId } → server resolves
  set-spell-trap     → { cardId, faceDown } → server validates
  end-phase          → { phase } → server advances
  surrender          → { } → other player wins

Server → Client:
  game-state         → full game state after every action
  room-created       → { roomCode }
  player-joined      → { playerName }
  opponent-ready     → {}
  phase-changed      → { newPhase }
  battle-result     → { attackerId, targetId, damage, destroyed }
  game-over          → { winner, reason }
  error             → { message }
```

### Game State (server-authoritative)
```javascript
{
  roomCode: "YUGA",
  players: {
    player1: {
      id: "socket-id-1",
      name: "Amitt",
      lp: 4000,
      deck: [...40 card ids],
      hand: [cardId, ...],
      field: { monsters: [{cardId, position: "attack"|"defense", faceDown, atk, def}], spells: [...] },
      grave: []
    },
    player2: { ... }
  },
  turn: 1,
  currentPlayer: "player1",
  phase: "main1" | "battle" | "end",
  winner: null,
  log: ["Amitt summoned Blue Eyes", "Bot attacks with Celtic Guardian"]
}
```

---

## 8. Yugi AI Behavior

Simple rule-based AI:
1. **Summon**: If possible, summon highest-ATK monster in hand
2. **Battle**: Attack all opponent's monsters (prioritize low DEF), then attack LP directly
3. **Spells**: Play Monster Reborn if available, use Dark Hole if player has 2+ monsters
4. **Traps**: Keep 1 trap set; activate Mirror Force when player has 2+ attack monsters
5. **Randomness**: 20% chance to make suboptimal plays (beatable)

---

## 9. UI Design

### Layout (text wireframe)
```
┌─────────────────────────────────────────────────────────────┐
│  OPPONENT: Yugi  [LP: 4000]  Turn: 1  Phase: Main 1         │
├─────────────────────────────────────────────────────────────┤
│  OPPONENT HAND: [?][?][?][?][?][?][?]                       │
├─────────────────────────────────────────────────────────────┤
│  OPPONENT FIELD:  [card] [card] [card]                      │
│                   [card] [card] [card]                      │
├─────────────────────────────────────────────────────────────┤
│  YOUR FIELD:       [card] [card] [card]                      │
│                    [card] [card] [card]                      │
├─────────────────────────────────────────────────────────────┤
│  YOUR HAND:  [card][card][card][card][card][card]           │
├─────────────────────────────────────────────────────────────┤
│  YOU: Amitt  [LP: 4000]                                     │
│  Deck: 27  Grave: 3                                         │
├─────────────────────────────────────────────────────────────┤
│  [END PHASE]  [SURRENDER]                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Card Hover Detail
When hovering a card, show popup:
- Large card image (or colored rectangle for face-down)
- Full name, type, ATK/DEF/level
- Card text/effect description
- Attribute icon

### Color Scheme
- Primary: Gold/Yellow (#F5C542) — Yu-Gi-Oh! theme
- Background: Dark blue (#1A1A2E) — felt table feel
- Card border: White/cream
- Enemy: Red accent
- Player: Blue accent

---

## 10. Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (Vite + React + Node.js + Socket.IO)
- [ ] Card database (155 cards in JSON)
- [ ] Deck shuffling and dealing logic
- [ ] Basic game state structure
- [ ] Turn phase advancement

### Phase 2: Core Gameplay
- [ ] Card playing (monster summon, spell/trap set)
- [ ] Battle phase implementation (ATK/DEF calculation)
- [ ] Direct attack on empty field
- [ ] Effect resolution (basic effects)
- [ ] Win condition detection

### Phase 3: Multiplayer
- [ ] Socket.IO room system (create/join)
- [ ] Game state sync between 2 clients
- [ ] Turn synchronization (server-authoritative)
- [ ] Latency handling

### Phase 4: Yugi AI
- [ ] Rule-based AI logic
- [ ] AI vs Human single-player mode
- [ ] AI summon + battle + spell decisions

### Phase 5: Polish
- [ ] Card animations (attack, summon, destroy)
- [ ] Sound effects
- [ ] Game log/history
- [ ] Mobile-responsive layout
- [ ] Deployment on Render.com

---

## 11. File Structure

```
ygo-yugi-destiny/
├── SPEC.md
├── package.json
├── server/
│   ├── index.js           # Express + Socket.IO server
│   ├── gameState.js       # Game state management
│   ├── cards.js           # Card database (155 cards)
│   ├── rules.js           # Game rule engine
│   ├── ai.js              # Yugi AI logic
│   └── rooms.js           # Room management
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── GameBoard.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── CardPopup.jsx
│   │   │   ├── Hand.jsx
│   │   │   ├── Field.jsx
│   │   │   ├── PhaseIndicator.jsx
│   │   │   └── Lobby.jsx
│   │   ├── hooks/
│   │   │   └── useSocket.js
│   │   ├── data/
│   │   │   └── cards.json   # Card images (from YGOPRODeck)
│   │   └── styles/
│   │       └── index.css
│   └── vite.config.js
└── README.md
```

---

## 12. Hosting

**Render.com (Free Tier)**
- Web Service (not Static)
- Build: `npm install && npm run build`
- Start: `npm start` (runs server + serves client)
- No database needed (in-memory)
- WebSocket support ✅
- Sleeps after 15min inactivity (fine for casual play)

**Alternative: Railway**
- If Render WebSocket has issues
- Same approach, slightly different config

---

## 13. Time Estimate

| Phase | Time |
|-------|------|
| Phase 1: Foundation | 1-2 hours |
| Phase 2: Core Gameplay | 2-3 hours |
| Phase 3: Multiplayer | 2-3 hours |
| Phase 4: AI | 1-2 hours |
| Phase 5: Polish + Deploy | 1-2 hours |
| **Total** | **~8-12 hours** |

---