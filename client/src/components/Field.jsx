import Card from './Card'

export default function Field({
  monsters,
  spells,
  isOpponent = false,
  onMonsterClick,
  onSpellClick,
  onEmptySlotClick,
  selectedMonster,
  attackTargets = [],
  selectable = false,
  onCardHover,
}) {
  const renderSlot = (card, index, type) => {
    const isSelected = selectedMonster === index
    const isTarget = attackTargets.includes(index)
    const zoneClass = type === 'monster' ? 'monster-zone' : 'spell-zone'

    if (!card) {
      return (
        <div
          key={index}
          className={`poc-zone empty-zone ${zoneClass} ${selectable && !isOpponent ? 'poc-zone-selectable' : ''}`}
          onClick={() => onEmptySlotClick && selectable && !isOpponent && onEmptySlotClick(index, type)}
        >
          <span className="poc-zone-label">{type === 'monster' ? 'M' : 'S/T'}</span>
        </div>
      )
    }

    return (
      <Card
        key={card.id || index}
        card={card}
        faceDown={card.faceDown || false}
        selected={isSelected}
        selectable={selectable && !isOpponent}
        isAttackTarget={isTarget}
        onClick={() => {
          if (type === 'monster') {
            onMonsterClick && onMonsterClick(card, index)
          } else {
            onSpellClick && onSpellClick(card, index)
          }
        }}
        onHover={onCardHover ? (c) => onCardHover(c) : undefined}
        size="field"
      />
    )
  }

  const monsterRow = (
    <div className="poc-zone-row poc-monster-row">
      {[...Array(5)].map((_, i) => renderSlot(monsters[i], i, 'monster'))}
    </div>
  )

  const spellRow = (
    <div className="poc-zone-row poc-spell-row">
      {[...Array(5)].map((_, i) => renderSlot(spells[i], i, 'spell'))}
    </div>
  )

  return (
    <div className={`poc-field ${isOpponent ? 'poc-field-opponent' : 'poc-field-player'}`}>
      {/* Power of Chaos order: spell/trap row sits behind monster row. */}
      {isOpponent ? <>{spellRow}{monsterRow}</> : <>{monsterRow}{spellRow}</>}
    </div>
  )
}
