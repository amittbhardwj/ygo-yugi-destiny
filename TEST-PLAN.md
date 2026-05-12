# Yu-Gi-Oh! Power of Chaos — Test Plan

## Source Reference
Video: https://www.youtube.com/watch?v=va6akCOkAkk
"155/155 Card List | Yu Gi Oh! Power of Chaos YUGI THE DESTINY"

---

## CARD DESIGN (from frame analysis)

### Monster Card Frame Colors
| Type | Frame Color | Details |
|------|-------------|---------|
| Normal Monster | Tan/brown (NOT blue) | `rgb(139,90,43)` or similar |
| Effect Monster | Orange/amber | Dark orange border |
| Ritual Monster | Blue | (not in our deck) |
| Spell | Green | `#16a34a` |
| Trap | Purple/Violet | `#7c3aed` |

### Card Layout (top to bottom)
1. **Name Banner** — Black bar at top, white text, serif font
2. **Attribute Symbol** — Right side of name banner, colored circle with kanji (罠=trap, 火=fire, etc.)
3. **Level Stars** — Right side below name banner, orange/gold stars with red circular background
4. **Art Box** — Large central artwork
5. **Set Code** — Small text bottom-right of art ("LOB-058")
6. **Type Line** — `[FAIRY]` / `[WARRIOR]` etc in brackets, below art
7. **Effect/Flavor Text** — Below type line
8. **ATK/DEF** — Bottom-right corner, small text "ATK/ 800 DEF/2000"

### Card Back
- Dark brown border with tan swirl pattern (NOT orange/gold Egyptian)

---

## UI ELEMENTS (from frame analysis)

### Phase Buttons (vertical column, left side)
- DP (Draw Phase)
- SP (Standby Phase)  
- M1 (Main Phase 1) — highlighted when active
- BP (Battle Phase) — blue glow when active
- M2 (Main Phase 2)
- EP (End Phase)
- **Style**: Oval gray stone buttons with red text
- **Position**: Vertical column between card info panel and field

### Life Points Display
- Large white digital numbers (e.g., "6400", "8000")
- Stone bar above/below
- **Winged scarab/bird motif** — gold colored with blue glowing orb
- **Position**: Top-left (opponent), Bottom-left (player)

### Field
- Green marble texture background
- Large faint **Eye of Wdjat/Anubis** symbol watermark in center
- 5x2 grid with gold dividing lines
- **Decks**: Card back stack with number below ("33", "30")
- **Graveyards**: Dark pits
- **Field Spell Zone**: Circular icon on middle left

### Card Info Panel (left side, full-height)
- Dark marble/stone background
- Ornate **gold Egyptian border** with canopic jar icons
- Shows: Card name, type, effect text, ATK/DEF
- Header text: yellow bold
- Effect text: white
- ATK/DEF at bottom: yellow

### Player Hand
- Bottom edge of screen
- Cards fan out horizontally
- Hover shows card enlarged in info panel

### Floating Damage
- Large red text "-800" with white outline
- Floats over the field where damage dealt

### Joey Reaction Cut-in (on trap activation)
- Large manga-style panel
- Character face in center
- Orange/yellow gradient background

---

## TEST CHECKLIST

### Card Images
- [ ] Normal monsters have TAN/BROWN frame (not blue!)
- [ ] Effect monsters have ORANGE/AMBER frame
- [ ] Spell cards have GREEN frame
- [ ] Trap cards have PURPLE/VIOLET frame
- [ ] Card back has brown swirl (not orange Egyptian)
- [ ] All 40 card images exist
- [ ] ATK/DEF visible on all monster cards
- [ ] Level stars on all monster cards
- [ ] Attribute symbols on monster cards

### UI - Phase Buttons
- [ ] Vertical column of 6 buttons: DP, SP, M1, BP, M2, EP
- [ ] Stone/oval gray style
- [ ] Red abbreviated text
- [ ] M1 highlights pink when active
- [ ] BP highlights blue when active

### UI - Life Points
- [ ] Large white digital numbers
- [ ] Gold winged scarab motif
- [ ] Blue glowing orb in center
- [ ] Stone bar above/below LP numbers
- [ ] Opponent LP: top-left
- [ ] Player LP: bottom-left

### UI - Card Info Panel
- [ ] Dark marble background
- [ ] Ornate gold Egyptian border
- [ ] Card name in yellow bold header
- [ ] Type in green text
- [ ] Effect text in white
- [ ] ATK/DEF in yellow at bottom

### UI - Field
- [ ] Green marble texture background
- [ ] Eye of Wdjat/Anubis watermark in center
- [ ] 5x2 gold grid
- [ ] Deck stacks with card count
- [ ] Graveyard dark pit areas
- [ ] Egyptian decorative elements

### Gameplay
- [ ] Turn announcement overlay ("YOUR TURN" / "OPPONENT'S TURN")
- [ ] Phase transitions work correctly
- [ ] Can summon monsters during M1
- [ ] Can attack during BP
- [ ] End Phase advances correctly
- [ ] LP updates on damage
- [ ] Floating damage numbers on attack
- [ ] Trap activation reaction cut-in
- [ ] Card detail shows on hover/click

### Online Multiplayer
- [ ] Create room generates code
- [ ] Join room with code works
- [ ] Both players see same game state
- [ ] Turn alternates between players

---

## BUGS TO FIX BASED ON VIDEO
1. Card frame colors wrong — many monster images show blue frame but should be tan/brown
2. Card back is wrong — current shows orange/gold Egyptian pattern, should be brown swirl
3. Phase buttons missing proper Egyptian stone styling
4. LP display needs wing/scarab motifs added
5. Field needs Eye of Wdjat watermark
6. Card info panel needs full marble background + Egyptian border
7. Floating damage numbers not showing on attack
8. Character reaction cut-ins not implemented