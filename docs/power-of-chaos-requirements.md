# Power of Chaos Clone Requirements

Confirmed by Amitt on 2026-05-13:

1. Rules target: exact early Power of Chaos / early Yu-Gi-Oh rules, not modern Yu-Gi-Oh.
2. Priority: improve normal duel gameplay before tutorial mode.
3. Card availability: all cards unlocked from the start.
4. Start menu: include a Deck Creator / Deck Construction option.
5. Duel start: decide who goes first using a coin flip.
6. Animations: implement the full Power of Chaos-style duel feedback set (summon, set, activate, attack, damage, destruction, phase/turn, coin flip, win/loss).

Implementation notes:
- Keep the card collection loop optional/disabled for now because all cards are unlocked.
- Deck creator must enforce early deck rules: main deck >= 40 cards, max 3 copies per card, fusion cards separate from main deck.
- Normal duel should use the selected custom deck when available, otherwise use a legal default deck.
